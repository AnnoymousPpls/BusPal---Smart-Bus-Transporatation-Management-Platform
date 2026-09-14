<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $in = body();
    $routeId = (int) ($in['routeId'] ?? 0);
    $time = $in['time'] ?? '';
    if (!$routeId || !$time) send_error('Route id and time are required.');
    $stmt = $pdo->prepare('INSERT INTO departures (route_id, time) VALUES (?, ?)');
    $stmt->execute([$routeId, $time]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Departure added.');
}

if ($method === 'PATCH') {
    // Used for both time edits and bus/driver/conductor assignment — same shape, different fields sent.
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing departure id.');
    $fields = []; $params = [];
    $map = ['time' => 'time', 'busId' => 'bus_id', 'driverId' => 'driver_id', 'conductorId' => 'conductor_id'];
    foreach ($map as $jsonKey => $col) {
        if (array_key_exists($jsonKey, $in)) { $fields[] = "$col = ?"; $params[] = $in[$jsonKey] ?: null; }
    }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE departures SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['id' => $id], 200, 'Departure updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing departure id.');
    $pdo->prepare('DELETE FROM departures WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Departure removed.');
}

send_error('Method not allowed.', 405);
