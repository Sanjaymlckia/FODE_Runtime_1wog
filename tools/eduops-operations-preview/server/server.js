const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { buildSnapshotFromEvidence, writeSnapshotFiles } = require("./snapshot-adapter");

const previewRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(previewRoot, "..", "..");
const publicRoot = path.join(previewRoot, "public");
const port = Number(process.env.EDUOPS_OPERATIONS_PREVIEW_PORT || 4183);

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "text/plain; charset=utf-8";
}

function send(res, statusCode, body, type) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body || ""));
  res.writeHead(statusCode, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": buffer.length
  });
  res.end(buffer);
}

function sendJson(res, statusCode, value) {
  send(res, statusCode, JSON.stringify(value), "application/json; charset=utf-8");
}

function currentSnapshot() {
  const file = path.join(previewRoot, "snapshots", "current", "snapshot.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const snapshot = buildSnapshotFromEvidence(repoRoot);
  writeSnapshotFiles(snapshot, previewRoot);
  return snapshot;
}

function safePublicPath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.resolve(publicRoot, "." + requested);
  if (!resolved.startsWith(publicRoot)) return "";
  return resolved;
}

function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      name: "EduOps Operations Preview Lab",
      readOnly: true,
      mutationEndpoints: false,
      port,
      snapshotPopulation: currentSnapshot().population.authoritativeApplicants
    });
  }
  if (req.method === "GET" && url.pathname === "/api/snapshot") {
    return sendJson(res, 200, currentSnapshot());
  }
  if (req.method === "GET" && url.pathname === "/api/mutation-check") {
    return sendJson(res, 200, {
      ok: true,
      readOnly: true,
      liveMutationEndpointsInvoked: false,
      communicationSendEnabled: false
    });
  }
  if (req.method === "GET") {
    const filePath = safePublicPath(url.pathname);
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return send(res, 200, fs.readFileSync(filePath), contentType(filePath));
    }
  }
  sendJson(res, 404, { ok: false, code: "NOT_FOUND" });
}

if (require.main === module) {
  const server = http.createServer(route);
  server.listen(port, "127.0.0.1", () => {
    console.log(`EduOps Operations Preview Lab listening at http://127.0.0.1:${port}/`);
  });
}

module.exports = { route, currentSnapshot };
