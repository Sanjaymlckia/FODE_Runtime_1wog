<?php declare(strict_types=1);
namespace Fode\CommunicationLedger\Database;
use PDO; use Fode\CommunicationLedger\Config\Config;
final class Connection {
    public static function open(Config $c): PDO {
        return new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c->get('db_host'), $c->get('db_port'), $c->get('db_name')), $c->get('db_user'), $c->get('db_password'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    }
}
