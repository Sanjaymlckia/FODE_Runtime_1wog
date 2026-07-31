<?php declare(strict_types=1);
spl_autoload_register(function(string $class): void { $p='Fode\\CommunicationLedger\\'; if(str_starts_with($class,$p)) require dirname(__DIR__).'/src/'.str_replace('\\','/',substr($class,strlen($p))).'.php'; });
use Fode\CommunicationLedger\Config\Config; use Fode\CommunicationLedger\Database\Connection;
function ledger_config(): Config { return Config::load(getenv('LEDGER_CONFIG_FILE') ?: dirname(__DIR__,2).'/communication-ledger-config.php'); }
function ledger_db(): PDO { return Connection::open(ledger_config()); }
