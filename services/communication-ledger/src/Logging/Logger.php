<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Logging;
final class Logger {
    public function __construct(private string $path) {}
    public function write(array $record): void {
        unset($record['password'],$record['secret'],$record['authorization'],$record['body'],$record['nonce']);
        $record['timestamp'] = gmdate('c');
        error_log(json_encode($record, JSON_UNESCAPED_SLASHES).PHP_EOL, 3, $this->path);
    }
}
