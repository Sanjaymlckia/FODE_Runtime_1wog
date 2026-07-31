<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Http;
final class Response { public static function json(int $status, array $body): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($body, JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); exit; } }
