<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

$method = strtoupper($_SERVER['REQUEST_METHOD']);


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

/*
 * Generate a unique passenger booking PNR.
 */
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
| VALIDATE DATE
|--------------------------------------------------------------------------
*/

function validate_booking_date($date): string
{
    $date = trim((string) $date);

    $parsed = DateTime::createFromFormat(
        'Y-m-d',
        $date
    );

    if (
        !$parsed ||
        $parsed->format('Y-m-d') !== $date
    ) {

        send_error(
            'Invalid travel date. Use YYYY-MM-DD format.',
            400
        );
    }

    return $date;
}


/*
|--------------------------------------------------------------------------
| TAKEN SEATS
|--------------------------------------------------------------------------
|
| Only non-cancelled bookings occupy seats.
|
| Seats are checked against:
|
|   From
|   To
|   Travel date
|   Departure time
|
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

        $decoded = json_decode(
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
| BOOKING → FRONTEND FORMAT
|--------------------------------------------------------------------------
*/

function booking_to_ui(
    array $booking
): array {

    $seats = json_decode(
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


/*
|--------------------------------------------------------------------------
| PUBLIC TRIP SEARCH
|--------------------------------------------------------------------------
|
| Passenger can search without login.
|
| Example:
|
| /bookings/index.php
|   ?from=Batticaloa
|   &to=Colombo
|   &date=2026-09-20
|
|--------------------------------------------------------------------------
*/

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

    /*
     * IMPORTANT:
     *
     * If no date is supplied,
     * use today's date.
     */
    $date =
        trim(
            $_GET['date'] ?? ''
        );

    if ($date === '') {

        $date = date('Y-m-d');

    } else {

        $date =
            validate_booking_date(
                $date
            );
    }


    /*
     |--------------------------------------------------------------------------
     | FIND ONLY DEPARTURES FOR THE SELECTED DATE
     |--------------------------------------------------------------------------
     |
     | THIS IS THE IMPORTANT FIX.
     |
     | Previously the query did NOT check:
     |
     |     d.departure_date = ?
     |
     | Therefore a departure from another date could appear
     | on the passenger screen.
     |
     |--------------------------------------------------------------------------
     */

    $sql = "
        SELECT
            d.id AS departure_id,
            d.departure_date,

            r.id AS route_id,
            r.from_city,
            r.to_city,
            r.fare,

            d.time,

            b.id AS bus_id,
            b.plate,
            b.type AS bus_type,
            b.capacity

        FROM departures d

        JOIN routes r
            ON r.id = d.route_id

        JOIN buses b
            ON b.id = d.bus_id

        WHERE r.visible = 1

          AND d.departure_date = ?
    ";


    /*
     * Date is now ALWAYS the first parameter.
     */

    $params = [
        $date
    ];


    /*
     |--------------------------------------------------------------------------
     | FROM FILTER
     |--------------------------------------------------------------------------
     */

    if ($from !== '') {

        $sql .=
            " AND r.from_city LIKE ?";

        $params[] =
            "%{$from}%";
    }


    /*
     |--------------------------------------------------------------------------
     | TO FILTER
     |--------------------------------------------------------------------------
     */

    if ($to !== '') {

        $sql .=
            " AND r.to_city LIKE ?";

        $params[] =
            "%{$to}%";
    }


    /*
     |--------------------------------------------------------------------------
     | ORDER
     |--------------------------------------------------------------------------
     */

    $sql .=
        " ORDER BY d.time ASC";


    /*
     |--------------------------------------------------------------------------
     | EXECUTE
     |--------------------------------------------------------------------------
     */

    $stmt =
        $pdo->prepare(
            $sql
        );

    $stmt->execute(
        $params
    );


    $trips =
        $stmt->fetchAll();


    /*
     |--------------------------------------------------------------------------
     | BUS PHOTOS
     |--------------------------------------------------------------------------
     */

    $photoStmt =
        $pdo->prepare(
            'SELECT
                id,
                photo_path
             FROM bus_photos
             WHERE bus_id = ?
             ORDER BY sort_order ASC'
        );


    $results = [];


    /*
     |--------------------------------------------------------------------------
     | BUILD PASSENGER RESULTS
     |--------------------------------------------------------------------------
     */

    foreach ($trips as $trip) {


        /*
         * Get already booked seats
         * for this EXACT date and time.
         */

        $taken =
            taken_seats(
                $pdo,
                $trip['from_city'],
                $trip['to_city'],
                $date,
                $trip['time']
            );


        $capacity =
            (int) $trip['capacity'];


        /*
         * Get photos.
         */

        $photoStmt->execute([
            $trip['bus_id']
        ]);


        $photos =
            array_map(
                function ($photo) {

                    return [

                        'id' =>
                            (int) $photo['id'],

                        'path' =>
                            $photo['photo_path']

                    ];
                },
                $photoStmt->fetchAll()
            );


        /*
         * Passenger trip response.
         */

        $results[] = [

            /*
             * IMPORTANT:
             * This is the actual departure ID.
             */
            'id' =>
                (int) $trip['departure_id'],

            'departureId' =>
                (int) $trip['departure_id'],

            'busId' =>
                (int) $trip['bus_id'],

            'routeId' =>
                (int) $trip['route_id'],


            'from' =>
                $trip['from_city'],

            'to' =>
                $trip['to_city'],


            /*
             * IMPORTANT:
             * This is the ACTUAL departure date
             * from the database.
             */
            'date' =>
                $trip['departure_date'],


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


            'photos' =>
                $photos,


            'arrTime' =>
                null,

            'duration' =>
                null
        ];
    }


    /*
     |--------------------------------------------------------------------------
     | RETURN RESULTS
     |--------------------------------------------------------------------------
     */

    send_json(
        $results
    );
}

/*
|--------------------------------------------------------------------------
| GET SINGLE DEPARTURE BY ID
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET' &&
    isset($_GET['departureId'])
) {

    $departureId =
        (int) $_GET['departureId'];


    $stmt = $pdo->prepare(
        "
        SELECT

            d.id AS departure_id,
            d.departure_date,
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

        LIMIT 1
        "
    );


    $stmt->execute([
        $departureId
    ]);


    $trip = $stmt->fetch();


    if(!$trip){

        send_error(
            "Trip not found.",
            404
        );

    }


    $taken =
        taken_seats(
            $pdo,
            $trip['from_city'],
            $trip['to_city'],
            $trip['departure_date'],
            $trip['time']
        );


    send_json([

        "id" =>
            (int)$trip['departure_id'],

        "from" =>
            $trip['from_city'],

        "to" =>
            $trip['to_city'],

        "date" =>
            $trip['departure_date'],

        "depTime" =>
            substr(
                $trip['time'],
                0,
                5
            ),

        "busType" =>
            $trip['bus_type'],

        "plate" =>
            $trip['plate'],

        "price" =>
            (int)$trip['fare'],

        "seatsTotal" =>
            (int)$trip['capacity'],

        "seatsTaken" =>
            $taken

    ]);

}


/*
|--------------------------------------------------------------------------
| ALL REMAINING REQUESTS REQUIRE LOGIN
|--------------------------------------------------------------------------
*/


$me = require_auth($pdo);


/*
|--------------------------------------------------------------------------
| AUTO COMPLETE EXPIRED BOOKINGS
|--------------------------------------------------------------------------
|
| Change old upcoming trips into completed history.
|
| Rules:
|
| - Future trips  -> upcoming
| - Past trips    -> completed
| - Cancelled     -> cancelled (never touched)
|
|--------------------------------------------------------------------------
*/


$pdo->query("
    UPDATE bookings
    SET status = 'completed'
    WHERE status = 'upcoming'
    AND TIMESTAMP(travel_date, dep_time) < NOW()
");



/*
|--------------------------------------------------------------------------
| GET BOOKINGS
|--------------------------------------------------------------------------
*/

if ($method === 'GET') {

    $scope =
        $_GET['scope'] ?? '';


    /*
     |--------------------------------------------------------------------------
     | OPERATOR BOOKINGS
     |--------------------------------------------------------------------------
     */

    if ($scope === 'operator') {

        require_role(
            $me,
            [
                'owner',
                'manager'
            ]
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


    /*
     |--------------------------------------------------------------------------
     | PASSENGER BOOKINGS
     |--------------------------------------------------------------------------
     */

    require_role(
        $me,
        [
            'passenger'
        ]
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


/*
|--------------------------------------------------------------------------
| CREATE PASSENGER BOOKING
|--------------------------------------------------------------------------
*/

if ($method === 'POST') {

    require_role(
        $me,
        [
            'passenger'
        ]
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


    /*
     |--------------------------------------------------------------------------
     | REQUIRED FIELDS
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | VALIDATE DATE
     |--------------------------------------------------------------------------
     */

    $date =
        validate_booking_date(
            $date
        );


    /*
     |--------------------------------------------------------------------------
     | NORMALISE SEATS
     |--------------------------------------------------------------------------
     */

    $seats =
        array_values(
            array_unique(
                array_map(
                    'strval',
                    $seats
                )
            )
        );


    /*
     |--------------------------------------------------------------------------
     | LOAD EXACT DEPARTURE
     |--------------------------------------------------------------------------
     |
     | IMPORTANT:
     |
     | We now retrieve departure_date.
     |
     |--------------------------------------------------------------------------
     */

    $stmt =
        $pdo->prepare(
            'SELECT

                d.id AS departure_id,
                d.departure_date,
                d.time,

                r.id AS route_id,
                r.from_city,
                r.to_city,
                r.fare,
                r.visible,

                b.id AS bus_id,
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


    /*
     |--------------------------------------------------------------------------
     | DEPARTURE NOT FOUND
     |--------------------------------------------------------------------------
     */

    if (!$trip) {

        send_error(
            'Trip not found.',
            404
        );
    }


    /*
     |--------------------------------------------------------------------------
     | ROUTE MUST STILL BE VISIBLE
     |--------------------------------------------------------------------------
     */

    if (!(bool) $trip['visible']) {

        send_error(
            'This route is no longer available for passenger booking.',
            409
        );
    }


    /*
     |--------------------------------------------------------------------------
     | CRITICAL DATE CHECK
     |--------------------------------------------------------------------------
     |
     | The passenger's selected travel date MUST match
     | the actual departure date.
     |
     |--------------------------------------------------------------------------
     */

    if (
        $trip['departure_date'] !== $date
    ) {

        send_error(
            'The selected departure is not available for the requested date.',
            409
        );
    }


    /*
     |--------------------------------------------------------------------------
     | CAPACITY
     |--------------------------------------------------------------------------
     */

    $capacity =
        (int) $trip['capacity'];


    /*
     |--------------------------------------------------------------------------
     | VALIDATE SEATS
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | CHECK SEAT AVAILABILITY
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | GENERATE PNR
     |--------------------------------------------------------------------------
     */

    $pnr =
        generate_pnr(
            $pdo
        );


    /*
     |--------------------------------------------------------------------------
     | CREATE BOOKING
     |--------------------------------------------------------------------------
     */

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

                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?,
                ?,
                ?,
                ?, ?,
                'upcoming',
                'self'

            )"
        );


    $stmt->execute([

        $me['id'],

        $me['name'],

        $me['phone'],

        $trip['from_city'],

        $trip['to_city'],

        /*
         * Use the ACTUAL departure date.
         */
        $trip['departure_date'],

        $trip['time'],

        $trip['plate'],

        $trip['bus_type'],

        (int) $trip['fare'],

        $trip['from_city'],

        json_encode($seats),

        $pnr

    ]);


    /*
     |--------------------------------------------------------------------------
     | GET CREATED BOOKING
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | RESPONSE
     |--------------------------------------------------------------------------
     */

    send_json(
        booking_to_ui(
            $created
        ),
        201,
        'Booking confirmed.'
    );
}


/*
|--------------------------------------------------------------------------
| CANCEL BOOKING
|--------------------------------------------------------------------------
|
| Passenger:
|   Can cancel own booking.
|
| Owner / Manager:
|   Can cancel any booking.
|
|--------------------------------------------------------------------------
*/

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


    /*
     |--------------------------------------------------------------------------
     | FIND BOOKING
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | PERMISSION
     |--------------------------------------------------------------------------
     */

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
            [
                'owner',
                'manager'
            ]
        );
    }


    /*
     |--------------------------------------------------------------------------
     | ALREADY CANCELLED
     |--------------------------------------------------------------------------
     */

    if (
        $booking['status'] ===
        'cancelled'
    ) {

        send_error(
            'Booking is already cancelled.'
        );
    }


    /*
     |--------------------------------------------------------------------------
     | CANCEL
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | RESPONSE
     |--------------------------------------------------------------------------
     */

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


/*
|--------------------------------------------------------------------------
| DELETE BOOKING
|--------------------------------------------------------------------------
|
| Owner / Manager only.
|
|--------------------------------------------------------------------------
*/

if ($method === 'DELETE') {

    require_role(
        $me,
        [
            'owner',
            'manager'
        ]
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


    /*
     |--------------------------------------------------------------------------
     | CHECK BOOKING EXISTS
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | DELETE
     |--------------------------------------------------------------------------
     */

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


    /*
     |--------------------------------------------------------------------------
     | RESPONSE
     |--------------------------------------------------------------------------
     */

    send_json(
        [
            'id' =>
                $id
        ],
        200,
        'Booking deleted.'
    );
}


/*
|--------------------------------------------------------------------------
| METHOD NOT ALLOWED
|--------------------------------------------------------------------------
*/

send_error(
    'Method not allowed.',
    405
);