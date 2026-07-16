function eduopsWithOperationLock_(operation, applicantId, callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("OPERATION_LOCKED: another guarded operation is in progress");
  try {
    return callback({ operation: eduopsUpper_(operation, "UNKNOWN"), applicantId: eduopsClean_(applicantId || "COHORT") });
  } finally {
    lock.releaseLock();
  }
}
