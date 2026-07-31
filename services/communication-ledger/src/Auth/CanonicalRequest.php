<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Auth;
final class CanonicalRequest {
    public static function bodyHash(string $body): string { return hash('sha256', $body); }
    public static function string(string $keyId, string $timestamp, string $nonce, string $method, string $path, string $bodyHash): string { return implode("\n", [$keyId, $timestamp, $nonce, strtoupper($method), $path, $bodyHash]); }
    public static function sign(string $secret, string $canonical): string { return hash_hmac('sha256', $canonical, $secret); }
}
