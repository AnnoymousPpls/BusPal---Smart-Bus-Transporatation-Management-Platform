<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ---- GET: computed due/overdue status per bus (mirrors OpsAPI.getMaintenanceStatus) ----
if ($method === 'GET' && $action === 'status') {
    $buses = $pdo->query('SELECT * FROM buses')->fetchAll();
    $lastServiceStmt = $pdo->prepare('SELECT COALESCE(MAX(odometer), 0) AS last FROM maintenance_log WHERE bus_id = ?');
    $result = [];
    foreach ($buses as $b) {
        $lastServiceStmt->execute([$b['id']]);
        $lastService = (int) $lastServiceStmt->fetch()['last'];
        $interval = (int) $b['maintenance_interval_km'];
        $odometer = (int) $b['odometer'];
        $kmSinceService = $odometer - $lastService;
        $kmUntilDue = $interval - $kmSinceService;
        $level = $kmUntilDue <= 0 ? 'overdue' : ($kmUntilDue <= 1000 ? 'due-soon' : 'ok');
        $result[] = [
            'id' => (int) $b['id'], 'plate' => $b['plate'], 'model' => $b['model'], 'status' => $b['status'],
            'odometer' => $odometer, 'interval' => $interval, 'lastService' => $lastService,
            'kmSinceService' => $kmSinceService, 'kmUntilDue' => $kmUntilDue, 'level' => $level,
        ];
    }
    send_json($result);
}

// ---- GET: service history ----
if ($method === 'GET') {
    $busId = (int) ($_GET['busId'] ?? 0);
    $sql = 'SELECT m.*, b.plate FROM maintenance_log m JOIN buses b ON b.id = m.bus_id';
    $params = [];
    if ($busId) { $sql .= ' WHERE m.bus_id = ?'; $params[] = $busId; }
    $sql .= ' ORDER BY m.log_date DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['id'] = (int) $r['id'];
        $r['busId'] = (int) $r['bus_id'];
        $r['date'] = $r['log_date'];
        $r['odometer'] = (int) $r['odometer'];
        $r['type'] = $r['entry_type'];
        unset($r['bus_id'], $r['log_date'], $r['entry_type']);
    }
    send_json($rows);
}

// ---- POST: log a service, or send-to-maintenance / return-to-service ----
if ($method === 'POST') {
    $in = body();

    if ($action === 'send') {
        $busId = (int) ($in['busId'] ?? 0);
        if (!$busId) send_error('Bus id is required.');
        $pdo->prepare("UPDATE buses SET status = 'maintenance' WHERE id = ?")->execute([$busId]);
        $odo = $pdo->prepare('SELECT odometer FROM buses WHERE id = ?');
        $odo->execute([$busId]);
        $currentOdo = (int) $odo->fetch()['odometer'];
        $pdo->prepare("INSERT INTO maintenance_log (bus_id, log_date, odometer, note, entry_type) VALUES (?, ?, ?, ?, 'sent')")
            ->execute([$busId, date('Y-m-d'), $currentOdo, $in['note'] ?? 'Sent for maintenance']);
        send_json(['busId' => $busId], 200, 'Sent for maintenance.');
    }

    if ($action === 'return') {
        $busId = (int) ($in['busId'] ?? 0);
        if (!$busId) send_error('Bus id is required.');
        $pdo->prepare("UPDATE buses SET status = 'active' WHERE id = ?")->execute([$busId]);
        $pdo->prepare("INSERT INTO maintenance_log (bus_id, log_date, odometer, note, entry_type) VALUES (?, ?, ?, ?, 'returned')")
            ->execute([$busId, $in['date'] ?? date('Y-m-d'), (int) ($in['odometer'] ?? 0), $in['note'] ?? 'Returned to service']);
        send_json(['busId' => $busId], 200, 'Returned to service.');
    }

    if ($action === 'interval') {
        $busId = (int) ($in['busId'] ?? 0);
        if (!$busId) send_error('Bus id is required.');
        $pdo->prepare('UPDATE buses SET maintenance_interval_km = ? WHERE id = ?')
            ->execute([(int) ($in['intervalKm'] ?? 10000), $busId]);
        send_json(['busId' => $busId], 200, 'Interval updated.');
    }

    // default: log a regular service entry
    $busId = (int) ($in['busId'] ?? 0);
    if (!$busId) send_error('Bus id is required.');
    $stmt = $pdo->prepare("INSERT INTO maintenance_log (bus_id, log_date, odometer, note, entry_type) VALUES (?, ?, ?, ?, 'service')");
    $stmt->execute([$busId, $in['date'] ?? date('Y-m-d'), (int) ($in['odometer'] ?? 0), $in['note'] ?? 'Service logged']);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Service logged.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing entry id.');
    $fields = []; $params = [];
    $map = ['date' => 'log_date', 'odometer' => 'odometer', 'note' => 'note'];
    foreach ($map as $jsonKey => $col) {
        if (isset($in[$jsonKey])) { $fields[] = "$col = ?"; $params[] = $in[$jsonKey]; }
    }
    if (!$fields) send_error('Nothing to update.');
    $params[] = $id;
    $pdo->prepare('UPDATE maintenance_log SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    send_json(['id' => $id], 200, 'Service record updated.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing entry id.');
    $pdo->prepare('DELETE FROM maintenance_log WHERE id = ?')->execute([$id]);
    send_json(['id' => $id], 200, 'Service record deleted.');
}

send_error('Method not allowed.', 405);
