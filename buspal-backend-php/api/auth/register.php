<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') send_error('Method not allowed.', 405);

$in = body();
$name = trim($in['name'] ?? '');
$email = trim($in['email'] ?? '');
$phone = trim($in['phone'] ?? '');
$password = $in['password'] ?? '';

if (!$name || !$email || !$password) send_error('Name, email, and password are required.');
if (strlen($password) < 6) send_error('Password should be at least 6 characters.');
if (!preg_match('/^(?:\+94|0)7\d{8}$/', str_replace([' ', '-'], '', $phone))) {
    send_error('Enter a valid Sri Lankan mobile number, e.g. 0771234567.');
}

$exists = $pdo->prepare('SELECT id FROM accounts WHERE email = ?');
$exists->execute([$email]);
if ($exists->fetch()) send_error('An account with this email already exists.');

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare(
    'INSERT INTO accounts (role, name, email, phone, password_hash, status) VALUES (\'passenger\', ?, ?, ?, ?, \'active\')'
);
$stmt->execute([$name, $email, $phone, $hash]);
$accountId = (int) $pdo->lastInsertId();

$token = create_session($pdo, $accountId);
send_json([
    'token' => $token,
    'accountId' => $accountId,
    'name' => $name,
    'email' => $email,
    'role' => 'PASSENGER',
], 201);
