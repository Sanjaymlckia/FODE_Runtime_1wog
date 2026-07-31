<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Commands;
use Fode\CommunicationLedger\Ledger\Repository;
final class CommandHandler {
    public function __construct(private Repository $repository) {}
    public function handle(array $request): array {
        foreach(['commandId','commandType','actor','authorityContext','operationId','expectedState','requestedAt','payload'] as $key) if (!array_key_exists($key,$request)) throw new \InvalidArgumentException('Invalid command.');
        if (!isset($request['applicantId']) && !isset($request['cohortId'])) throw new \InvalidArgumentException('Invalid command.');
        if (!is_array($request['payload']) || !is_array($request['authorityContext'])) throw new \InvalidArgumentException('Invalid command.');
        $key=$request['idempotencyKey'] ?? $request['commandId']; if (!is_string($key) || $key==='') throw new \InvalidArgumentException('Invalid command.');
        return $this->repository->command($request['commandId'],$key,$request);
    }
}
