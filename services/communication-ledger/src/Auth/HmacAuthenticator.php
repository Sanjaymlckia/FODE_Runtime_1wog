<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Auth;
use Fode\CommunicationLedger\Config\Config; use Fode\CommunicationLedger\Ledger\Repository;
final class HmacAuthenticator {
    public function __construct(private Config $config, private Repository $repository) {}
    public function verify(string $method, string $path, string $body, array $headers): void {
        foreach (['x-ledger-key-id','x-ledger-timestamp','x-ledger-nonce','x-ledger-body-sha256','x-ledger-signature'] as $h) if (empty($headers[$h])) throw new \RuntimeException('Authentication failed.');
        if (!hash_equals((string)$this->config->get('api_key_id'), (string)$headers['x-ledger-key-id'])) throw new \RuntimeException('Authentication failed.');
        if (!preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', $headers['x-ledger-timestamp'])) throw new \RuntimeException('Authentication failed.');
        $when = strtotime($headers['x-ledger-timestamp']);
        if ($when === false || abs(time() - $when) > (int)$this->config->get('request_clock_skew_seconds')) throw new \RuntimeException('Authentication failed.');
        $hash = CanonicalRequest::bodyHash($body);
        if (!hash_equals($hash, $headers['x-ledger-body-sha256'])) throw new \RuntimeException('Authentication failed.');
        $canonical = CanonicalRequest::string($headers['x-ledger-key-id'], $headers['x-ledger-timestamp'], $headers['x-ledger-nonce'], $method, $path, $hash);
        if (!hash_equals(CanonicalRequest::sign($this->config->get('api_signing_secret'), $canonical), $headers['x-ledger-signature'])) throw new \RuntimeException('Authentication failed.');
        $this->repository->recordNonce($headers['x-ledger-key-id'], $headers['x-ledger-nonce'], $when + (int)$this->config->get('nonce_ttl_seconds'));
    }
}
