<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];

function fetch_routes(PDO $pdo, bool $visibleOnly = false): array {
    $sql = 'SELECT * FROM routes' . ($visibleOnly ? ' WHERE visible = 1' : '') . ' ORDER BY from_city, to_city';
    $routes = $pdo->query($sql)->fetchAll();
    $depStmt = $pdo->prepare(
        'SELECT d.*, b.plate AS bus_plate, drv.name AS driver_name, cond.name AS conductor_name
         FROM departures d
         LEFT JOIN buses b ON b.id = d.bus_id
         LEFT JOIN staff drv ON drv.id = d.driver_id
         LEFT JOIN staff cond ON cond.id = d.conductor_id
         WHERE d.route_id = ? ORDER BY d.time'
    );
    foreach ($routes as &$r) {
        $r['id'] = (int) $r['id'];
        $r['visible'] = (bool) $r['visible'];
        $depStmt->execute([$r['id']]);
        $r['departures'] = array_map(function ($d) {
            $d['id'] = (int) $d['id'];
            $d['busId'] = $d['bus_id'] ? (int) $d['bus_id'] : null;
            $d['driverId'] = $d['driver_id'] ? (int) $d['driver_id'] : null;
            $d['conductorId'] = $d['conductor_id'] ? (int) $d['conductor_id'] : null;
            return $d;
        }, $depStmt->fetchAll());
    }
    return $routes;
}

// Public: passengers browse visible routes without logging in (matches /routes/public on the old Spring backend).
if ($method === 'GET' && ($_GET['scope'] ?? '') === 'public') {
    send_json(fetch_routes($pdo, true));
}

if ($method === 'GET') {
    send_json(fetch_routes($pdo, false));
}

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

if ($method === 'POST') {
    $in = body();
    if (empty($in['from']) || empty($in['to'])) send_error('From and to cities are required.');
    $stmt = $pdo->prepare('INSERT INTO routes (from_city, to_city, distance_km, fare, visible) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$in['from'], $in['to'], (int) ($in['distanceKm'] ?? 0), (int) ($in['fare'] ?? 0), !empty($in['visible']) ? 1 : 0]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Route added.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing route id.');
    if (($in['action'] ?? '') === 'toggle-visible') {
        $pdo->prepare('UPDATE routes SET visible = NOT visible WHERE id = ?')->execute([$id]);
        send_json(['id' => $id], 200, 'Visibility updated.');
    }
    $fields = []; $params = [];
    $map = ['from' => 'from_city', 'to' => 'to_city', 'distanceKm' => 'distance_km', 'fare' => 'fare'];
    foreach ($map as $jsonKey => $col) {
        if (isset($in[$jsonKey])) { $fields[] = "$col = ?"; $params[] = $in[$jsonKey]; }
    }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE routes SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['id' => $id], 200, 'Route updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing route id.');
    $pdo->prepare('DELETE FROM routes WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Route deleted.');
}

send_error('Method not allowed.', 405);
