<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
$method = $_SERVER['REQUEST_METHOD'];

function sos_row(array $s): array {
    return [
        'id' => (int) $s['id'],
        'trip' => $s['trip_ref'],
        'note' => $s['note'],
        'status' => $s['status'],
        'passengerName' => $s['passenger_name'],
        'createdAt' => $s['created_at'],
    ];
}

/* ============================================================
   GET
   Passenger  → own SOS alerts
   Owner/Manager → all SOS alerts
   ============================================================ */

if ($method === 'GET') {

    if ($me['role'] === 'passenger') {

        $stmt = $pdo->prepare(
            'SELECT *
             FROM sos_alerts
             WHERE passenger_id = ?
             ORDER BY created_at DESC'
        );

        $stmt->execute([$me['id']]);

        send_json(
            array_map(
                'sos_row',
                $stmt->fetchAll()
            )
        );
    }

    require_role($me, ['owner', 'manager']);

    if (($_GET['count'] ?? '') === '1') {

        $open = $pdo->query(
            "SELECT COUNT(*) AS c
             FROM sos_alerts
             WHERE status = 'open'"
        )->fetch()['c'];

        send_json([
            'openCount' => (int) $open
        ]);
    }

    $stmt = $pdo->query(
        'SELECT *
         FROM sos_alerts
         ORDER BY created_at DESC'
    );

    send_json(
        array_map(
            'sos_row',
            $stmt->fetchAll()
        )
    );
}


/* ============================================================
   POST
   Passenger → create SOS alert
   ============================================================ */

if ($method === 'POST') {

    require_role($me, ['passenger']);

    $in = body();

    $tripRef = $in['trip'] ??
        ($in['bookingId'] ?? null);

    $note = trim(
        $in['note'] ?? ''
    );

    $stmt = $pdo->prepare(
        "INSERT INTO sos_alerts (
            passenger_id,
            passenger_name,
            trip_ref,
            note,
            status
        )
        VALUES (?, ?, ?, ?, 'open')"
    );

    $stmt->execute([
        $me['id'],
        $me['name'],
        $tripRef,
        $note
    ]);

    send_json(
        ['id' => (int) $pdo->lastInsertId()],
        201,
        'SOS sent. BT Express operations has been notified.'
    );
}


/* ============================================================
   PATCH
   Owner/Manager → resolve SOS
   ============================================================ */

if ($method === 'PATCH') {

    require_role(
        $me,
        ['owner', 'manager']
    );

    $in = body();

    $id = (int) ($in['id'] ?? 0);

    if (!$id) {
        send_error('Missing alert id.');
    }

    $stmt = $pdo->prepare(
        'SELECT id
         FROM sos_alerts
         WHERE id = ?'
    );

    $stmt->execute([$id]);

    if (!$stmt->fetch()) {
        send_error('SOS alert not found.', 404);
    }

    $pdo->prepare(
        "UPDATE sos_alerts
         SET status = 'resolved'
         WHERE id = ?"
    )->execute([$id]);

    send_json(
        ['id' => $id],
        200,
        'Marked resolved.'
    );
}


/* ============================================================
   DELETE
   Owner/Manager → delete SOS record
   ============================================================ */

if ($method === 'DELETE') {

    require_role(
        $me,
        ['owner', 'manager']
    );

    $id = (int) ($_GET['id'] ?? 0);

    if (!$id) {
        send_error('Missing alert id.');
    }

    $stmt = $pdo->prepare(
        'SELECT id
         FROM sos_alerts
         WHERE id = ?'
    );

    $stmt->execute([$id]);

    if (!$stmt->fetch()) {
        send_error('SOS alert not found.', 404);
    }

    $pdo->prepare(
        'DELETE FROM sos_alerts
         WHERE id = ?'
    )->execute([$id]);

    send_json(
        ['id' => $id],
        200,
        'SOS record deleted.'
    );
}


send_error('Method not allowed.', 405);