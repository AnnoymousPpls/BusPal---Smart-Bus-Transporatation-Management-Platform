<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error('Method not allowed.', 405);
}

$account = require_auth($pdo);

$in = body();

$currentPassword = $in['currentPassword'] ?? '';
$newPassword = $in['newPassword'] ?? '';

if (!$currentPassword || !$newPassword) {
    send_error('Current password and new password are required.');
}

/*
 * Verify the current password.
 */
if (!password_verify($currentPassword, $account['password_hash'])) {
    send_error('Current password is incorrect.', 401);
}

/*
 * Basic password validation.
 */
if (strlen($newPassword) < 8) {
    send_error('New password must be at least 8 characters long.');
}

/*
 * Prevent using the same password.
 */
if (password_verify($newPassword, $account['password_hash'])) {
    send_error('New password must be different from your current password.');
}

/*
 * Hash and save the new password.
 */
$newHash = password_hash($newPassword, PASSWORD_BCRYPT);

$stmt = $pdo->prepare(
    'UPDATE accounts SET password_hash = ? WHERE id = ?'
);

$stmt->execute([
    $newHash,
    $account['id']
]);


$pdo->prepare(
    'DELETE FROM auth_tokens WHERE account_id = ?'
)->execute([
    $account['id']
]);

send_json([
    'message' => 'Password changed successfully. Please log in again.'
]);