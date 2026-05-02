CIS only. No discussion edits.
Modify only files explicitly allowed in current CIS.
Prefer upstream normalization over repeated null checks.
Do not add defensive branching unless a concrete failure mode exists.
Live `whoami` is runtime truth.
Local source is not proof of live runtime.
Hot paths must avoid repeated sheet scans, repeated resolver calls, redundant guards.
Every release requires exact acceptance URLs and PASS/FAIL checks.
Release incomplete until Admin whoami, Student whoami, and browser checks pass.
When unsure, stop and surface uncertainty instead of guessing.
Rollback prefers deployment repin first.
