<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Config;
use RuntimeException;
final class Config {
    private array $v;
    private const REQUIRED = ['environment','db_host','db_port','db_name','db_user','db_password','api_key_id','api_signing_secret','nonce_ttl_seconds','request_clock_skew_seconds','log_path','backup_path','service_version'];
    private const SETTINGS = ['environment'=>'LEDGER_ENVIRONMENT','db_host'=>'LEDGER_DB_HOST','db_port'=>'LEDGER_DB_PORT','db_name'=>'LEDGER_DB_NAME','db_user'=>'LEDGER_DB_USER','db_password'=>'LEDGER_DB_PASSWORD','api_key_id'=>'LEDGER_API_KEY_ID','api_signing_secret'=>'LEDGER_API_SIGNING_SECRET','nonce_ttl_seconds'=>'LEDGER_NONCE_TTL_SECONDS','request_clock_skew_seconds'=>'LEDGER_REQUEST_CLOCK_SKEW_SECONDS','log_path'=>'LEDGER_LOG_PATH','backup_path'=>'LEDGER_BACKUP_PATH','service_version'=>'LEDGER_SERVICE_VERSION','contract_version'=>'LEDGER_CONTRACT_VERSION'];
    private function __construct(array $values) { $this->v = $values; }
    public static function load(string $path): self {
        if (!is_file($path)) throw new RuntimeException('Protected configuration is unavailable.');
        $values = require $path;
        if (!is_array($values)) throw new RuntimeException('Protected configuration is invalid.');
        foreach (self::SETTINGS as $internal => $external) if (!array_key_exists($internal, $values) && array_key_exists($external, $values)) $values[$internal] = $values[$external];
        foreach (self::REQUIRED as $key) if (!array_key_exists($key, $values) || $values[$key] === '' || str_starts_with((string)$values[$key], 'REPLACE_')) throw new RuntimeException('Required configuration is unavailable.');
        if (!array_key_exists('contract_version', $values) || $values['contract_version'] === '') $values['contract_version'] = '1.0';
        if ((string)$values['contract_version'] !== '1.0') throw new RuntimeException('Unsupported communication-ledger contract version.');
        return new self($values);
    }
    public function get(string $key): mixed { return $this->v[$key] ?? throw new RuntimeException('Unknown configuration key.'); }
}
