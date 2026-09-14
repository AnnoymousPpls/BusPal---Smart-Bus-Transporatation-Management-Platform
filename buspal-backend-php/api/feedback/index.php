<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
$method = $_SERVER['REQUEST_METHOD'];

function feedback_row(array $f): array {
    return [
        'id' => (int) $f['id'], 'type' => $f['type'], 'trip' => $f['trip_ref'], 'message' => $f['message'],
        'status' => $f['status'], 'passengerName' => $f['passenger_name'], 'createdAt' => $f['created_at'],
    ];
}

if ($method === 'GET') {
    if ($me['role'] === 'passenger') {
        $stmt = $pdo->prepare('SELECT * FROM feedback WHERE passenger_id = ? ORDER BY created_at DESC');
        $stmt->execute([$me['id']]);
    } else {
        $stmt = $pdo->query('SELECT * FROM feedback ORDER BY created_at DESC');
    }
    send_json(array_map('feedback_row', $stmt->fetchAll()));
}

if ($method === 'POST') {
    require_role($me, ['passenger']);
    $in = body();
    if (empty($in['message'])) send_error('Message is required.');
    $stmt = $pdo->prepare(
        "INSERT INTO feedback (passenger_id, passenger_name, type, trip_ref, message, status) VALUES (?, ?, ?, ?, ?, 'open')"
    );
    $stmt->execute([$me['id'], $me['name'], $in['type'] ?? 'feedback', $in['trip'] ?? null, $in['message']]);
    send_json(['id' => (int) $pdo->lastInsertId()], 201, 'Thanks — sent to BT Express.');
}

if ($method === 'PATCH') {
    $in = body();
    $id = (int) ($in['id'] ?? 0);
    if (!$id) send_error('Missing feedback id.');

    $stmt = $pdo->prepare('SELECT * FROM feedback WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) send_error('Not found.', 404);

    if ($me['role'] === 'passenger') {
        if ((int) $row['passenger_id'] !== (int) $me['id']) send_error('Not your feedback.', 403);
        if ($row['status'] !== 'open') send_error('Only open feedback can be edited.');
        if (empty($in['message'])) send_error('Message is required.');
        $pdo->prepare('UPDATE feedback SET message = ? WHERE id = ?')->execute([$in['message'], $id]);
        send_json(['id' => $id], 200, 'Feedback updated.');
    }

    require_role($me, ['owner', 'manager']);
    $pdo->prepare("UPDATE feedback SET status = 'closed' WHERE id = ?")->execute([$id]);
    send_json(['id' => $id], 200, 'Marked resolved.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);

    if (!$id) {
        send_error('Missing feedback id.');
    }

    $stmt = $pdo->prepare(
        'SELECT passenger_id, status
         FROM feedback
         WHERE id = ?'
    );
    $stmt->execute([$id]);

    $row = $stmt->fetch();

    if (!$row) {
        send_error('Not found.', 404);
    }

    /*
     * Passenger:
     *   Can withdraw only their own OPEN feedback.
     *
     * Owner/Manager:
     *   Can delete any feedback record.
     */
    if ($me['role'] === 'passenger') {
        if ((int) $row['passenger_id'] !== (int) $me['id']) {
            send_error('Not your feedback.', 403);
        }

        if ($row['status'] !== 'open') {
            send_error(
                'Only open feedback can be withdrawn.'
            );
        }

        $pdo->prepare(
            'DELETE FROM feedback WHERE id = ?'
        )->execute([$id]);

        send_json(
            ['id' => $id],
            200,
            'Withdrawn.'
        );
    }

    require_role(
        $me,
        ['owner', 'manager']
    );

    $pdo->prepare(
        'DELETE FROM feedback WHERE id = ?'
    )->execute([$id]);

    send_json(
        ['id' => $id],
        200,
        'Feedback deleted.'
    );
}

send_error('Method not allowed.', 405);
