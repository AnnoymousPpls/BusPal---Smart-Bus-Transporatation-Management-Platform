<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Method not allowed.', 405);

$in = body();

// Two modes on one endpoint: self-service by email (no auth needed — this
// IS the "I forgot it" flow), or owner-triggered reset by account id (auth
// required, owner-only). Exactly one of `email` or `id` should be sent.
if (!empty($in['email'])) {
    $stmt = $pdo->prepare('SELECT id FROM accounts WHERE email = ?');
    $stmt->execute([trim($in['email'])]);
    $account = $stmt->fetch();
    if (!$account) send_error('No account found with that email.', 404);
    $targetId = (int) $account['id'];
} elseif (!empty($in['id'])) {
    $me = require_auth($pdo);
    require_role($me, ['owner']);
    $targetId = (int) $in['id'];
} else {
    send_error('Provide either an email or an account id.');
}

$tempPassword = 'reset-' . substr(bin2hex(random_bytes(4)), 0, 8);
$hash = password_hash($tempPassword, PASSWORD_BCRYPT);
$pdo->prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')->execute([$hash, $targetId]);

// Also invalidate any existing sessions for this account, since the old password no longer applies.
$pdo->prepare('DELETE FROM auth_tokens WHERE account_id = ?')->execute([$targetId]);

send_json(['tempPassword' => $tempPassword]);
