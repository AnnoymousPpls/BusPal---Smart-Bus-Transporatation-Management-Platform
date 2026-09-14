<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $staff = $pdo->query('SELECT * FROM staff ORDER BY role, name')->fetchAll();
    foreach ($staff as &$s) {
        $s['id'] = (int) $s['id'];
        $s['photoVisible'] = (bool) $s['photo_visible'];
        unset($s['photo_visible']);
    }
    send_json($staff);
}

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

if ($method === 'POST') {
    $in = body();
    if (empty($in['name']) || empty($in['role'])) send_error('Name and role are required.');
    $stmt = $pdo->prepare(
        'INSERT INTO staff (name, role, phone, ntc_license, driving_license, license_expiry, photo_visible, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $in['name'], $in['role'], $in['phone'] ?? null, $in['ntcLicense'] ?? null,
        $in['drivingLicense'] ?? null, $in['licenseExpiry'] ?? null,
        !empty($in['photoVisible']) ? 1 : 0, $in['status'] ?? 'active',
    ]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Staff added.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing staff id.');
    $fields = []; $params = [];
    $map = ['name' => 'name', 'role' => 'role', 'phone' => 'phone', 'ntcLicense' => 'ntc_license',
            'drivingLicense' => 'driving_license', 'licenseExpiry' => 'license_expiry',
            'photoVisible' => 'photo_visible', 'status' => 'status'];
    foreach ($map as $jsonKey => $col) {
        if (isset($in[$jsonKey])) { $fields[] = "$col = ?"; $params[] = $in[$jsonKey]; }
    }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE staff SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['id' => $id], 200, 'Staff updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing staff id.');
    $pdo->prepare('DELETE FROM staff WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Staff removed.');
}

send_error('Method not allowed.', 405);
