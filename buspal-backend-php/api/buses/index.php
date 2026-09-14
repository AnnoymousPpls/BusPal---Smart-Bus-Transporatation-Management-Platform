<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];

// Reading the fleet is public (matches the website: passengers see bus
// photos on Book a Trip without needing to log in). Writes are owner/manager only.
if ($method === 'GET') {
    $buses = $pdo->query('SELECT * FROM buses ORDER BY plate')->fetchAll();
    $photoStmt = $pdo->prepare(
    'SELECT id, photo_path FROM bus_photos WHERE bus_id = ? ORDER BY sort_order'
);
    foreach ($buses as &$b) {
        $photoStmt->execute([$b['id']]);
       $b['photos'] = array_map(
    fn($photo) => [
        'id' => (int) $photo['id'],
        'path' => $photo['photo_path'],
    ],
    $photoStmt->fetchAll()
);
        $b['id'] = (int) $b['id'];
        $b['capacity'] = (int) $b['capacity'];
        $b['odometer'] = (int) $b['odometer'];
        $b['maintenanceIntervalKm'] = (int) $b['maintenance_interval_km'];
        unset($b['maintenance_interval_km']);
    }
    send_json($buses);
}

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

if ($method === 'POST') {
    $in = body();
    if (empty($in['plate']) || empty($in['model'])) send_error('Plate and model are required.');
    $stmt = $pdo->prepare(
        'INSERT INTO buses (plate, model, type, capacity, fuel_type, odometer, status, maintenance_interval_km)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        strtoupper(trim($in['plate'])), $in['model'], $in['type'] ?? 'AC Luxury',
        (int) ($in['capacity'] ?? 40), $in['fuelType'] ?? 'Diesel', (int) ($in['odometer'] ?? 0),
        $in['status'] ?? 'active', (int) ($in['maintenanceIntervalKm'] ?? 10000),
    ]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Bus added.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing bus id.');
    $fields = []; $params = [];
    $map = ['plate' => 'plate', 'model' => 'model', 'type' => 'type', 'capacity' => 'capacity',
            'fuelType' => 'fuel_type', 'odometer' => 'odometer', 'status' => 'status',
            'maintenanceIntervalKm' => 'maintenance_interval_km'];
    foreach ($map as $jsonKey => $col) {
        if (isset($in[$jsonKey])) { $fields[] = "$col = ?"; $params[] = $in[$jsonKey]; }
    }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE buses SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['id' => $id], 200, 'Bus updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing bus id.');
    $pdo->prepare('DELETE FROM buses WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Bus deleted.');
}

send_error('Method not allowed.', 405);
