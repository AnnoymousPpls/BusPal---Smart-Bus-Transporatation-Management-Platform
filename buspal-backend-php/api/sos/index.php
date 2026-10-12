<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
$method = $_SERVER['REQUEST_METHOD'];


/* HELPER Format SOS response*/

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


/* GET,Passenger  → own SOS alerts,Owner/Manager → all SOS alerts */

if ($method === 'GET') {

    /*PASSENGER*/

    if ($me['role'] === 'passenger') {

        $stmt = $pdo->prepare(
            'SELECT *
             FROM sos_alerts
             WHERE passenger_id = ?
             ORDER BY created_at DESC'
        );

        $stmt->execute([
            $me['id']
        ]);

        send_json(
            array_map(
                'sos_row',
                $stmt->fetchAll()
            )
        );
    }


    /*OWNER / MANAGER*/

    require_role(
        $me,
        ['owner', 'manager']
    );


    /*OPEN SOS COUNT*/

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


    /*ALL SOS ALERTS*/

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


/*Passenger → create SOS alert*/

if ($method === 'POST') {

    require_role(
        $me,
        ['passenger']
    );

    $in = body();


    /*TRIP*/

    $tripRef =
        $in['trip']
        ?? ($in['bookingId'] ?? null);


    

    $note = trim(
        $in['note'] ?? ''
    );


    /*EMERGENCY CONTACT,null = BT Express Operations */

    $emergencyContactId =
        $in['emergencyContactId']
        ?? null;


    /*
     * Convert empty string to null.
     */
    if (
        $emergencyContactId === ''
        || $emergencyContactId === 0
        || $emergencyContactId === '0'
    ) {

        $emergencyContactId = null;
    }


    /*
     * Validate contact ID if supplied.
     */
    if ($emergencyContactId !== null) {

        $emergencyContactId =
            (int) $emergencyContactId;

        if ($emergencyContactId <= 0) {

            send_error(
                'Invalid emergency contact.'
            );
        }


        /*Only allow the passenger to use THEIR OWN
           emergency contacts.*/

        $contactStmt = $pdo->prepare(
            'SELECT id, name, phone
             FROM emergency_contacts
             WHERE id = ?
               AND passenger_id = ?'
        );

        $contactStmt->execute([
            $emergencyContactId,
            $me['id']
        ]);

        $contact =
            $contactStmt->fetch();


        if (!$contact) {

            send_error(
                'Emergency contact not found.',
                404
            );
        }


        $contactName =
            $contact['name'];

        $contactPhone =
            $contact['phone'];
    }


    /*CREATE SOS ALERT*/

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


    if ($emergencyContactId === null) {

        $recipientNote =
            '[Recipient: BT Express Operations]';

    } else {

        $recipientNote =
            '[Recipient: '
            . $contactName
            . ' - '
            . $contactPhone
            . ']';
    }


    if ($note !== '') {

        $finalNote =
            $recipientNote
            . ' '
            . $note;

    } else {

        $finalNote =
            $recipientNote;
    }


    $stmt->execute([
        $me['id'],
        $me['name'],
        $tripRef,
        $finalNote
    ]);


    $sosId =
        (int) $pdo->lastInsertId();


    

    if ($emergencyContactId === null) {

        send_json(
            [
                'id' => $sosId,
                'recipient' => 'BT Express Operations',
                'emergencyContactId' => null
            ],
            201,
            'SOS sent. BT Express operations has been notified.'
        );

    } else {

        send_json(
            [
                'id' => $sosId,
                'recipient' => $contactName,
                'phone' => $contactPhone,
                'emergencyContactId' => $emergencyContactId
            ],
            201,
            'SOS sent to your emergency contact.'
        );
    }
}


/*  
   PATCH
   Owner/Manager → resolve SOS */

if ($method === 'PATCH') {

    require_role(
        $me,
        ['owner', 'manager']
    );

    $in = body();

    $id =
        (int) ($in['id'] ?? 0);


    if (!$id) {

        send_error(
            'Missing alert id.'
        );
    }


    $stmt = $pdo->prepare(
        'SELECT id
         FROM sos_alerts
         WHERE id = ?'
    );

    $stmt->execute([
        $id
    ]);


    if (!$stmt->fetch()) {

        send_error(
            'SOS alert not found.',
            404
        );
    }


    $pdo->prepare(
        "UPDATE sos_alerts
         SET status = 'resolved'
         WHERE id = ?"
    )->execute([
        $id
    ]);


    send_json(
        [
            'id' => $id
        ],
        200,
        'Marked resolved.'
    );
}


/*  
   DELETE
   Owner/Manager → delete SOS record
    */

if ($method === 'DELETE') {

    require_role(
        $me,
        ['owner', 'manager']
    );

    $id =
        (int) ($_GET['id'] ?? 0);


    if (!$id) {

        send_error(
            'Missing alert id.'
        );
    }


    $stmt = $pdo->prepare(
        'SELECT id
         FROM sos_alerts
         WHERE id = ?'
    );

    $stmt->execute([
        $id
    ]);


    if (!$stmt->fetch()) {

        send_error(
            'SOS alert not found.',
            404
        );
    }


    $pdo->prepare(
        'DELETE FROM sos_alerts
         WHERE id = ?'
    )->execute([
        $id
    ]);


    send_json(
        [
            'id' => $id
        ],
        200,
        'SOS record deleted.'
    );
}


/*  
   INVALID METHOD
   */

send_error(
    'Method not allowed.',
    405
);