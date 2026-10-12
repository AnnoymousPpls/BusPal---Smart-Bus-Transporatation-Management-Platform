<?php

require_once __DIR__ . '/../../includes/auth_helper.php';


/*
|--------------------------------------------------------------------------
| PROFILE API
|--------------------------------------------------------------------------
| Returns authenticated account details
|
*/


$user = require_auth($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {


    $input = body();


    $stmt = $pdo->prepare("
        UPDATE accounts
        SET
            name = ?,
            email = ?,
            phone = ?,
            nic = ?
        WHERE id = ?
    ");


    $stmt->execute([

        $input['name'] ?? '',
        $input['email'] ?? '',
        $input['phone'] ?? '',
        $input['nic'] ?? null,
        $user['id']

    ]);


    send_json([
        "message"=>"Profile updated"
    ]);

}


if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    send_error(
        'Method not allowed.',
        405
    );

}



$stmt = $pdo->prepare(
    "
    SELECT
        id,
        role,
        name,
        email,
        phone,
        nic,
        created_at
    FROM accounts
    WHERE id = ?
    "
);


$stmt->execute([
    $user['id']
]);


$account = $stmt->fetch();



if (!$account) {

    send_error(
        'Account not found.',
        404
    );

}



send_json([

    'id' =>
        (int)$account['id'],


    'role' =>
        $account['role'],


    'name' =>
        $account['name'],


    'email' =>
        $account['email'],


    'phone' =>
        $account['phone'],


    'nic' =>
        $account['nic'],


    'joined' =>
        $account['created_at']

]);