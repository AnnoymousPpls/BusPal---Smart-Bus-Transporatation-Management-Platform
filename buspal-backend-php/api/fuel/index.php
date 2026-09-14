<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

$method = $_SERVER['REQUEST_METHOD'];

function fetch_fuel_log(PDO $pdo): array {
    $stmt = $pdo->query(
        'SELECT f.*, b.plate FROM fuel_log f JOIN buses b ON b.id = f.bus_id ORDER BY f.log_date DESC'
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['busId'] = (int) $r['bus_id'];
        $r['date'] = $r['log_date'];
        $r['odometer'] = (int) $r['odometer'];
        $r['liters'] = (float) $r['liters'];
        $r['cost'] = (int) $r['cost'];
        unset($r['bus_id'], $r['log_date']);
    }
    return $rows;
}

if ($method === 'GET') {
    send_json(fetch_fuel_log($pdo));
}

if ($method === 'POST') {
    $in = body();
    $busId = (int) ($in['busId'] ?? 0);
    if (!$busId) send_error('Bus id is required.');
    $stmt = $pdo->prepare('INSERT INTO fuel_log (bus_id, log_date, liters, cost, odometer, station) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $busId, $in['date'] ?? date('Y-m-d'), (float) ($in['liters'] ?? 0),
        (int) ($in['cost'] ?? 0), (int) ($in['odometer'] ?? 0), $in['station'] ?? '',
    ]);
    if (!empty($in['odometer'])) {
        $pdo->prepare('UPDATE buses SET odometer = GREATEST(odometer, ?) WHERE id = ?')->execute([(int) $in['odometer'], $busId]);
    }
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Fuel entry logged.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing entry id.');
    $fields = []; $params = [];
    $map = ['busId' => 'bus_id', 'date' => 'log_date', 'liters' => 'liters', 'cost' => 'cost', 'odometer' => 'odometer', 'station' => 'station'];
    foreach ($map as $jsonKey => $col) {
        if (isset($in[$jsonKey])) { $fields[] = "$col = ?"; $params[] = $in[$jsonKey]; }
    }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE fuel_log SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

    if (!empty($in['odometer']) && !empty($in['busId'])) {
        $pdo->prepare('UPDATE buses SET odometer = GREATEST(odometer, ?) WHERE id = ?')->execute([(int) $in['odometer'], (int) $in['busId']]);
    }
    send_json(['id' => $id], 200, 'Fuel entry updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing entry id.');
    $pdo->prepare('DELETE FROM fuel_log WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Fuel entry deleted.');
}

send_error('Method not allowed.', 405);
