<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Method not allowed.', 405);

$in = body();
$email = trim($in['email'] ?? '');
$password = $in['password'] ?? '';
if (!$email || !$password) send_error('Email and password are required.');

$stmt = $pdo->prepare('SELECT * FROM accounts WHERE email = ?');
$stmt->execute([$email]);
$account = $stmt->fetch();

if (!$account || !password_verify($password, $account['password_hash'])) {
    send_error('Incorrect email or password.', 401);
}
if ($account['status'] === 'pending') {
    send_error("Your account is awaiting approval from the Owner. You'll be able to log in once it's approved.", 403);
}

$token = create_session($pdo, (int) $account['id']);
send_json([
    'token' => $token,
    'accountId' => (int) $account['id'],
    'name' => $account['name'],
    'email' => $account['email'],
    'role' => strtoupper($account['role']),
]);
