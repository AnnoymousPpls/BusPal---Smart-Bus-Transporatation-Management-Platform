<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

$method = strtoupper($_SERVER['REQUEST_METHOD']);


/* ============================================================
   HELPERS
   ============================================================ */

function generate_pnr(PDO $pdo): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    do {
        $pnr = 'BP';

        for ($i = 0; $i < 6; $i++) {
            $pnr .= $chars[
                random_int(
                    0,
                    strlen($chars) - 1
                )
            ];
        }

        $stmt = $pdo->prepare(
            'SELECT id
             FROM bookings
             WHERE pnr = ?
             LIMIT 1'
        );

        $stmt->execute([$pnr]);

    } while ($stmt->fetch());

    return $pnr;
}


/*
|--------------------------------------------------------------------------
| Return seats already occupied for one exact trip instance.
| Cancelled bookings do not occupy seats.
|--------------------------------------------------------------------------
*/

function taken_seats(
    PDO $pdo,
    string $from,
    string $to,
    string $date,
    string $depTime
): array {

    $stmt = $pdo->prepare(
        "SELECT seats
         FROM bookings
         WHERE from_city = ?
           AND to_city = ?
           AND travel_date = ?
           AND dep_time = ?
           AND status != 'cancelled'"
    );

    $stmt->execute([
        $from,
        $to,
        $date,
        $depTime
    ]);

    $taken = [];


    foreach ($stmt->fetchAll() as $row) {

        $decoded =
            json_decode(
                $row['seats'],
                true
            );


        if (is_array($decoded)) {

            foreach ($decoded as $seat) {
                $taken[] = (string) $seat;
            }
        }
    }


    return array_values(
        array_unique($taken)
    );
}


/*
|--------------------------------------------------------------------------
| Convert database row to frontend format.
|--------------------------------------------------------------------------
*/

function booking_to_ui(
    array $booking
): array {

    $seats =
        json_decode(
            $booking['seats'] ?? '[]',
            true
        );


    if (!is_array($seats)) {
        $seats = [];
    }


    return [

        'id' =>
            (int) $booking['id'],

        'pnr' =>
            $booking['pnr'],

        'from' =>
            $booking['from_city'],

        'to' =>
            $booking['to_city'],

        'date' =>
            $booking['travel_date'],

        'depTime' =>
            substr(
                $booking['dep_time'],
                0,
                5
            ),

        'arrTime' =>
            !empty($booking['arr_time'])
                ? substr(
                    $booking['arr_time'],
                    0,
                    5
                )
                : null,

        'busPlate' =>
            $booking['bus_plate'],

        'busType' =>
            $booking['bus_type'],

        'price' =>
            (int) $booking['price'],

        'pickupPoint' =>
            $booking['pickup_point'],

        'seats' =>
            array_map(
                'strval',
                $seats
            ),

        'status' =>
            $booking['status'],

        'source' =>
            $booking['source'],

        'passengerName' =>
            $booking['passenger_name'],

        'phone' =>
            $booking['phone'],

        'bookedAt' =>
            $booking['booked_at']

    ];
}


/* ============================================================
   PUBLIC TRIP SEARCH
   ============================================================ */

if (
    $method === 'GET' &&
    (
        isset($_GET['from']) ||
        isset($_GET['to']) ||
        ($_GET['scope'] ?? '') === 'trips'
    )
) {

    $from =
        trim(
            $_GET['from'] ?? ''
        );

    $to =
        trim(
            $_GET['to'] ?? ''
        );

    $date =
        trim(
            $_GET['date'] ?? ''
        );


    $sql = "
        SELECT
            d.id AS departure_id,
            r.from_city,
            r.to_city,
            r.fare,
            d.time,
            b.plate,
            b.type AS bus_type,
            b.capacity
        FROM departures d
        JOIN routes r
          ON r.id = d.route_id
        JOIN buses b
          ON b.id = d.bus_id
        WHERE r.visible = 1
    ";


    $params = [];


    if ($from !== '') {

        $sql .=
            " AND r.from_city LIKE ?";

        $params[] =
            "%{$from}%";
    }


    if ($to !== '') {

        $sql .=
            " AND r.to_city LIKE ?";

        $params[] =
            "%{$to}%";
    }


    $sql .=
        " ORDER BY d.time ASC";


    $stmt =
        $pdo->prepare($sql);


    $stmt->execute(
        $params
    );


    $trips =
        $stmt->fetchAll();


    $useDate =
        $date !== ''
            ? $date
            : date('Y-m-d');


    $results = [];


    foreach ($trips as $trip) {

        $taken =
            taken_seats(
                $pdo,
                $trip['from_city'],
                $trip['to_city'],
                $useDate,
                $trip['time']
            );


        $capacity =
            (int) $trip['capacity'];


        $results[] = [

            'id' =>
                (int) $trip['departure_id'],

            'departureId' =>
                (int) $trip['departure_id'],

            'from' =>
                $trip['from_city'],

            'to' =>
                $trip['to_city'],

            'date' =>
                $useDate,

            'depTime' =>
                substr(
                    $trip['time'],
                    0,
                    5
                ),

            'busType' =>
                $trip['bus_type'],

            'plate' =>
                $trip['plate'],

            'price' =>
                (int) $trip['fare'],

            'seatsTotal' =>
                $capacity,

            'seatsAvailable' =>
                max(
                    0,
                    $capacity -
                    count($taken)
                ),

            'seatsTaken' =>
                $taken,

            'arrTime' =>
                null,

            'duration' =>
                null
        ];
    }


    send_json(
        $results
    );
}


/* ============================================================
   ALL REMAINING REQUESTS REQUIRE LOGIN
   ============================================================ */

$me =
    require_auth($pdo);


/* ============================================================
   GET BOOKINGS
   ============================================================ */

if ($method === 'GET') {

    $scope =
        $_GET['scope'] ?? '';


    /* --------------------------------------------------------
       Operator
       -------------------------------------------------------- */

    if ($scope === 'operator') {

        require_role(
            $me,
            ['owner', 'manager']
        );


        $stmt =
            $pdo->query(
                'SELECT *
                 FROM bookings
                 ORDER BY booked_at DESC'
            );


        $rows =
            $stmt->fetchAll();


        send_json(
            array_map(
                'booking_to_ui',
                $rows
            )
        );
    }


    /* --------------------------------------------------------
       Passenger
       -------------------------------------------------------- */

    require_role(
        $me,
        ['passenger']
    );


    $stmt =
        $pdo->prepare(
            'SELECT *
             FROM bookings
             WHERE passenger_id = ?
             ORDER BY booked_at DESC'
        );


    $stmt->execute([
        $me['id']
    ]);


    send_json(
        array_map(
            'booking_to_ui',
            $stmt->fetchAll()
        )
    );
}


/* ============================================================
   CREATE PASSENGER BOOKING
   ============================================================ */

if ($method === 'POST') {

    require_role(
        $me,
        ['passenger']
    );


    $in =
        body();


    $departureId =
        (int) (
            $in['departureId'] ?? 0
        );


    $date =
        trim(
            $in['travelDate'] ?? ''
        );


    $seats =
        $in['seats'] ?? [];


    if (
        !$departureId ||
        !$date ||
        !is_array($seats) ||
        count($seats) === 0
    ) {

        send_error(
            'departureId, travelDate, and seats are required.'
        );
    }


    $seats =
        array_values(
            array_unique(
                array_map(
                    'strval',
                    $seats
                )
            )
        );


    /* --------------------------------------------------------
       Load trip
       -------------------------------------------------------- */

    $stmt =
        $pdo->prepare(
            'SELECT
                d.time,
                r.from_city,
                r.to_city,
                r.fare,
                b.plate,
                b.type AS bus_type,
                b.capacity
             FROM departures d
             JOIN routes r
               ON r.id = d.route_id
             JOIN buses b
               ON b.id = d.bus_id
             WHERE d.id = ?
             LIMIT 1'
        );


    $stmt->execute([
        $departureId
    ]);


    $trip =
        $stmt->fetch();


    if (!$trip) {

        send_error(
            'Trip not found.',
            404
        );
    }


    $capacity =
        (int) $trip['capacity'];


    /* --------------------------------------------------------
       Validate seats
       -------------------------------------------------------- */

    foreach ($seats as $seat) {

        if (
            !ctype_digit(
                (string) $seat
            ) ||
            (int) $seat < 1 ||
            (int) $seat > $capacity
        ) {

            send_error(
                "Seat {$seat} is not valid for this bus."
            );
        }
    }


    /* --------------------------------------------------------
       Check availability
       -------------------------------------------------------- */

    $taken =
        taken_seats(
            $pdo,
            $trip['from_city'],
            $trip['to_city'],
            $date,
            $trip['time']
        );


    $conflict =
        array_intersect(
            $seats,
            $taken
        );


    if ($conflict) {

        send_error(
            'Seat ' .
            implode(
                ', ',
                $conflict
            ) .
            ' was just taken — pick another.',
            409
        );
    }


    /* --------------------------------------------------------
       Create booking
       -------------------------------------------------------- */

    $pnr =
        generate_pnr(
            $pdo
        );


    $stmt =
        $pdo->prepare(
            "INSERT INTO bookings (
                passenger_id,
                passenger_name,
                phone,
                from_city,
                to_city,
                travel_date,
                dep_time,
                bus_plate,
                bus_type,
                price,
                pickup_point,
                seats,
                pnr,
                status,
                source
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, 'upcoming', 'self'
            )"
        );


    $stmt->execute([
        $me['id'],
        $me['name'],
        $me['phone'],
        $trip['from_city'],
        $trip['to_city'],
        $date,
        $trip['time'],
        $trip['plate'],
        $trip['bus_type'],
        (int) $trip['fare'],
        $trip['from_city'],
        json_encode($seats),
        $pnr
    ]);


    $newId =
        (int) $pdo->lastInsertId();


    $stmt =
        $pdo->prepare(
            'SELECT *
             FROM bookings
             WHERE id = ?
             LIMIT 1'
        );


    $stmt->execute([
        $newId
    ]);


    $created =
        $stmt->fetch();


    send_json(
        booking_to_ui(
            $created
        ),
        201,
        'Booking confirmed.'
    );
}


/* ============================================================
   CANCEL BOOKING
   PATCH /api/bookings/index.php

   Owner/Manager:
     Can cancel any booking.

   Passenger:
     Can cancel only their own booking.
   ============================================================ */

if ($method === 'PATCH') {

    $in =
        body();


    $id =
        (int) (
            $in['id'] ?? 0
        );


    if (!$id) {

        send_error(
            'Missing booking id.'
        );
    }


    /* --------------------------------------------------------
       Find booking
       -------------------------------------------------------- */

    $stmt =
        $pdo->prepare(
            'SELECT *
             FROM bookings
             WHERE id = ?
             LIMIT 1'
        );


    $stmt->execute([
        $id
    ]);


    $booking =
        $stmt->fetch();


    if (!$booking) {

        send_error(
            'Booking not found.',
            404
        );
    }


    /* --------------------------------------------------------
       Permission
       -------------------------------------------------------- */

    if (
        $me['role'] ===
        'passenger'
    ) {

        if (
            (int) $booking['passenger_id'] !==
            (int) $me['id']
        ) {

            send_error(
                "That's not your booking.",
                403
            );
        }

    } else {

        require_role(
            $me,
            ['owner', 'manager']
        );
    }


    /* --------------------------------------------------------
       Already cancelled
       -------------------------------------------------------- */

    if (
        $booking['status'] ===
        'cancelled'
    ) {

        send_error(
            'Booking is already cancelled.'
        );
    }


    /* --------------------------------------------------------
       Cancel
       -------------------------------------------------------- */

    $pdo->beginTransaction();


    try {

        $update =
            $pdo->prepare(
                "UPDATE bookings
                 SET status = 'cancelled'
                 WHERE id = ?
                   AND status != 'cancelled'"
            );


        $update->execute([
            $id
        ]);


        if (
            $update->rowCount() !== 1
        ) {

            throw new RuntimeException(
                'The booking could not be cancelled.'
            );
        }


        $pdo->commit();


    } catch (
        Throwable $error
    ) {

        if (
            $pdo->inTransaction()
        ) {

            $pdo->rollBack();
        }


        error_log(
            'Booking cancellation error: ' .
            $error->getMessage()
        );


        send_error(
            'Unable to cancel booking.',
            500
        );
    }


    send_json(
        [
            'id' =>
                $id,

            'status' =>
                'cancelled'
        ],
        200,
        'Booking cancelled — seat released.'
    );
}


/* ============================================================
   DELETE BOOKING
   DELETE /api/bookings/index.php?id=ID

   Owner/Manager only.
   ============================================================ */

if ($method === 'DELETE') {

    require_role(
        $me,
        ['owner', 'manager']
    );


    $id =
        (int) (
            $_GET['id'] ?? 0
        );


    if (!$id) {

        send_error(
            'Missing booking id.'
        );
    }


    /* --------------------------------------------------------
       Check booking exists
       -------------------------------------------------------- */

    $stmt =
        $pdo->prepare(
            'SELECT id
             FROM bookings
             WHERE id = ?
             LIMIT 1'
        );


    $stmt->execute([
        $id
    ]);


    if (!$stmt->fetch()) {

        send_error(
            'Booking not found.',
            404
        );
    }


    /* --------------------------------------------------------
       Delete booking
       -------------------------------------------------------- */

    $stmt =
        $pdo->prepare(
            'DELETE FROM bookings
             WHERE id = ?'
        );


    $stmt->execute([
        $id
    ]);


    if (
        $stmt->rowCount() !== 1
    ) {

        send_error(
            'Booking could not be deleted.',
            500
        );
    }


    send_json(
        [
            'id' =>
                $id
        ],
        200,
        'Booking deleted.'
    );
}


/* ============================================================
   METHOD NOT ALLOWED
   ============================================================ */

send_error(
    'Method not allowed.',
    405
);