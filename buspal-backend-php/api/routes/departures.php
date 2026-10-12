<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

/*
|--------------------------------------------------------------------------
| BusPal — Departures API
|--------------------------------------------------------------------------
|
| A departure belongs to:
|
|   route + date + time
|
| Supported:
|
| POST
|   Create departure
|
| PATCH
|   Update departure / assignments
|
| DELETE
|   Delete departure
|
|--------------------------------------------------------------------------
*/


$method =
    $_SERVER['REQUEST_METHOD'];


/*
|--------------------------------------------------------------------------
| BusPal timezone
|--------------------------------------------------------------------------
*/

date_default_timezone_set(
    'Asia/Colombo'
);


/*
|--------------------------------------------------------------------------
| Validate date
|--------------------------------------------------------------------------
*/

function validate_departure_date(
    $date
): string {

    $date =
        trim(
            (string) $date
        );


    $parsed =
        DateTime::createFromFormat(
            'Y-m-d',
            $date
        );


    $errors =
        DateTime::getLastErrors();


    if (
        !$parsed ||
        ($errors !== false && (
            $errors['warning_count'] > 0 ||
            $errors['error_count'] > 0
        )) ||
        $parsed->format('Y-m-d') !== $date
    ) {

        send_error(
            'Invalid departure date. Use YYYY-MM-DD format.',
            400
        );
    }


    return $date;
}


/*
|--------------------------------------------------------------------------
| Validate time
|--------------------------------------------------------------------------
*/

function validate_departure_time(
    $time
): string {

    $time =
        trim(
            (string) $time
        );


    if ($time === '') {

        send_error(
            'Departure time is required.',
            400
        );
    }


    /*
     * Accept HH:MM.
     */

    if (
        !preg_match(
            '/^([01]\d|2[0-3]):([0-5]\d)$/',
            $time
        )
    ) {

        /*
         * Also allow MySQL HH:MM:SS
         * and normalise it.
         */

        if (
            preg_match(
                '/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/',
                $time
            )
        ) {

            $time =
                substr(
                    $time,
                    0,
                    5
                );

        } else {

            send_error(
                'Invalid departure time. Use HH:MM format.',
                400
            );
        }
    }


    return $time;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

$me =
    require_auth($pdo);


require_role(
    $me,
    ['owner', 'manager']
);


/*
|--------------------------------------------------------------------------
| POST — CREATE DEPARTURE
|--------------------------------------------------------------------------
*/

if ($method === 'POST') {

    $in =
        body();


    $routeId =
        (int) (
            $in['routeId']
            ?? 0
        );


    /*
     * IMPORTANT:
     *
     * The frontend must send departureDate.
     *
     * If it does not, use today's Sri Lankan date.
     */

    $departureDate =
        $in['departureDate']
        ?? $in['departure_date']
        ?? date('Y-m-d');


    $time =
        $in['time']
        ?? '';


    /*
     * Validate route ID.
     */

    if (!$routeId) {

        send_error(
            'Route id is required.',
            400
        );
    }


    /*
     * Validate date.
     */

    $departureDate =
        validate_departure_date(
            $departureDate
        );


    /*
     * Validate time.
     */

    $time =
        validate_departure_time(
            $time
        );


    /*
     * Check route exists.
     */

    $routeStmt =
        $pdo->prepare(
            'SELECT id
             FROM routes
             WHERE id = ?
             LIMIT 1'
        );


    $routeStmt->execute([
        $routeId
    ]);


    if (!$routeStmt->fetch()) {

        send_error(
            'Route not found.',
            404
        );
    }


    /*
     * Prevent duplicate departure.
     */

    $duplicateStmt =
        $pdo->prepare(
            'SELECT id
             FROM departures
             WHERE route_id = ?
               AND departure_date = ?
               AND time = ?
             LIMIT 1'
        );


    $duplicateStmt->execute([
        $routeId,
        $departureDate,
        $time
    ]);


    if ($duplicateStmt->fetch()) {

        send_error(
            'A departure already exists for this route, date and time.',
            409
        );
    }


    /*
     * Insert.
     */

    $stmt =
        $pdo->prepare(
            'INSERT INTO departures
                (
                    route_id,
                    departure_date,
                    time
                )
             VALUES (?, ?, ?)'
        );


    $stmt->execute([
        $routeId,
        $departureDate,
        $time
    ]);


    $id =
        (int) $pdo->lastInsertId();


    send_json(
        [
            'id' =>
                $id,

            'routeId' =>
                $routeId,

            'departureDate' =>
                $departureDate,

            'time' =>
                $time,

            'busId' =>
                null,

            'driverId' =>
                null,

            'conductorId' =>
                null
        ],
        201,
        'Departure added.'
    );
}


/*
|--------------------------------------------------------------------------
| PATCH — UPDATE DEPARTURE
|--------------------------------------------------------------------------
|
| Supported fields:
|
| departureDate
| time
| busId
| driverId
| conductorId
|
|--------------------------------------------------------------------------
*/

if ($method === 'PATCH') {

    $in =
        body();


    $id =
        (int) (
            $in['id']
            ?? 0
        );


    if (!$id) {

        send_error(
            'Missing departure id.',
            400
        );
    }


    /*
     * Load current departure.
     */

    $currentStmt =
        $pdo->prepare(
            'SELECT
                id,
                route_id,
                departure_date,
                time,
                bus_id,
                driver_id,
                conductor_id
             FROM departures
             WHERE id = ?
             LIMIT 1'
        );


    $currentStmt->execute([
        $id
    ]);


    $current =
        $currentStmt->fetch(
            PDO::FETCH_ASSOC
        );


    if (!$current) {

        send_error(
            'Departure not found.',
            404
        );
    }


    $fields = [];
    $params = [];


    /*
     * New date.
     */

    $newDate =
        $current['departure_date'];


    if (
        array_key_exists(
            'departureDate',
            $in
        ) ||
        array_key_exists(
            'departure_date',
            $in
        )
    ) {

        $newDate =
            $in['departureDate']
            ?? $in['departure_date'];

        $newDate =
            validate_departure_date(
                $newDate
            );


        $fields[] =
            'departure_date = ?';

        $params[] =
            $newDate;
    }


    /*
     * New time.
     */

    $newTime =
        substr(
            (string) $current['time'],
            0,
            5
        );


    if (
        array_key_exists(
            'time',
            $in
        )
    ) {

        $newTime =
            validate_departure_time(
                $in['time']
            );


        $fields[] =
            'time = ?';

        $params[] =
            $newTime;
    }


    /*
     * Bus.
     */

    if (
        array_key_exists(
            'busId',
            $in
        )
    ) {

        $busId =
            $in['busId'];


        if (
            $busId === '' ||
            $busId === null
        ) {

            $busId = null;

        } else {

            $busId =
                (int) $busId;


            if ($busId <= 0) {
                $busId = null;
            }
        }


        /*
         * Validate bus if assigned.
         */

        if ($busId !== null) {

            $busStmt =
                $pdo->prepare(
                    'SELECT id
                     FROM buses
                     WHERE id = ?
                     LIMIT 1'
                );


            $busStmt->execute([
                $busId
            ]);


            if (!$busStmt->fetch()) {

                send_error(
                    'Selected bus was not found.',
                    404
                );
            }
        }


        $fields[] =
            'bus_id = ?';

        $params[] =
            $busId;
    }


    /*
     * Driver.
     */

    if (
        array_key_exists(
            'driverId',
            $in
        )
    ) {

        $driverId =
            $in['driverId'];


        if (
            $driverId === '' ||
            $driverId === null
        ) {

            $driverId = null;

        } else {

            $driverId =
                (int) $driverId;


            if ($driverId <= 0) {
                $driverId = null;
            }
        }


        /*
         * Validate driver.
         */

        if ($driverId !== null) {

            $driverStmt =
                $pdo->prepare(
                    'SELECT id
                     FROM staff
                     WHERE id = ?
                       AND role = "driver"
                     LIMIT 1'
                );


            $driverStmt->execute([
                $driverId
            ]);


            if (!$driverStmt->fetch()) {

                send_error(
                    'Selected driver was not found.',
                    404
                );
            }
        }


        $fields[] =
            'driver_id = ?';

        $params[] =
            $driverId;
    }


    /*
     * Conductor.
     */

    if (
        array_key_exists(
            'conductorId',
            $in
        )
    ) {

        $conductorId =
            $in['conductorId'];


        if (
            $conductorId === '' ||
            $conductorId === null
        ) {

            $conductorId = null;

        } else {

            $conductorId =
                (int) $conductorId;


            if ($conductorId <= 0) {
                $conductorId = null;
            }
        }


        /*
         * Validate conductor.
         */

        if ($conductorId !== null) {

            $conductorStmt =
                $pdo->prepare(
                    'SELECT id
                     FROM staff
                     WHERE id = ?
                       AND role = "conductor"
                     LIMIT 1'
                );


            $conductorStmt->execute([
                $conductorId
            ]);


            if (!$conductorStmt->fetch()) {

                send_error(
                    'Selected conductor was not found.',
                    404
                );
            }
        }


        $fields[] =
            'conductor_id = ?';

        $params[] =
            $conductorId;
    }


    /*
     * Nothing to update.
     */

    if (!$fields) {

        send_error(
            'Nothing to update.',
            400
        );
    }


    /*
     * Prevent duplicate departure.
     */

    if (
        array_key_exists(
            'departureDate',
            $in
        ) ||
        array_key_exists(
            'departure_date',
            $in
        ) ||
        array_key_exists(
            'time',
            $in
        )
    ) {

        $duplicateStmt =
            $pdo->prepare(
                'SELECT id
                 FROM departures
                 WHERE route_id = ?
                   AND departure_date = ?
                   AND time = ?
                   AND id != ?
                 LIMIT 1'
            );


        $duplicateStmt->execute([
            (int) $current['route_id'],
            $newDate,
            $newTime,
            $id
        ]);


        if ($duplicateStmt->fetch()) {

            send_error(
                'A departure already exists for this route, date and time.',
                409
            );
        }
    }


    /*
     * Execute update.
     */

    $params[] =
        $id;


    $sql =
        'UPDATE departures
         SET ' .
        implode(
            ', ',
            $fields
        ) .
        ' WHERE id = ?';


    $stmt =
        $pdo->prepare(
            $sql
        );


    $stmt->execute(
        $params
    );


    send_json(
        [
            'id' =>
                $id
        ],
        200,
        'Departure updated.'
    );
}


/*
|--------------------------------------------------------------------------
| DELETE — DELETE DEPARTURE
|--------------------------------------------------------------------------
*/

if ($method === 'DELETE') {

    $id =
        (int) (
            $_GET['id']
            ?? 0
        );


    if (!$id) {

        send_error(
            'Missing departure id.',
            400
        );
    }


    /*
     * Check exists.
     */

    $checkStmt =
        $pdo->prepare(
            'SELECT id
             FROM departures
             WHERE id = ?
             LIMIT 1'
        );


    $checkStmt->execute([
        $id
    ]);


    if (!$checkStmt->fetch()) {

        send_error(
            'Departure not found.',
            404
        );
    }


    /*
     * Delete.
     */

    $stmt =
        $pdo->prepare(
            'DELETE FROM departures
             WHERE id = ?'
        );


    $stmt->execute([
        $id
    ]);


    send_json(
        [
            'id' =>
                $id
        ],
        200,
        'Departure removed.'
    );
}


/*
|--------------------------------------------------------------------------
| Unsupported method
|--------------------------------------------------------------------------
*/

send_error(
    'Method not allowed.',
    405
);