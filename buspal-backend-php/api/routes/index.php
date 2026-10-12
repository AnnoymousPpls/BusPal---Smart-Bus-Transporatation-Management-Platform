<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

/*
|--------------------------------------------------------------------------
| BusPal — Routes API
|--------------------------------------------------------------------------
|
| Routes are permanent.
| Departures belong to a route + specific date.
|
| GET
|   /routes/index.php
|       -> today's departures
|
|   /routes/index.php?date=2026-09-20
|       -> departures for selected date
|
|   /routes/index.php?scope=public
|       -> visible routes for today
|
|   /routes/index.php?scope=public&date=2026-09-20
|       -> visible routes for selected date
|
| POST
|   Create route
|
| PATCH
|   Update route / toggle visibility
|
| DELETE
|   Delete route
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Request method
|--------------------------------------------------------------------------
*/

$method = $_SERVER['REQUEST_METHOD'];


/*
|--------------------------------------------------------------------------
| BusPal timezone
|--------------------------------------------------------------------------
*/

date_default_timezone_set('Asia/Colombo');


/*
|--------------------------------------------------------------------------
| Validate date
|--------------------------------------------------------------------------
*/

function get_requested_date(): string
{
    $date = $_GET['date'] ?? date('Y-m-d');

    $date = trim((string) $date);

    $parsed = DateTime::createFromFormat(
        'Y-m-d',
        $date
    );

    $errors = DateTime::getLastErrors();

    if (
        !$parsed ||
        ($errors !== false && (
            $errors['warning_count'] > 0 ||
            $errors['error_count'] > 0
        )) ||
        $parsed->format('Y-m-d') !== $date
    ) {
        send_error(
            'Invalid date. Use YYYY-MM-DD format.',
            400
        );
    }

    return $date;
}


/*
|--------------------------------------------------------------------------
| Fetch routes
|--------------------------------------------------------------------------
*/

function fetch_routes(
    PDO $pdo,
    bool $visibleOnly = false,
    ?string $departureDate = null
): array {

    if ($departureDate === null) {
        $departureDate = date('Y-m-d');
    }


    /*
     * Fetch routes.
     */

    if ($visibleOnly) {

        $stmt = $pdo->prepare(
            'SELECT
                id,
                from_city,
                to_city,
                distance_km,
                fare,
                visible
             FROM routes
             WHERE visible = 1
             ORDER BY from_city, to_city'
        );

        $stmt->execute();

    } else {

        $stmt = $pdo->prepare(
            'SELECT
                id,
                from_city,
                to_city,
                distance_km,
                fare,
                visible
             FROM routes
             ORDER BY from_city, to_city'
        );

        $stmt->execute();
    }


    $routes = $stmt->fetchAll(PDO::FETCH_ASSOC);


    /*
     * Departure query.
     */

    $depStmt = $pdo->prepare(
        'SELECT
            d.id,
            d.route_id,
            d.departure_date,
            d.time,

            d.bus_id,
            d.driver_id,
            d.conductor_id,

            b.plate AS bus_plate,

            drv.name AS driver_name,

            cond.name AS conductor_name

         FROM departures d

         LEFT JOIN buses b
            ON b.id = d.bus_id

         LEFT JOIN staff drv
            ON drv.id = d.driver_id

         LEFT JOIN staff cond
            ON cond.id = d.conductor_id

         WHERE d.route_id = ?
           AND d.departure_date = ?

         ORDER BY d.time ASC'
    );


    /*
     * Build response.
     */

    foreach ($routes as &$route) {

        $routeId = (int) $route['id'];


        /*
         * Normalise route fields.
         */

        $route['id'] = $routeId;

        $route['from'] =
            $route['from_city'] ?? '';

        $route['to'] =
            $route['to_city'] ?? '';

        $route['distanceKm'] =
            (float) ($route['distance_km'] ?? 0);

        $route['fare'] =
            (float) ($route['fare'] ?? 0);

        $route['visible'] =
            (bool) $route['visible'];


        /*
         * Fetch departures for selected date.
         */

        $depStmt->execute([
            $routeId,
            $departureDate
        ]);


        $departures = [];


        while ($departure = $depStmt->fetch(PDO::FETCH_ASSOC)) {

            $departures[] = [

                'id' =>
                    (int) $departure['id'],

                'routeId' =>
                    (int) $departure['route_id'],

                'departureDate' =>
                    $departure['departure_date'],

                'time' =>
                    $departure['time']
                        ? substr(
                            (string) $departure['time'],
                            0,
                            5
                        )
                        : '',

                'busId' =>
                    $departure['bus_id'] !== null
                        ? (int) $departure['bus_id']
                        : null,

                'driverId' =>
                    $departure['driver_id'] !== null
                        ? (int) $departure['driver_id']
                        : null,

                'conductorId' =>
                    $departure['conductor_id'] !== null
                        ? (int) $departure['conductor_id']
                        : null,

                'busPlate' =>
                    $departure['bus_plate'] ?? '',

                'driverName' =>
                    $departure['driver_name'] ?? '',

                'conductorName' =>
                    $departure['conductor_name'] ?? '',
            ];
        }


        $route['departures'] =
            $departures;
    }


    unset($route);


    return $routes;
}


/*
|--------------------------------------------------------------------------
| GET — Public routes
|--------------------------------------------------------------------------
*/

if (
    $method === 'GET' &&
    ($_GET['scope'] ?? '') === 'public'
) {

    $departureDate =
        get_requested_date();


    send_json(
        fetch_routes(
            $pdo,
            true,
            $departureDate
        )
    );
}


/*
|--------------------------------------------------------------------------
| GET — Operator routes
|--------------------------------------------------------------------------
*/

if ($method === 'GET') {

    $departureDate =
        get_requested_date();


    send_json(
        fetch_routes(
            $pdo,
            false,
            $departureDate
        )
    );
}


/*
|--------------------------------------------------------------------------
| Authentication for modifications
|--------------------------------------------------------------------------
*/

$me = require_auth($pdo);

require_role(
    $me,
    ['owner', 'manager']
);


/*
|--------------------------------------------------------------------------
| POST — CREATE ROUTE
|--------------------------------------------------------------------------
*/

if ($method === 'POST') {

    $in = body();


    $from =
        trim(
            (string) ($in['from'] ?? '')
        );

    $to =
        trim(
            (string) ($in['to'] ?? '')
        );


    if ($from === '') {

        send_error(
            'From city is required.',
            400
        );
    }


    if ($to === '') {

        send_error(
            'To city is required.',
            400
        );
    }


    if (
        mb_strtolower($from) ===
        mb_strtolower($to)
    ) {

        send_error(
            'From and to cities cannot be the same.',
            400
        );
    }


    $distanceKm =
        (float) (
            $in['distanceKm']
            ?? $in['distance_km']
            ?? 0
        );


    $fare =
        (float) (
            $in['fare']
            ?? 0
        );


    /*
     * New routes should be visible by default.
     */

    $visible =
        array_key_exists(
            'visible',
            $in
        )
            ? (
                filter_var(
                    $in['visible'],
                    FILTER_VALIDATE_BOOLEAN,
                    FILTER_NULL_ON_FAILURE
                ) ?? false
            )
            : true;


    if ($distanceKm < 0) {

        send_error(
            'Distance cannot be negative.',
            400
        );
    }


    if ($fare < 0) {

        send_error(
            'Fare cannot be negative.',
            400
        );
    }


    /*
     * Check duplicate route.
     */

    $duplicateStmt =
        $pdo->prepare(
            'SELECT id
             FROM routes
             WHERE LOWER(from_city) = LOWER(?)
               AND LOWER(to_city) = LOWER(?)
             LIMIT 1'
        );


    $duplicateStmt->execute([
        $from,
        $to
    ]);


    if ($duplicateStmt->fetch()) {

        send_error(
            'This route already exists.',
            409
        );
    }


    /*
     * Insert route.
     */

    $stmt =
        $pdo->prepare(
            'INSERT INTO routes
                (
                    from_city,
                    to_city,
                    distance_km,
                    fare,
                    visible
                )
             VALUES (?, ?, ?, ?, ?)'
        );


    $stmt->execute([
        $from,
        $to,
        $distanceKm,
        $fare,
        $visible ? 1 : 0
    ]);


    $id =
        (int) $pdo->lastInsertId();


    send_json(
        [
            'id' => $id,
            'from' => $from,
            'to' => $to,
            'distanceKm' => $distanceKm,
            'fare' => $fare,
            'visible' => $visible,
            'departures' => []
        ],
        201,
        'Route added.'
    );
}


/*
|--------------------------------------------------------------------------
| PATCH — UPDATE ROUTE
|--------------------------------------------------------------------------
*/

if ($method === 'PATCH') {

    $in = body();


    $id =
        (int) ($in['id'] ?? 0);


    if (!$id) {

        send_error(
            'Missing route id.',
            400
        );
    }


    /*
     * Check route exists.
     */

    $checkStmt =
        $pdo->prepare(
            'SELECT id
             FROM routes
             WHERE id = ?
             LIMIT 1'
        );


    $checkStmt->execute([
        $id
    ]);


    if (!$checkStmt->fetch()) {

        send_error(
            'Route not found.',
            404
        );
    }


    /*
     * Toggle visibility.
     */

    if (
        ($in['action'] ?? '') ===
        'toggle-visible'
    ) {

        $stmt =
            $pdo->prepare(
                'UPDATE routes
                 SET visible =
                     CASE
                         WHEN visible = 1 THEN 0
                         ELSE 1
                     END
                 WHERE id = ?'
            );


        $stmt->execute([
            $id
        ]);


        $resultStmt =
            $pdo->prepare(
                'SELECT visible
                 FROM routes
                 WHERE id = ?'
            );


        $resultStmt->execute([
            $id
        ]);


        $result =
            $resultStmt->fetch(
                PDO::FETCH_ASSOC
            );


        send_json(
            [
                'id' => $id,
                'visible' =>
                    (bool) ($result['visible'] ?? false)
            ],
            200,
            'Visibility updated.'
        );
    }


    /*
     * Normal update.
     */

    $fields = [];
    $params = [];


    if (array_key_exists('from', $in)) {

        $from =
            trim(
                (string) $in['from']
            );


        if ($from === '') {

            send_error(
                'From city cannot be empty.',
                400
            );
        }


        $fields[] =
            'from_city = ?';

        $params[] =
            $from;
    }


    if (array_key_exists('to', $in)) {

        $to =
            trim(
                (string) $in['to']
            );


        if ($to === '') {

            send_error(
                'To city cannot be empty.',
                400
            );
        }


        $fields[] =
            'to_city = ?';

        $params[] =
            $to;
    }


    if (array_key_exists('distanceKm', $in)) {

        $distanceKm =
            (float) $in['distanceKm'];


        if ($distanceKm < 0) {

            send_error(
                'Distance cannot be negative.',
                400
            );
        }


        $fields[] =
            'distance_km = ?';

        $params[] =
            $distanceKm;
    }


    if (array_key_exists('fare', $in)) {

        $fare =
            (float) $in['fare'];


        if ($fare < 0) {

            send_error(
                'Fare cannot be negative.',
                400
            );
        }


        $fields[] =
            'fare = ?';

        $params[] =
            $fare;
    }


    if (!$fields) {

        send_error(
            'Nothing to update.',
            400
        );
    }


    /*
     * Prevent duplicate route.
     */

    $newFrom = null;
    $newTo = null;


    if (
        array_key_exists('from', $in) ||
        array_key_exists('to', $in)
    ) {

        $currentStmt =
            $pdo->prepare(
                'SELECT
                    from_city,
                    to_city
                 FROM routes
                 WHERE id = ?'
            );


        $currentStmt->execute([
            $id
        ]);


        $current =
            $currentStmt->fetch(
                PDO::FETCH_ASSOC
            );


        $newFrom =
            array_key_exists('from', $in)
                ? trim((string) $in['from'])
                : $current['from_city'];

        $newTo =
            array_key_exists('to', $in)
                ? trim((string) $in['to'])
                : $current['to_city'];


        $duplicateStmt =
            $pdo->prepare(
                'SELECT id
                 FROM routes
                 WHERE LOWER(from_city) = LOWER(?)
                   AND LOWER(to_city) = LOWER(?)
                   AND id != ?
                 LIMIT 1'
            );


        $duplicateStmt->execute([
            $newFrom,
            $newTo,
            $id
        ]);


        if ($duplicateStmt->fetch()) {

            send_error(
                'This route already exists.',
                409
            );
        }
    }


    $params[] =
        $id;


    $sql =
        'UPDATE routes
         SET ' .
        implode(', ', $fields) .
        ' WHERE id = ?';


    $stmt =
        $pdo->prepare($sql);


    $stmt->execute(
        $params
    );


    send_json(
        [
            'id' => $id
        ],
        200,
        'Route updated.'
    );
}


/*
|--------------------------------------------------------------------------
| DELETE — DELETE ROUTE
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
            'Missing route id.',
            400
        );
    }


    /*
     * Check route exists.
     */

    $checkStmt =
        $pdo->prepare(
            'SELECT id
             FROM routes
             WHERE id = ?
             LIMIT 1'
        );


    $checkStmt->execute([
        $id
    ]);


    if (!$checkStmt->fetch()) {

        send_error(
            'Route not found.',
            404
        );
    }


    /*
     * Delete departures first.
     *
     * This makes the API work even when
     * foreign keys do not have CASCADE.
     */

    $pdo->beginTransaction();


    try {

        $depStmt =
            $pdo->prepare(
                'DELETE FROM departures
                 WHERE route_id = ?'
            );


        $depStmt->execute([
            $id
        ]);


        $routeStmt =
            $pdo->prepare(
                'DELETE FROM routes
                 WHERE id = ?'
            );


        $routeStmt->execute([
            $id
        ]);


        $pdo->commit();

    } catch (Throwable $error) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }


        error_log(
            'Route delete failed: ' .
            $error->getMessage()
        );


        send_error(
            'Unable to delete route.',
            500
        );
    }


    send_json(
        [
            'id' => $id
        ],
        200,
        'Route deleted.'
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