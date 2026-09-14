<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function tracking_row(array $t): array {
    return [
        'id' => (int) $t['id'], 'from' => $t['from_city'], 'to' => $t['to_city'], 'date' => $t['travel_date'],
        'depTime' => substr($t['dep_time'], 0, 5), 'busPlate' => $t['bus_plate'], 'driverName' => $t['driver_name'],
        'conductorName' => $t['conductor_name'], 'status' => $t['status'],
        'currentStopIndex' => (int) $t['current_stop_index'], 'etaMinutes' => (int) $t['eta_minutes'],
        'visible' => (bool) $t['visible'], 'stops' => json_decode($t['stops'], true) ?: [], 'updatedAt' => $t['updated_at'],
    ];
}

// ---- Passenger: find the active, visible tracking session matching one of their own upcoming bookings ----
if ($method === 'GET' && $me['role'] === 'passenger') {
    $stmt = $pdo->prepare(
        "SELECT * FROM bookings WHERE passenger_id = ? AND status = 'upcoming'"
    );
    $stmt->execute([$me['id']]);
    foreach ($stmt->fetchAll() as $b) {
        $t = $pdo->prepare(
            "SELECT * FROM live_tracking WHERE status = 'in-progress' AND visible = 1
             AND from_city = ? AND to_city = ? AND travel_date = ? AND dep_time = ?"
        );
        $t->execute([$b['from_city'], $b['to_city'], $b['travel_date'], $b['dep_time']]);
        $row = $t->fetch();
        if ($row) {
            $result = tracking_row($row);
            $result['bookingId'] = (int) $b['id'];
            $result['bookingPnr'] = $b['pnr'];
            send_json($result);
        }
    }
    send_json(null);
}

// Everything else is operator-only.
require_role($me, ['owner', 'manager']);

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT * FROM live_tracking ORDER BY updated_at DESC');
    send_json(array_map('tracking_row', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $in = body();
    $stops = $in['stops'] ?? [];
    if (empty($in['from']) || empty($in['to']) || !$stops) send_error('from, to, and stops are required.');
    $stopObjs = array_map(fn($name, $i) => ['name' => $name, 'status' => $i === 0 ? 'current' : 'pending'], $stops, array_keys($stops));

    $stmt = $pdo->prepare(
        "INSERT INTO live_tracking (route_id, departure_id, from_city, to_city, travel_date, dep_time,
            bus_plate, driver_name, conductor_name, status, current_stop_index, eta_minutes, visible, stops)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'in-progress', 0, ?, 1, ?)"
    );
    $stmt->execute([
        $in['routeId'] ?? null, $in['depId'] ?? null, $in['from'], $in['to'], $in['date'] ?? date('Y-m-d'),
        $in['depTime'], $in['busPlate'] ?? null, $in['driverName'] ?? null, $in['conductorName'] ?? null,
        (int) ($in['etaMinutes'] ?? 30), json_encode($stopObjs),
    ]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Tracking started.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing tracking id.');

    if ($action === 'advance') {
        $stmt = $pdo->prepare('SELECT stops, current_stop_index FROM live_tracking WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) send_error('Not found.', 404);
        $stops = json_decode($row['stops'], true);
        $next = (int) $row['current_stop_index'] + 1;
        foreach ($stops as $i => &$s) {
            $s['status'] = $i < $next ? 'done' : ($i === $next ? 'current' : 'pending');
        }
        $status = $next >= count($stops) - 1 ? 'completed' : 'in-progress';
        if ($status === 'completed') $stops[count($stops) - 1]['status'] = 'done';
        $pdo->prepare('UPDATE live_tracking SET stops = ?, current_stop_index = ?, status = ? WHERE id = ?')
            ->execute([json_encode($stops), $next, $status, $id]);
        send_json(['id' => $id], 200, 'Advanced to next stop.');
    }

    if ($action === 'toggle-visible') {
        $pdo->prepare('UPDATE live_tracking SET visible = NOT visible WHERE id = ?')->execute([$id]);
        send_json(['id' => $id], 200, 'Visibility updated.');
    }

    $fields = []; $params = [];
    if (isset($in['etaMinutes'])) { $fields[] = 'eta_minutes = ?'; $params[] = (int) $in['etaMinutes']; }
    if (isset($in['status'])) { $fields[] = 'status = ?'; $params[] = $in['status']; }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE live_tracking SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['id' => $id], 200, 'Updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing tracking id.');
    $pdo->prepare('DELETE FROM live_tracking WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Record deleted.');
}

send_error('Method not allowed.', 405);
