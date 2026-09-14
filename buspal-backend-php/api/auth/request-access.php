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
    "INSERT INTO accounts (role, name, email, phone, password_hash, status) VALUES ('manager', ?, ?, ?, ?, 'pending')"
);
$stmt->execute([$name, $email, $phone, $hash]);

// Deliberately no token here — pending accounts can't log in yet (see login.php's status check).
send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Request sent — an Owner needs to approve it before you can log in.');
