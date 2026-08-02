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
            if ($existing) {
                if (!hash_equals($existing['request_fingerprint'],$fingerprint)) throw new \RuntimeException('Conflicting command replay.');
                $result=json_decode($existing['result_json'],true,512,JSON_THROW_ON_ERROR);
                if (($request['commandType'] ?? '') === 'COMMUNICATION_PREPARE') {
                    $state=$this->db->prepare('SELECT status FROM operations WHERE operation_id=? FOR UPDATE'); $state->execute([$request['operationId']]); $current=$state->fetchColumn();
                    if ($current && $current !== 'PREPARED') { $result['status']=$current; $result['finalized']=true; }
                }
                $result['idempotent']=true; $this->db->commit(); return $result;
            }
            if (($request['commandType'] ?? '') === 'COMMUNICATION_FINALIZE') return $this->finalize($commandId,$idempotencyKey,$request,$fingerprint);
            $operationId=$request['operationId']; $communicationId=$request['payload']['communicationId'] ?? self::id('comm');
            $this->insertCommunication($communicationId,$request); $this->insertPreviewIfBound($communicationId,$request); $this->insertOperation($operationId,$communicationId,$idempotencyKey,$request);
            $prepare = ($request['commandType'] ?? '') === 'COMMUNICATION_PREPARE';
            $result=['commandId'=>$commandId,'operationId'=>$operationId,'communicationId'=>$communicationId,'idempotencyKey'=>$idempotencyKey,'status'=>$prepare ? 'PREPARED' : 'AUTHORIZED','idempotent'=>false];
            if ($prepare) $result += ['applicantId'=>(string)($request['applicantId'] ?? ''),'previewId'=>(string)($request['previewId'] ?? ''),'receiptId'=>(string)($request['receiptId'] ?? ($request['payload']['receiptId'] ?? ''))];
            if ($prepare) {
                $receiptId=(string)$result['receiptId']; $this->insertReceipt($receiptId,$operationId,$communicationId,['legacyOutcome'=>'PREPARED','legacyCode'=>'','technicalTimestamp'=>(string)($request['requestedAt'] ?? ''),'shadowState'=>'PREPARED','uncertaintyState'=>'']);
                $result['eventId']=$this->appendEvent($communicationId,$operationId,$receiptId,'PRE_SEND_PREPARED','ledger','high',['commandId'=>$commandId,'applicantId'=>(string)($request['applicantId'] ?? ''),'previewId'=>(string)($request['previewId'] ?? '')]);
            } elseif (($request['payload']['shadowMode'] ?? false) === true) {
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
                $result['eventId']=$this->appendEvent($communicationId,$operationId,$receiptId,strtoupper($shadowState),'shadow','high',['commandId'=>$commandId,'applicantId'=>(string)($request['applicantId'] ?? ''),'previewFingerprint'=>(string)($shadow['previewFingerprint'] ?? ''),'legacyOutcome'=>(string)($shadow['legacyOutcome'] ?? '')]);
            } elseif (!$prepare) {
                $result['eventId']=$this->appendEvent($communicationId,$operationId,null,'OPERATION_AUTHORIZED','command','high',['commandId'=>$commandId]);
            }
            $this->db->commit(); return $result;
        } catch(\Throwable $e) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $e; }
    }
    private function insertCommunication(string $id,array $r): void { $s=$this->db->prepare('INSERT INTO communications (communication_id,applicant_id,message_type,canonical_recipient,canonical_subject,canonical_body,authority_snapshot,status) VALUES (?,?,?,?,?,?,?,?)'); $p=$r['payload']; $s->execute([$id,$r['applicantId']??null,$p['messageType']??'UNKNOWN',$p['recipient']??null,$p['subject']??null,$p['body']??null,json_encode($r['authorityContext']),$p['communicationStatus']??'AUTHORIZED']); }
    private function insertPreviewIfBound(string $communicationId,array $r): void {
        $previewId = trim((string)($r['previewId'] ?? ''));
        if ($previewId === '') return;
        $p = $r['payload'];
        $shadow = ($p['shadowMode'] ?? false) === true;
        $messageType = (string)($p['templateId'] ?? $p['messageType'] ?? $r['commandType']);
        $fingerprint = (string)($p['previewFingerprint'] ?? hash('sha256', json_encode($p, JSON_THROW_ON_ERROR)));
        $snapshotIdentity = (string)($r['authorityContext']['stateFingerprint'] ?? $fingerprint);
        $requestedAt = (string)($r['requestedAt'] ?? '');
        $s = $this->db->prepare('INSERT INTO previews (preview_id,communication_id,applicant_id,snapshot_identity,message_type,canonical_recipient,canonical_subject,canonical_body,payload_fingerprint,authority_snapshot,status,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(COALESCE(STR_TO_DATE(?,\'%Y-%m-%dT%H:%i:%sZ\'),UTC_TIMESTAMP()), INTERVAL 15 MINUTE))');
        $s->execute([$previewId,$communicationId,(string)($r['applicantId'] ?? ''),$snapshotIdentity,$messageType,$shadow ? '[REDACTED]' : (string)($p['recipient'] ?? ''),$shadow ? '[REDACTED]' : (string)($p['subject'] ?? ''),$shadow ? '[REDACTED]' : (string)($p['body'] ?? ''),$fingerprint,json_encode($r['authorityContext']),$p['previewStatus'] ?? ($shadow ? 'SHADOW_CAPTURED' : 'APPROVED'),$requestedAt]);
    }
    private function insertOperation(string $id,string $communicationId,string $key,array $r): void { $s=$this->db->prepare('INSERT INTO operations (operation_id,preview_id,communication_id,applicant_id,idempotency_key,authority_context,status,started_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP())'); $s->execute([$id,$r['previewId']??null,$communicationId,$r['applicantId']??null,$key,json_encode($r['authorityContext']),$r['payload']['operationStatus']??'AUTHORIZED']); }
    private function insertReceipt(string $receiptId,string $operationId,string $communicationId,array $shadow): void { $s=$this->db->prepare('INSERT INTO receipts (receipt_id,operation_id,communication_id,result,block_code,technical_timestamp,provider,metadata,uncertainty_state) VALUES (?,?,?,?,?,COALESCE(STR_TO_DATE(?,\'%Y-%m-%dT%H:%i:%sZ\'),UTC_TIMESTAMP()),?,?,?)'); $s->execute([$receiptId,$operationId,$communicationId,(string)($shadow['legacyOutcome']??'UNKNOWN'),(string)($shadow['legacyCode']??''),(string)($shadow['technicalTimestamp']??''),'GMAIL',json_encode(['shadowState'=>(string)($shadow['shadowState']??'shadow_recorded'),'previewFingerprint'=>(string)($shadow['previewFingerprint']??''),'channel'=>(string)($shadow['channel']??'EMAIL')]),(string)($shadow['uncertaintyState']??'')]); }
    private function finalize(string $commandId,string $idempotencyKey,array $r,string $fingerprint): array {
        $op=$this->db->prepare('SELECT operation_id,preview_id,communication_id,applicant_id,status FROM operations WHERE operation_id=? FOR UPDATE'); $op->execute([$r['operationId']]); $row=$op->fetch(); if (!$row || $row['status'] !== 'PREPARED') throw new \RuntimeException('Operation is not PREPARED.');
        $p=$r['payload']; $state=(string)($p['finalState'] ?? 'DELIVERY_UNKNOWN'); $allowed=['SENT','DELIVERY_UNKNOWN','FAILED']; if (!in_array($state,$allowed,true)) throw new \InvalidArgumentException('Invalid final state.');
        $receipt=$this->db->prepare('SELECT receipt_id FROM receipts WHERE receipt_id=? AND operation_id=? FOR UPDATE'); $receipt->execute([(string)$r['receiptId'],$row['operation_id']]); if (!$receipt->fetchColumn()) throw new \RuntimeException('Receipt is not bound to the prepared operation.');
        $this->db->prepare('UPDATE operations SET status=?,completed_at=UTC_TIMESTAMP() WHERE operation_id=?')->execute([$state,$row['operation_id']]);
        $this->db->prepare('UPDATE communications SET status=? WHERE communication_id=?')->execute([$state,$row['communication_id']]);
        $this->db->prepare('UPDATE previews SET status=? WHERE preview_id=?')->execute([$state,$row['preview_id']]);
        $this->db->prepare('UPDATE receipts SET result=?,block_code=?,technical_timestamp=COALESCE(STR_TO_DATE(?,\'%Y-%m-%dT%H:%i:%sZ\'),UTC_TIMESTAMP()),provider_message_id=?,provider_thread_id=?,rfc_message_id=?,uncertainty_state=?,metadata=? WHERE receipt_id=? AND operation_id=?')->execute([$state,(string)($p['finalCode']??''),(string)($p['technicalTimestamp']??''),(string)($p['providerMessageId']??''),(string)($p['providerThreadId']??''),(string)($p['rfcMessageId']??''),$state==='DELIVERY_UNKNOWN'?'DELIVERY_UNKNOWN':'',json_encode(['finalState'=>$state,'provider'=>'GMAIL','contentFingerprint'=>(string)($p['contentFingerprint']??'')]),(string)($r['receiptId']??''),$row['operation_id']]);
        $eventType = $state === 'SENT' ? 'GMAIL_SENT' : ($state === 'DELIVERY_UNKNOWN' ? 'DELIVERY_UNKNOWN' : 'GMAIL_FAILED'); $eventId=$this->appendEvent($row['communication_id'],$row['operation_id'],(string)($r['receiptId']??''),$eventType,'gmail',$state==='SENT'?'high':'medium',['commandId'=>$commandId,'applicantId'=>(string)$row['applicant_id'],'providerMessageId'=>(string)($p['providerMessageId']??'')]);
        $ins=$this->db->prepare('INSERT INTO commands (command_id,idempotency_key,command_type,actor,authority_context,request_fingerprint,result_json) VALUES (?,?,?,?,?,?,?)'); $result=['commandId'=>$commandId,'operationId'=>$row['operation_id'],'previewId'=>$row['preview_id'],'communicationId'=>$row['communication_id'],'receiptId'=>(string)($r['receiptId']??''),'eventId'=>$eventId,'idempotencyKey'=>$idempotencyKey,'applicantId'=>(string)$row['applicant_id'],'status'=>$state,'idempotent'=>false]; $ins->execute([$commandId,$idempotencyKey,$r['commandType'],$r['actor'],json_encode($r['authorityContext']),$fingerprint,json_encode($result)]); $this->db->commit(); return $result;
    }
    public function appendEvent(?string $communicationId,?string $operationId,?string $receiptId,string $type,string $source,string $confidence,array $metadata=[]): string { $id=self::id('evt'); $s=$this->db->prepare('INSERT INTO communication_events (event_id,communication_id,operation_id,receipt_id,event_type,event_source,confidence,metadata) VALUES (?,?,?,?,?,?,?,?)'); $s->execute([$id,$communicationId,$operationId,$receiptId,$type,$source,$confidence,json_encode($metadata)]); return $id; }
    public static function id(string $prefix): string { return $prefix.'_'.bin2hex(random_bytes(16)); }
}
