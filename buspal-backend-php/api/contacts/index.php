<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['passenger']);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT * FROM emergency_contacts WHERE passenger_id = ? ORDER BY id');
    $stmt->execute([$me['id']]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) $r['id'] = (int) $r['id'];
    send_json($rows);
}

if ($method === 'POST') {
    $in = body();
    if (empty($in['name']) || empty($in['phone'])) send_error('Name and phone are required.');
    if (!preg_match('/^(?:\+94|0)7\d{8}$/', str_replace([' ', '-'], '', $in['phone']))) {
        send_error('Enter a valid mobile number, e.g. 0771234567.');
    }
    $stmt = $pdo->prepare('INSERT INTO emergency_contacts (passenger_id, name, phone) VALUES (?, ?, ?)');
    $stmt->execute([$me['id'], $in['name'], $in['phone']]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Contact added.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing contact id.');
    $stmt = $pdo->prepare('DELETE FROM emergency_contacts WHERE id = ? AND passenger_id = ?');
    $stmt->execute([$id, $me['id']]);
    send_json(['id' => $id], 200, 'Contact removed.');
}

send_error('Method not allowed.', 405);
