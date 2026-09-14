<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT id, name, email, phone, role FROM accounts WHERE status = 'pending' ORDER BY id");
    send_json($stmt->fetchAll());
}

if ($method === 'POST') {
    // action: "approve" or "reject"
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    $action = $in['action'] ?? '';
    if (!$id || !in_array($action, ['approve', 'reject'], true)) send_error('Invalid request.');

    $stmt = $pdo->prepare("SELECT * FROM accounts WHERE id = ? AND status = 'pending'");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) send_error('Request not found (already handled?).', 404);

    if ($action === 'approve') {
        $role = in_array($in['role'] ?? '', ['owner', 'manager'], true) ? $in['role'] : $row['role'];
        $pdo->prepare("UPDATE accounts SET status = 'active', role = ? WHERE id = ?")->execute([$role, $id]);
        send_json(['id' => $id], 200, 'Approved — they can now log in.');
    } else {
        $pdo->prepare('DELETE FROM accounts WHERE id = ?')->execute([$id]);
        send_json(['id' => $id], 200, 'Request rejected.');
    }
}

send_error('Method not allowed.', 405);
