const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const { listScenarios, getDelayMs, handleRpc, validateSnapshot } = require("./preview-data");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const previewRoot = path.resolve(__dirname, "..");
const defaultPort = Number(process.env.EDUOPS_PREVIEW_PORT || 4173);
const serverBuildTimestamp = new Date().toISOString();
const transportVersion = "EDUOPS_PREVIEW_TRANSPORT_V2";
const scenarioVersion = "EDUOPS_PREVIEW_SCENARIOS_V1";
const requestStateVersion = "EDUOPS_REQUEST_STATE_V2";
const clientFiles = ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function clientBuildInfo() {
  const runtimeClientSource = clientFiles.map((fileName) => readText(path.join(repoRoot, fileName))).join("\n");
  const previewTransportSource = readText(path.join(previewRoot, "server", "preview-transport.js"));
  return {
    serverBuildTimestamp,
    runtimeClientFiles: clientFiles.slice(),
    runtimeClientInputHash: sha256(runtimeClientSource),
    previewTransportHash: sha256(previewTransportSource),
    servedClientBundleHash: sha256(`${previewTransportSource}\n${runtimeClientSource}`),
    transportVersion,
    scenarioVersion,
    requestStateVersion
  };
}

function renderEduOpsPreviewHtml() {
  let html = readText(path.join(repoRoot, "EduOps.html"));
  const styles = readText(path.join(repoRoot, "EduOps_Styles.html"));
  const build = clientBuildInfo();
  const previewCss = `<style>\n${readText(path.join(previewRoot, "server", "preview-lab.css"))}\n</style>`;
  const previewBuild = `<script>window.EDUOPS_PREVIEW_BUILD=${JSON.stringify(build)};</script>`;
  const previewTransport = `${previewBuild}\n<script>\n${readText(path.join(previewRoot, "server", "preview-transport.js"))}\n</script>`;
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("EduOps_Styles").getContent(); ?>', styles + "\n" + previewCss);
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("OpsEdu_CockpitStyles").getContent(); ?>', readText(path.join(repoRoot, "OpsEdu_CockpitStyles.html")));
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("OpsEdu_ClientCockpit").getContent(); ?>', readText(path.join(repoRoot, "OpsEdu_ClientCockpit.html")));
  clientFiles.forEach((fileName, index) => {
    const include = `<?!= HtmlService.createHtmlOutputFromFile("${fileName.replace(/\.html$/, "")}").getContent(); ?>`;
    const source = readText(path.join(repoRoot, fileName));
    html = html.replace(include, (index === 0 ? previewTransport + "\n" : "") + source);
  });
  html = html
    .replace(/<\?= BUILD_VERSION \?>/g, "r352-preview")
    .replace(/<\?= BUILD_RENDERED_AT \?>/g, serverBuildTimestamp)
    .replace(/<\?= USER_EMAIL \?>/g, "preview.owner@example.test")
    .replace(/<\?= ADMIN_ROLE \?>/g, "PREVIEW_ADMIN");
  return html;
}

function readiness() {
  const build = clientBuildInfo();
  let html = "";
  let error = "";
  try {
    html = renderEduOpsPreviewHtml();
  } catch (err) {
    error = err.message || String(err);
  }
  const unresolvedIncludes = html.match(/<\?[^>]*HtmlService|<\?=/g) || [];
  return {
    ok: !error && unresolvedIncludes.length === 0,
    serverReady: true,
    applicationAssetsReady: !error && html.length > 0,
    sharedClientReady: !error && clientFiles.every((fileName) => html.includes(readText(path.join(repoRoot, fileName)))),
    previewTransportReady: !error && html.includes("window.EDUOPS_TRANSPORT = { call: call }"),
    unresolvedIncludes,
    error,
    pid: process.pid,
    ...build
  };
}

function sendJson(res, statusCode, value) {
  const body = JSON.stringify(value == null ? null : value);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function saveReviewNote(payload) {
  const dir = path.join(previewRoot, "review-output");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "OWNER_REVIEW_RESULTS.json");
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  existing.push({
    recordedAt: new Date().toISOString(),
    scenario: payload.scenario || "",
    note: payload.note || "",
    clientDiagnostics: payload.clientDiagnostics || []
  });
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
  return file;
}

function snapshotsDir() {
  return path.join(previewRoot, "local-snapshots");
}

function readSnapshot(snapshotId) {
  if (!snapshotId) return null;
  const safeId = String(snapshotId).replace(/[^A-Za-z0-9_.-]/g, "");
  const file = path.join(snapshotsDir(), safeId, "snapshot.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listSnapshots() {
  const dir = snapshotsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(dir, entry.name, "snapshot.json");
      if (!fs.existsSync(file)) return null;
      try {
        const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
        const metadata = snapshot.metadata || {};
        const valid = validateSnapshot(snapshot);
        return {
          id: entry.name,
          compatible: valid.ok === true,
          incompatibleReason: valid.ok === true ? "" : (valid.message || valid.code || "Incompatible snapshot"),
          captureDate: metadata.capturedAt || "",
          runtimeIdentity: metadata.runtimeIdentity || "",
          contractVersion: metadata.contractVersion || "",
          reliability: metadata.sourceReliability || "",
          snapshotId: metadata.snapshotId || "",
          sourceAsOf: metadata.sourceAsOf || "",
          populationCount: metadata.populationCount || snapshot.reconciliation && snapshot.reconciliation.canonicalPopulation || 0
        };
      } catch (err) {
        return {
          id: entry.name,
          compatible: false,
          incompatibleReason: err.message || String(err)
        };
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.captureDate || b.id).localeCompare(String(a.captureDate || a.id)));
}

function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/") {
    return sendText(res, 200, renderEduOpsPreviewHtml(), "text/html; charset=utf-8");
  }
  if (req.method === "GET" && url.pathname === "/api/scenarios") {
    return sendJson(res, 200, listScenarios());
  }
  if (req.method === "GET" && url.pathname === "/api/snapshots") {
    return sendJson(res, 200, listSnapshots());
  }
  if (req.method === "GET" && url.pathname === "/health") {
    const status = readiness();
    return sendJson(res, status.ok ? 200 : 503, { ...status, preview: true, liveDependency: false });
  }
  if (req.method === "GET" && (url.pathname.startsWith("/preview-open-original/") || url.pathname.startsWith("/preview-download-original/"))) {
    return sendText(res, 200, "Preview Open Original representation only. No live Drive file is accessed.");
  }
  if (req.method === "POST" && url.pathname.startsWith("/api/rpc/")) {
    return parseJsonBody(req).then((body) => {
      const name = decodeURIComponent(url.pathname.slice("/api/rpc/".length));
      const mode = body.mode === "snapshot" ? "snapshot" : "deterministic";
      const snapshot = mode === "snapshot" ? readSnapshot(body.snapshotId || "") : null;
      const context = {
        mode,
        scenarioId: body.scenario || "normal-authoritative",
        serverDurationMs: getDelayMs(body.scenario || "normal-authoritative", body.latencyMs),
        snapshot
      };
      setTimeout(() => {
        try {
          sendJson(res, 200, handleRpc(name, context, body.payload || {}, repoRoot));
        } catch (err) {
          sendJson(res, 500, { ok: false, readOnly: true, code: "PREVIEW_RPC_ERROR", message: err.message || String(err) });
        }
      }, context.serverDurationMs);
    }).catch((err) => sendJson(res, 400, { ok: false, code: "INVALID_JSON", message: err.message || String(err) }));
  }
  if (req.method === "POST" && url.pathname === "/api/review-note") {
    return parseJsonBody(req).then((body) => {
      const file = saveReviewNote(body || {});
      sendJson(res, 200, { ok: true, file });
    }).catch((err) => sendJson(res, 400, { ok: false, code: "REVIEW_NOTE_FAILED", message: err.message || String(err) }));
  }
  return sendJson(res, 404, { ok: false, code: "NOT_FOUND" });
}

function createServer() {
  return http.createServer((req, res) => {
    try {
      routeRequest(req, res);
    } catch (err) {
      sendJson(res, 500, { ok: false, code: "SERVER_ERROR", message: err.message || String(err) });
    }
  });
}

function start(port = defaultPort, host = "127.0.0.1") {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const actualPort = server.address().port;
      resolve({ server, port: actualPort, host, url: `http://localhost:${actualPort}/` });
    });
  });
}

function launchDetached() {
  const stdoutPath = path.join(previewRoot, "preview-server.stdout.log");
  const stderrPath = path.join(previewRoot, "preview-server.stderr.log");
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");
  const child = childProcess.spawn(process.execPath, [__filename, "--child"], {
    cwd: previewRoot,
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true
  });
  child.unref();
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  process.stdout.write(String(child.pid));
}

if (require.main === module) {
  if (process.argv.includes("--daemon")) {
    launchDetached();
  } else {
    start().then(({ url }) => {
    fs.writeFileSync(path.join(previewRoot, ".eduops-preview.pid"), String(process.pid));
    console.log(`EduOps Preview Lab running at ${url}`);
    console.log("NO LIVE DATA / NO LIVE MUTATIONS / SIMULATED EDUOPS CONTRACTS");
    }).catch((err) => {
      console.error(`EduOps Preview Lab failed to start: ${err.message || err}`);
      process.exit(1);
    });
  }
}

module.exports = { createServer, start, launchDetached, renderEduOpsPreviewHtml, readiness, clientBuildInfo, repoRoot, previewRoot };
