<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner']);

$method = strtoupper($_SERVER['REQUEST_METHOD']);


/* ============================================================
   GET
   List all owner + manager accounts
   ============================================================ */

if ($method === 'GET') {

    $stmt = $pdo->query(
        "SELECT
            id,
            role,
            name,
            email,
            phone,
            status
         FROM accounts
         WHERE role IN ('owner', 'manager')
         ORDER BY role DESC, name"
    );

    send_json($stmt->fetchAll());
    exit;
}


/* ============================================================
   POST
   Add a new admin
   ============================================================ */

if ($method === 'POST') {

    $in = body();

    $name = trim($in['name'] ?? '');
    $email = trim($in['email'] ?? '');
    $phone = trim($in['phone'] ?? '');
    $role = $in['role'] ?? 'manager';


    if (!in_array($role, ['owner', 'manager'], true)) {
        $role = 'manager';
    }


    if (!$name || !$email) {
        send_error(
            'Name and email are required.'
        );
    }


    $exists = $pdo->prepare(
        'SELECT id
         FROM accounts
         WHERE email = ?'
    );

    $exists->execute([
        $email
    ]);


    if ($exists->fetch()) {
        send_error(
            'An account with this email already exists.'
        );
    }


    $tempPassword =
        !empty($in['password'])
            ? $in['password']
            : (
                'welcome-' .
                substr(
                    bin2hex(
                        random_bytes(4)
                    ),
                    0,
                    8
                )
            );


    $hash = password_hash(
        $tempPassword,
        PASSWORD_BCRYPT
    );


    $stmt = $pdo->prepare(
        "INSERT INTO accounts
        (
            role,
            name,
            email,
            phone,
            password_hash,
            status,
            added_by
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?,
            'active',
            ?
        )"
    );


    $stmt->execute([
        $role,
        $name,
        $email,
        $phone,
        $hash,
        $me['id']
    ]);


    send_json(
        [
            'id' => (int) $pdo->lastInsertId(),
            'tempPassword' => $tempPassword
        ],
        201,
        'Admin added.'
    );

    exit;
}


/* ============================================================
   PATCH
   Edit owner/manager account
   Supports:
     name
     email
     phone
     role
   ============================================================ */

if ($method === 'PATCH') {

    $in = body();

    $id = (int) ($in['id'] ?? 0);

    if (!$id) {
        send_error(
            'Missing account id.'
        );
    }


    /* Make sure target account exists */

    $check = $pdo->prepare(
        'SELECT id, role
         FROM accounts
         WHERE id = ?'
    );

    $check->execute([
        $id
    ]);

    $target = $check->fetch();


    if (!$target) {
        send_error(
            'Account not found.',
            404
        );
    }


    $fields = [];
    $params = [];


    /* Name */

    if (isset($in['name'])) {

        $name = trim(
            (string) $in['name']
        );

        if (!$name) {
            send_error(
                'Name cannot be empty.'
            );
        }

        $fields[] = 'name = ?';
        $params[] = $name;
    }


    /* Email */

    if (isset($in['email'])) {

        $email = trim(
            (string) $in['email']
        );

        if (!$email) {
            send_error(
                'Email cannot be empty.'
            );
        }


        $exists = $pdo->prepare(
            'SELECT id
             FROM accounts
             WHERE email = ?
               AND id != ?'
        );

        $exists->execute([
            $email,
            $id
        ]);


        if ($exists->fetch()) {
            send_error(
                'An account with this email already exists.'
            );
        }


        $fields[] = 'email = ?';
        $params[] = $email;
    }


    /* Phone */

    if (isset($in['phone'])) {

        $phone = trim(
            (string) $in['phone']
        );

        $fields[] = 'phone = ?';
        $params[] = $phone;
    }


    /* Role */

    if (isset($in['role'])) {

        $role = $in['role'];

        if (
            !in_array(
                $role,
                ['owner', 'manager'],
                true
            )
        ) {
            send_error(
                'Invalid role.'
            );
        }


        /*
         * Do not remove the last owner.
         */

        if (
            $target['role'] === 'owner' &&
            $role === 'manager'
        ) {

            $ownerCount = $pdo->query(
                "SELECT COUNT(*) AS c
                 FROM accounts
                 WHERE role = 'owner'"
            )->fetch();

            if (
                (int) $ownerCount['c'] <= 1
            ) {
                send_error(
                    "You can't change the last owner to manager."
                );
            }
        }


        $fields[] = 'role = ?';
        $params[] = $role;
    }


    if (!$fields) {
        send_error(
            'Nothing to update.'
        );
    }


    $params[] = $id;


    $sql =
        'UPDATE accounts
         SET ' .
        implode(', ', $fields) .
        ' WHERE id = ?';


    $stmt = $pdo->prepare($sql);

    $stmt->execute($params);


    send_json(
        [
            'id' => $id
        ],
        200,
        'Admin updated.'
    );

    exit;
}


/* ============================================================
   DELETE
   Remove an owner/manager account
   ============================================================ */

if ($method === 'DELETE') {

    $id = (int) ($_GET['id'] ?? 0);

    if (!$id) {
        send_error(
            'Missing account id.'
        );
    }


    $target = $pdo->prepare(
        'SELECT id, role
         FROM accounts
         WHERE id = ?'
    );

    $target->execute([
        $id
    ]);


    $row = $target->fetch();


    if (!$row) {
        send_error(
            'Not found.',
            404
        );
    }


    /* Prevent deleting the last owner */

    if ($row['role'] === 'owner') {

        $ownerCount = $pdo->query(
            "SELECT COUNT(*) AS c
             FROM accounts
             WHERE role = 'owner'"
        )->fetch();


        if (
            (int) $ownerCount['c'] <= 1
        ) {
            send_error(
                "You can't remove the last owner account."
            );
        }
    }


    $stmt = $pdo->prepare(
        'DELETE FROM accounts
         WHERE id = ?'
    );

    $stmt->execute([
        $id
    ]);


    send_json(
        [
            'id' => $id
        ],
        200,
        'Admin removed.'
    );

    exit;
}


/* ============================================================
   INVALID METHOD
   ============================================================ */

send_error(
    'Method not allowed.',
    405
);