# R143 Production Send Gate / Trigger / Automation Audit

Date: 2026-05-07

## Preflight

```text
git status -sb
## main...origin/main

git log --oneline -1
a8a3bba r142: enable manual batch send gate
```

Live whoami refresh during this audit:

```text
Admin: version r142, deployVersion 142, mismatch false, scriptId 1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90
Student: version r142, deployVersion 142, mismatch false, scriptId 1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90
```

No runtime mutation occurred.

## Exact Gate Sources

### Config flags

```text
Config.js:88-96
  SYSTEM_STABILIZATION_MODE: true,
  ENABLE_CONTROLLED_MANUAL_SEND_PROBE: true,
  ENABLE_MANUAL_SINGLE_SENDS: true,
  ENABLE_BATCH_PREVIEW_MODE: true,
  ENABLE_BATCH_SENDS: true,
  ENABLE_TRIGGER_SENDS: false,
  ENABLE_AUTOMATED_STAGE_RUNNER: false,
  ENABLE_PRODUCTION_EMAIL_SENDS: false,
  ENABLE_TRIGGER_EMAIL_SENDS: false,
```

### Batch send composite gate

```text
Utils.js:1321-1337
function isBatchSendEnabled_() {
  return CONFIG
    && CONFIG.SYSTEM_STABILIZATION_MODE !== true
    && CONFIG.ENABLE_BATCH_SENDS === true
    && CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true;
}

function isTriggerSendEnabled_() {
  return CONFIG
    && CONFIG.SYSTEM_STABILIZATION_MODE !== true
    && CONFIG.ENABLE_TRIGGER_SENDS === true
    && CONFIG.ENABLE_TRIGGER_EMAIL_SENDS === true
    && CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true;
}
```

### Manual batch send UI path

```text
AdminUI.html:1969-1999
function sendStageBatchUi_(){
  var stage = batchState.selectedStage;
  var limit = getStageBatchLimitUi_();
  var offset = getStageBatchOffsetUi_();
  var messageType = batchState.messageType || "";
  var previewReady = batchState.previewReady === true
    && batchState.selectedStage === batchState.previewStage
    && Number(batchState.previewLimit || 0) === limit
    && Number(batchState.previewOffset || 0) === offset
    && !!String(batchState.previewRequestId || "")
    && batchState.sendable === true;
  if (!previewReady || batchState.busy || !IS_SUPER) {
    console.log("STAGE_BATCH_SEND_GUARD_BLOCKED", { ... });
    return;
  }
  ...
  .admin_sendStageBatch({ stage: stage, limit: limit, offset: offset, previewRequestId: String(batchState.previewRequestId || ""), confirmSend: true });
}
```

### Manual batch send server gate

```text
Admin.js:4226-4251
function admin_sendStageBatch(payload) {
  ...
  if (isBatchSendEnabled_() !== true) {
    var blockCode = "BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE";
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", { ... });
    logOperationalBlock_("EMAIL_SEND_BLOCKED", { ... blockCode: blockCode ... });
    return adminCommBlockedResult_("send_stage_batch", blockCode, requestId, {
      blockReason: "Batch sends are disabled in preview-only mode."
    });
  }
  ...
  if (p.confirmSend !== true) {
    return adminCommBlockedResult_("send_stage_batch", "CONFIRM_REQUIRED", requestId, { ... });
  }
```

### Runtime safety panel logic

```text
Admin.js:3143-3196
function admin_getOperationalSafetyStatus(payload) {
  ...
  var stabilizationMode = isSystemStabilizationModeActive_();
  var manualProbeEnabled = isManualSingleSendProbeEnabled_() === true;
  var productionSendsEnabled = CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true && stabilizationMode !== true;
  var batchSendsEnabled = isBatchSendEnabled_() === true;
  var triggerSendsEnabled = isTriggerSendEnabled_() === true;
  var automatedRunnerEnabled = CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER === true && triggerSendsEnabled === true;
  ...
  gates: {
    stabilizationMode: stabilizationMode,
    productionSendsEnabled: productionSendsEnabled,
    manualProbeMode: manualProbeEnabled,
    manualSendEnabled: manualProbeEnabled,
    batchPreviewMode: isBatchPreviewModeEnabled_() === true,
    batchSendEnabled: batchSendsEnabled,
    triggerSendsEnabled: triggerSendsEnabled,
    automatedStageRunnerEnabled: automatedRunnerEnabled,
    bounceIngestionEnabled: CONFIG.ENABLE_BOUNCE_INGESTION === true && stabilizationMode !== true,
    dailyCap: Number(CONFIG.DAILY_SEND_CAP || CONFIG.AUTOMATED_STAGE_DAILY_CAP || 0),
    automatedDailyCap: Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0),
    perRunCap: Number(CONFIG.PER_RUN_BATCH_SIZE || CONFIG.DEFAULT_STAGE_BATCH_SIZE || 0),
    maxPerRunCap: Number(CONFIG.MAX_PER_RUN_BATCH_SIZE || CONFIG.MAX_STAGE_BATCH_SIZE || 0),
    lastBlockedReason: lastBlockedReason
  },
```

### Admin UI rendering of runtime safety

```text
AdminUI.html:3758-3789
function renderOperationalSafetyStatus_(res){
  ...
  setOpsValue_("opsProductionSends", gates.productionSendsEnabled === true);
  setOpsValue_("opsTriggerSends", gates.triggerSendsEnabled === true);
  setOpsValue_("opsTriggerInstalled", trigger.installed === true ? "YES" : "NO");
  ...
  setOpsValue_("opsBatchSend", gates.batchSendEnabled === true);
  setOpsValue_("opsTriggerSendGate", gates.triggerSendsEnabled === true);
  setOpsValue_("opsDailyCap", gates.dailyCap);
  setOpsValue_("opsPerRunCap", gates.perRunCap);
  setOpsValue_("opsLastBlockedReason", gates.lastBlockedReason || "-");
}
```

### Trigger inspection and trigger install/remove

```text
Code.js:7747-7830
function inspectAutomatedStageRunnerTriggers_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  try {
    var triggers = ScriptApp.getProjectTriggers();
    ...
  }
}

function ensureAutomatedStageRunnerTrigger_() {
  ...
  ScriptApp.newTrigger(fnName).timeBased().everyMinutes(10).create();
  ...
}
```

```text
Code.js:7895-7931
function getAutomatedStageRunnerStatus_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  var today = readAutomatedStageRunnerDailyCount_(new Date());
  var gate = shouldRunAutomatedStageBatch_();
  var triggerInspection = inspectAutomatedStageRunnerTriggers_();
  ...
  enabled: CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER === true,
  dailyCap: Math.max(0, Math.floor(Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0))),
  batchSize: Number(gate.perRunBatchSize || 0),
  ...
}

function admin_installOrUpdateAutomatedStageRunnerTrigger() {
  ...
  var trigger = ensureAutomatedStageRunnerTrigger_();
  var status = getAutomatedStageRunnerStatus_();
  return Object.assign({}, trigger, { status: status });
}
```

### Automation runner hard gate

```text
Code.js:7665-7677
function runAutomatedStageBatchWithLock_(opts) {
  ...
  if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true || CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) {
    var reason = isSystemStabilizationModeActive_()
      ? "SYSTEM_STABILIZATION_MODE_ACTIVE"
      : (CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true ? "AUTO_STAGE_DISABLED" : "AUTO_STAGE_SENDS_DISABLED");
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", { ... });
    if (CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true) logOperationalBlock_("AUTO_STAGE_DISABLED", { ... });
    if (CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) logOperationalBlock_("AUTO_STAGE_SENDS_DISABLED", { ... });
    if (source === "TRIGGER") logOperationalBlock_("TRIGGER_SEND_BLOCKED", { ... });
    logOperationalBlock_("AUTO_STAGE_SAFE_NOOP", { ... });
    return { ok: true, action: "automated_stage_batch", result: "SKIPPED", reason: reason, ... };
  }
```

```text
Code.js:7725-7729
function automatedStageBatchRunner() {
  if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true || CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) {
    return runAutomatedStageBatchWithLock_({ source: "TRIGGER" });
  }
  return runAutomatedStageBatchWithLock_({ source: "TRIGGER" });
}
```

### Trigger send gate

```text
Utils.js:1332-1337
function isTriggerSendEnabled_() {
  return CONFIG
    && CONFIG.SYSTEM_STABILIZATION_MODE !== true
    && CONFIG.ENABLE_TRIGGER_SENDS === true
    && CONFIG.ENABLE_TRIGGER_EMAIL_SENDS === true
    && CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true;
}
```

### Production email gate used by mail paths

```text
Utils.js:1877-1885
if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true) {
  var blockCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
  if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
    action: "admin_send_email",
    recipient: toEmail
  });
  logOperationalBlock_("EMAIL_SEND_BLOCKED", {
    action: "admin_send_email",
    blockCode: blockCode,
```

## Why r142 still reports Production Sends OFF

The UI value is derived, not just the config flag:

```text
Admin.js:3157-3166
var stabilizationMode = isSystemStabilizationModeActive_();
var productionSendsEnabled = CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true && stabilizationMode !== true;
var batchSendsEnabled = isBatchSendEnabled_() === true;
var triggerSendsEnabled = isTriggerSendEnabled_() === true;
var automatedRunnerEnabled = CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER === true && triggerSendsEnabled === true;
var lastBlockedReason = stabilizationMode
  ? (manualProbeEnabled ? "" : "SYSTEM_STABILIZATION_MODE_ACTIVE")
  : (!productionSendsEnabled ? "PRODUCTION_EMAIL_SENDS_DISABLED" : "");
```

Because `SYSTEM_STABILIZATION_MODE` is `true` and `ENABLE_PRODUCTION_EMAIL_SENDS` is `false`, the runtime safety panel reports `Production Sends OFF`. `ENABLE_BATCH_SENDS=true` is only one input to the composite `isBatchSendEnabled_()` gate; it does not override stabilization or production-send disablement.

## Exact Batch Block Source

`admin_sendStageBatch` blocks with `BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE` whenever `isBatchSendEnabled_() !== true`.

That is a composite gate, not a single-flag gate.

## Trigger Situation

Current accepted live state says `Trigger Installed = NO`. The code path for confirmation is read-only:

```text
Code.js:7747-7755
function inspectAutomatedStageRunnerTriggers_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var count = 0;
    for (var i = 0; i < triggers.length; i++) {
      if (clean_(triggers[i].getHandlerFunction() || "") === fnName) count++;
    }
```

I could not re-run the trigger RPC from the CLI in this session because Apps Script execution permissions block `clasp run` here. No mutation was attempted.

## Truth Table

| Gate / Flag | Current r142 value | Source file + line | Controls manual batch? | Controls trigger send? | Controls automation runner? | Required value for intended next phase | Risk if enabled | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ENABLE_BATCH_SENDS` | `true` | `Config.js:92` | Yes, but only as one input | No | No | `true` for batch eligibility | Low by itself | Does not override stabilization or production gate |
| `SYSTEM_STABILIZATION_MODE` | `true` | `Config.js:88`, `Utils.js:1321-1325`, `Utils.js:1332-1337` | Yes, blocks batch eligibility | Yes, blocks trigger eligibility | Yes, blocks runner | `false` | High | Hard stop for all send paths |
| `ENABLE_PRODUCTION_EMAIL_SENDS` | `false` | `Config.js:95`, `Admin.js:3159-3166`, `Utils.js:1877-1885` | Yes, required for batch | Yes, required for trigger send | Yes, required for runner | `true` | High | This is why `Production Sends` is OFF |
| `ENABLE_TRIGGER_SENDS` | `false` | `Config.js:93`, `Utils.js:1332-1337`, `Admin.js:3159-3166` | No | Yes | Indirectly via runner status | `true` only if trigger send is intended | Medium | Separate from batch send flag |
| `ENABLE_TRIGGER_EMAIL_SENDS` | `false` | `Config.js:96`, `Utils.js:1332-1337`, `Code.js:7669-7677` | No | Yes | Yes | `true` only if trigger emails are intended | High | Blocks trigger and runner send execution |
| `ENABLE_AUTOMATED_STAGE_RUNNER` | `false` | `Config.js:94`, `Code.js:7313-7331`, `Code.js:7669-7677` | No | No | Yes | `true` only for unattended automation | High | Still requires trigger email gate and production gate |
| `batch preview mode` | `true` | `Config.js:91`, `Admin.js:3159-3196`, `AdminUI.html:1788-1807` | No | No | No | `true` for preview-only workflow | Low | Preview is already enabled and read-only |
| `preview/confirm parity gate` | `enabled` | `AdminUI.html:1974-1999`, `Admin.js:4259-4264` | Yes | No | No | preview-ready + confirmSend | Medium | UI requires preview match before send |
| `trigger installed state` | `NO` per accepted live state; CLI re-query unavailable | `Admin.js:3151-3154`, `Admin.js:3198-3203`, `Code.js:7747-7755` | No | Yes | Yes | `NO` until Jun 1 rollout | High if installed with send flags on | Safe read-only inspection exists; live CLI re-query blocked |
| `daily cap` | `500` | `Config.js:104-105`, `Code.js:7262-7279`, `Code.js:7396-7417`, `Code.js:7904-7907` | No | Yes, for automation | Yes | unchanged | Medium | Caps automation throughput |
| `per-run cap` | `30` / automation safe max `30` | `Config.js:86`, `Config.js:107`, `Code.js:7319-7329`, `Admin.js:3194-3195` | No | Yes, via batch sizing | Yes | unchanged | Medium | Limits automation batch size |
| `manual batch server gate` | blocked by composite gate | `Admin.js:4226-4251` | Yes | No | No | `isBatchSendEnabled_() === true` | High if opened prematurely | The block text remains `BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE` |

## Recommended Next Enablement Plan

Safest next CIS: **Option A — Manual batch only**

- What becomes possible: operator-controlled batch send.
- What remains blocked: trigger send, unattended automation, trigger installation.
- Can unattended send occur before Jun 1: not if `ENABLE_TRIGGER_SENDS`, `ENABLE_TRIGGER_EMAIL_SENDS`, `ENABLE_AUTOMATED_STAGE_RUNNER` stay false and no trigger is installed.
- Rollback: restore the prior config state that keeps `SYSTEM_STABILIZATION_MODE` and production send gating off, or repin to the previous accepted baseline if a deployment has already been made.

Why not B/C/D yet:

- `Code.js:7829` creates an every-10-minute trigger when the trigger-install path is used; that is not a Jun 1 schedule.
- The current code does not encode a Jun 1 calendar date. Jun 1/month-end trigger safety cannot be guaranteed from code alone if someone later installs a trigger and flips the send flags.
- Manual batch is the smallest change that increases capability without enabling unattended execution.

## Jun 1 Safety Assessment

Code-level safety today is strong because the runner returns a safe no-op when either stabilization is active or the trigger/automation flags are off:

```text
Code.js:7669-7677
if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true || CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) {
  ...
  return { ok: true, action: "automated_stage_batch", result: "SKIPPED", reason: reason, ... };
}
```

But Jun 1/month-end trigger safety is **not fully guaranteed from code alone** because the trigger-install path uses `ScriptApp.newTrigger(fnName).timeBased().everyMinutes(10).create();` and the actual trigger schedule is an operator action outside this source tree.

## Mutation Statement

No email send.
No trigger install/change/delete.
No sheet write.
No Script Properties mutation.
No deployment change.
No code edit in this audit.
