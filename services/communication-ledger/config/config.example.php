<?php
// Copy outside the document root as config.php; values here are placeholders only.
return [
    'LEDGER_ENVIRONMENT' => 'staging', 'LEDGER_DB_HOST' => '127.0.0.1', 'LEDGER_DB_PORT' => 3306,
    'LEDGER_DB_NAME' => 'REPLACE_ME', 'LEDGER_DB_USER' => 'REPLACE_ME', 'LEDGER_DB_PASSWORD' => 'REPLACE_ME',
    'LEDGER_API_KEY_ID' => 'REPLACE_ME', 'LEDGER_API_SIGNING_SECRET' => 'REPLACE_ME',
    'LEDGER_NONCE_TTL_SECONDS' => 900, 'LEDGER_REQUEST_CLOCK_SKEW_SECONDS' => 300,
    'LEDGER_LOG_PATH' => '/protected/path/communication-ledger.log',
    'LEDGER_BACKUP_PATH' => '/protected/path/backups',
    'LEDGER_SERVICE_VERSION' => '0.1.0-r390b4',
];
