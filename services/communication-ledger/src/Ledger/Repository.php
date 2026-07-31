<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Ledger;
use PDO; use PDOException;
final class Repository {
    public function __construct(private PDO $db) {}
    public function recordNonce(string $keyId, string $nonce, int $expiresAt): void {
        try { $s=$this->db->prepare('INSERT INTO api_nonces (key_id, nonce, expires_at) VALUES (?, ?, FROM_UNIXTIME(?))'); $s->execute([$keyId,$nonce,$expiresAt]); }
        catch(PDOException $e) { if ($e->getCode()==='23000') throw new \RuntimeException('Authentication failed.'); throw $e; }
    }
    public function schemaVersion(): ?string { return $this->db->query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')->fetchColumn() ?: null; }
    public function command(string $commandId, string $idempotencyKey, array $request): array {
        $fingerprint=hash('sha256', json_encode($request, JSON_THROW_ON_ERROR)); $this->db->beginTransaction();
        try {
            $s=$this->db->prepare('SELECT request_fingerprint, result_json FROM commands WHERE command_id=? OR idempotency_key=? FOR UPDATE'); $s->execute([$commandId,$idempotencyKey]); $existing=$s->fetch();
            if ($existing) { if (!hash_equals($existing['request_fingerprint'],$fingerprint)) throw new \RuntimeException('Conflicting command replay.'); $result=json_decode($existing['result_json'],true,512,JSON_THROW_ON_ERROR); $result['idempotent']=true; $this->db->commit(); return $result; }
            $operationId=$request['operationId']; $communicationId=$request['payload']['communicationId'] ?? self::id('comm');
            $this->insertCommunication($communicationId,$request); $this->insertOperation($operationId,$communicationId,$idempotencyKey,$request);
            $result=['commandId'=>$commandId,'operationId'=>$operationId,'communicationId'=>$communicationId,'status'=>'AUTHORIZED','idempotent'=>false];
            if (($request['payload']['shadowMode'] ?? false) === true) {
                $shadow = $request['payload'];
                $shadowState = (string)($shadow['shadowState'] ?? 'shadow_recorded');
                $receiptId = (string)($shadow['receiptId'] ?? self::id('receipt'));
                $result += ['shadowState'=>$shadowState,'applicantId'=>(string)($request['applicantId'] ?? ''),'previewId'=>(string)($request['previewId'] ?? ''),'receiptId'=>$receiptId,'channel'=>(string)($shadow['channel'] ?? 'EMAIL'),'legacyOutcome'=>(string)($shadow['legacyOutcome'] ?? ''),'technicalTimestamp'=>(string)($shadow['technicalTimestamp'] ?? '')];
            }
            $ins=$this->db->prepare('INSERT INTO commands (command_id,idempotency_key,command_type,actor,authority_context,request_fingerprint,result_json) VALUES (?,?,?,?,?,?,?)');
            $ins->execute([$commandId,$idempotencyKey,$request['commandType'],$request['actor'],json_encode($request['authorityContext']),$fingerprint,json_encode($result)]);
            if (($request['payload']['shadowMode'] ?? false) === true) {
                $shadow = $request['payload'];
                $shadowState = (string)($shadow['shadowState'] ?? 'shadow_recorded');
                $receiptId = (string)$result['receiptId'];
                $this->insertReceipt($receiptId,$operationId,$communicationId,$shadow);
                $this->appendEvent($communicationId,$operationId,$receiptId,strtoupper($shadowState),'shadow','high',['commandId'=>$commandId,'applicantId'=>(string)($request['applicantId'] ?? ''),'previewFingerprint'=>(string)($shadow['previewFingerprint'] ?? ''),'legacyOutcome'=>(string)($shadow['legacyOutcome'] ?? '')]);
            } else {
                $this->appendEvent($communicationId,$operationId,null,'OPERATION_AUTHORIZED','command','high',['commandId'=>$commandId]);
            }
            $this->db->commit(); return $result;
        } catch(\Throwable $e) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $e; }
    }
    private function insertCommunication(string $id,array $r): void { $s=$this->db->prepare('INSERT INTO communications (communication_id,applicant_id,message_type,canonical_recipient,canonical_subject,canonical_body,authority_snapshot,status) VALUES (?,?,?,?,?,?,?,?)'); $p=$r['payload']; $s->execute([$id,$r['applicantId']??null,$p['messageType']??'UNKNOWN',$p['recipient']??null,$p['subject']??null,$p['body']??null,json_encode($r['authorityContext']),'AUTHORIZED']); }
    private function insertOperation(string $id,string $communicationId,string $key,array $r): void { $s=$this->db->prepare('INSERT INTO operations (operation_id,preview_id,communication_id,applicant_id,idempotency_key,authority_context,status,started_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())'); $s->execute([$id,$r['previewId']??null,$communicationId,$r['applicantId']??null,$key,json_encode($r['authorityContext']),'AUTHORIZED']); }
    private function insertReceipt(string $receiptId,string $operationId,string $communicationId,array $shadow): void { $s=$this->db->prepare('INSERT INTO receipts (receipt_id,operation_id,communication_id,result,block_code,technical_timestamp,provider,metadata,uncertainty_state) VALUES (?,?,?,?,?,COALESCE(STR_TO_DATE(?,\'%Y-%m-%dT%H:%i:%sZ\'),UTC_TIMESTAMP()),?,?,?)'); $s->execute([$receiptId,$operationId,$communicationId,(string)($shadow['legacyOutcome']??'UNKNOWN'),(string)($shadow['legacyCode']??''),(string)($shadow['technicalTimestamp']??''),'GMAIL',json_encode(['shadowState'=>(string)($shadow['shadowState']??'shadow_recorded'),'previewFingerprint'=>(string)($shadow['previewFingerprint']??''),'channel'=>(string)($shadow['channel']??'EMAIL')]),(string)($shadow['uncertaintyState']??'')]); }
    public function appendEvent(?string $communicationId,?string $operationId,?string $receiptId,string $type,string $source,string $confidence,array $metadata=[]): string { $id=self::id('evt'); $s=$this->db->prepare('INSERT INTO communication_events (event_id,communication_id,operation_id,receipt_id,event_type,event_source,confidence,metadata) VALUES (?,?,?,?,?,?,?,?)'); $s->execute([$id,$communicationId,$operationId,$receiptId,$type,$source,$confidence,json_encode($metadata)]); return $id; }
    public static function id(string $prefix): string { return $prefix.'_'.bin2hex(random_bytes(16)); }
}
