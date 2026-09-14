<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

/*
|--------------------------------------------------------------------------
| POST ?action=generate
| Operator only
| Creates or reuses a 6-character trip access code.
|--------------------------------------------------------------------------
*/

if ($method === 'POST' && $action === 'generate') {

    $me = require_auth($pdo);

    require_role(
        $me,
        ['owner', 'manager']
    );

    $in = body();


    foreach (
        ['from', 'to', 'date', 'depTime']
        as $field
    ) {
        if (empty($in[$field])) {
            send_error(
                "Missing $field."
            );
        }
    }


    /*
     * Reuse an existing code for the
     * same route/date/departure.
     */

    $existing = $pdo->prepare(
        'SELECT *
         FROM trip_codes
         WHERE from_city = ?
           AND to_city = ?
           AND travel_date = ?
           AND dep_time = ?
         LIMIT 1'
    );


    $existing->execute([
        $in['from'],
        $in['to'],
        $in['date'],
        $in['depTime']
    ]);


    $row = $existing->fetch();


    if ($row) {

        $update = $pdo->prepare(
            'UPDATE trip_codes
             SET capacity = ?,
                 bus_label = ?,
                 driver_name = ?,
                 conductor_name = ?
             WHERE code = ?'
        );


        $update->execute([
            (int) ($in['capacity'] ?? 40),
            $in['busLabel'] ?? null,
            $in['driverName'] ?? null,
            $in['conductorName'] ?? null,
            $row['code']
        ]);


        send_json(
            [
                'code' => $row['code']
            ],
            200
        );
    }


    /*
     * Generate a code using characters
     * that are easier to read.
     */

    $chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


    do {

        $code = '';


        for ($i = 0; $i < 6; $i++) {

            $code .=
                $chars[
                    random_int(
                        0,
                        strlen($chars) - 1
                    )
                ];
        }


        $check = $pdo->prepare(
            'SELECT code
             FROM trip_codes
             WHERE code = ?
             LIMIT 1'
        );


        $check->execute([
            $code
        ]);

    } while ($check->fetch());


    /*
     * Store the new trip code.
     */

    $stmt = $pdo->prepare(
        'INSERT INTO trip_codes
        (
            code,
            from_city,
            to_city,
            travel_date,
            dep_time,
            capacity,
            bus_label,
            driver_name,
            conductor_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );


    $stmt->execute([
        $code,
        $in['from'],
        $in['to'],
        $in['date'],
        $in['depTime'],
        (int) ($in['capacity'] ?? 40),
        $in['busLabel'] ?? null,
        $in['driverName'] ?? null,
        $in['conductorName'] ?? null
    ]);


    send_json(
        [
            'code' => $code
        ],
        201
    );
}


/*
|--------------------------------------------------------------------------
| GET ?code=XXXXXX
| No login required.
| Used by the standalone Conductor Portal.
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET' &&
    !empty($_GET['code'])
) {

    $code =
        strtoupper(
            trim(
                $_GET['code']
            )
        );


    $stmt = $pdo->prepare(
        'SELECT *
         FROM trip_codes
         WHERE code = ?
         LIMIT 1'
    );


    $stmt->execute([
        $code
    ]);


    $trip =
        $stmt->fetch();


    if (!$trip) {

        send_error(
            "That code isn't valid — check with your Owner/Manager.",
            404
        );
    }


    /*
     * Load all non-cancelled bookings
     * for this exact trip.
     */

    $seatsStmt = $pdo->prepare(
        "SELECT *
         FROM bookings
         WHERE from_city = ?
           AND to_city = ?
           AND travel_date = ?
           AND dep_time = ?
           AND status != 'cancelled'
         ORDER BY id ASC"
    );


    $seatsStmt->execute([
        $trip['from_city'],
        $trip['to_city'],
        $trip['travel_date'],
        $trip['dep_time']
    ]);


    $manifest = [];


    foreach (
        $seatsStmt->fetchAll()
        as $booking
    ) {

        $seats =
            json_decode(
                $booking['seats'],
                true
            );


        if (!is_array($seats)) {
            $seats = [];
        }


        $manifest[] = [
            'passengerName' =>
                $booking['passenger_name'],

            'phone' =>
                $booking['phone'],

            'pickupPoint' =>
                $booking['pickup_point'],

            'seats' =>
                array_map(
                    'strval',
                    $seats
                ),

            'pnr' =>
                $booking['pnr'],

            'source' =>
                $booking['source']
        ];
    }


    send_json(
        [
            'from' =>
                $trip['from_city'],

            'to' =>
                $trip['to_city'],

            'date' =>
                $trip['travel_date'],

            'depTime' =>
                substr(
                    $trip['dep_time'],
                    0,
                    5
                ),

            'capacity' =>
                (int) $trip['capacity'],

            'busLabel' =>
                $trip['bus_label'],

            'driverName' =>
                $trip['driver_name'],

            'conductorName' =>
                $trip['conductor_name'],

            'manifest' =>
                $manifest
        ],
        200
    );
}


/*
|--------------------------------------------------------------------------
| POST ?action=book
| No login required.
| Used by the standalone Conductor Portal
| for counter bookings.
|--------------------------------------------------------------------------
*/

if (
    $method === 'POST' &&
    $action === 'book'
) {

    $in = body();


    foreach (
        [
            'code',
            'seats',
            'passengerName',
            'phone'
        ] as $field
    ) {

        if (
            !isset($in[$field]) ||
            $in[$field] === '' ||
            $in[$field] === null
        ) {

            send_error(
                "Missing $field."
            );
        }
    }


    $code =
        strtoupper(
            trim(
                $in['code']
            )
        );


    if (
        !is_array(
            $in['seats']
        ) ||
        count(
            $in['seats']
        ) === 0
    ) {

        send_error(
            'At least one seat is required.'
        );
    }


    /*
     * Load the trip code.
     */

    $stmt = $pdo->prepare(
        'SELECT *
         FROM trip_codes
         WHERE code = ?
         LIMIT 1'
    );


    $stmt->execute([
        $code
    ]);


    $trip =
        $stmt->fetch();


    if (!$trip) {

        send_error(
            "That code isn't valid.",
            404
        );
    }


    /*
     * Normalize requested seats.
     */

    $requestedSeats =
        array_values(
            array_unique(
                array_map(
                    'strval',
                    $in['seats']
                )
            )
        );


    /*
     * Validate seat numbers.
     */

    foreach (
        $requestedSeats
        as $seat
    ) {

        if (
            !ctype_digit($seat) ||
            (int) $seat < 1 ||
            (int) $seat > (int) $trip['capacity']
        ) {

            send_error(
                "Seat $seat is not valid for this bus.",
                422
            );
        }
    }


    /*
     * Find seats already booked.
     */

    $taken = $pdo->prepare(
        "SELECT seats
         FROM bookings
         WHERE from_city = ?
           AND to_city = ?
           AND travel_date = ?
           AND dep_time = ?
           AND status != 'cancelled'"
    );


    $taken->execute([
        $trip['from_city'],
        $trip['to_city'],
        $trip['travel_date'],
        $trip['dep_time']
    ]);


    $takenSeats = [];


    foreach (
        $taken->fetchAll()
        as $row
    ) {

        $existingSeats =
            json_decode(
                $row['seats'],
                true
            );


        if (
            is_array(
                $existingSeats
            )
        ) {

            foreach (
                $existingSeats
                as $seat
            ) {

                $takenSeats[] =
                    (string) $seat;
            }
        }
    }


    $conflict =
        array_intersect(
            $requestedSeats,
            $takenSeats
        );


    if ($conflict) {

        send_error(
            'Seat ' .
            implode(
                ', ',
                $conflict
            ) .
            ' is already booked.',
            409
        );
    }


    /*
     * Generate PNR.
     */

    $chars =
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';


    do {

        $pnr =
            'BP';


        for ($i = 0; $i < 6; $i++) {

            $pnr .=
                $chars[
                    random_int(
                        0,
                        strlen($chars) - 1
                    )
                ];
        }


        $checkPnr =
            $pdo->prepare(
                'SELECT id
                 FROM bookings
                 WHERE pnr = ?
                 LIMIT 1'
            );


        $checkPnr->execute([
            $pnr
        ]);

    } while (
        $checkPnr->fetch()
    );


    /*
     * Insert counter booking.
     */

    $stmt = $pdo->prepare(
        "INSERT INTO bookings
        (
            passenger_id,
            passenger_name,
            phone,
            from_city,
            to_city,
            travel_date,
            dep_time,
            bus_plate,
            pickup_point,
            seats,
            pnr,
            status,
            source
        )
        VALUES
        (
            NULL,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'upcoming',
            'counter'
        )"
    );


    $stmt->execute([
        trim(
            $in['passengerName']
        ),

        trim(
            $in['phone']
        ),

        $trip['from_city'],

        $trip['to_city'],

        $trip['travel_date'],

        $trip['dep_time'],

        $trip['bus_label'],

        trim(
            $in['pickupPoint']
            ?? $trip['from_city']
        ),

        json_encode(
            $requestedSeats
        ),

        $pnr
    ]);


    send_json(
        [
            'pnr' =>
                $pnr
        ],
        201,
        'Seat booked at the counter.'
    );
}


/*
|--------------------------------------------------------------------------
| Invalid request
|--------------------------------------------------------------------------
*/

send_error(
    'Invalid request.',
    400
);