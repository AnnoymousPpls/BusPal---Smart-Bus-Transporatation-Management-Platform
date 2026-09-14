<?php
/**
 * Run once in your browser: http://localhost/buspal-backend-php/seed.php
 * Safe to reload — skips any account whose email already exists.
 * Delete this file (or move it outside the web root) once you're done
 * with it; there's no reason a seed script needs to stay reachable.
 */

require_once __DIR__ . '/config/db.php';

header('Content-Type: text/plain');

function seed_account(PDO $pdo, string $role, string $name, string $email, string $phone, string $password, ?int $addedBy = null): void {
    $exists = $pdo->prepare('SELECT id FROM accounts WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        echo "Skipped (already exists): $email\n";
        return;
    }
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO accounts (role, name, email, phone, password_hash, status, added_by) VALUES (?, ?, ?, ?, ?, \'active\', ?)');
    $stmt->execute([$role, $name, $email, $phone, $hash, $addedBy]);
    echo "Created: $email (id " . $pdo->lastInsertId() . ")\n";
}

seed_account($pdo, 'passenger', 'R. Kavishali', 'kavishali@example.com', '077 123 4567', 'demo123');
seed_account($pdo, 'owner', 'L. Prathap', 'ops@btexpress.lk', '077 010 1107', 'demo123');

$owner = $pdo->prepare('SELECT id FROM accounts WHERE email = ?');
$owner->execute(['ops@btexpress.lk']);
$ownerId = $owner->fetch()['id'] ?? null;

seed_account($pdo, 'manager', 'N. Silva', 'manager@btexpress.lk', '071 555 3322', 'demo123', $ownerId);

echo "\nDone. Demo logins (all password: demo123):\n";
echo "  Passenger: kavishali@example.com\n";
echo "  Owner:     ops@btexpress.lk\n";
echo "  Manager:   manager@btexpress.lk\n";
