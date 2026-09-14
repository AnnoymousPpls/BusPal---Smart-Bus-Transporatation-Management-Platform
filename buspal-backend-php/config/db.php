<?php
/**
 * Database connection — WAMP defaults out of the box (root user,
 * blank password, localhost). If you changed WAMP's MySQL root
 * password, or created a dedicated buspal user, update below.
 */

$DB_HOST = 'localhost';
$DB_NAME = 'buspal_php';
$DB_USER = 'root';
$DB_PASS = 'root'; // WAMP's default root password is blank

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed. Is WAMP running (green icon)? Have you imported config/schema.sql? Details: ' . $e->getMessage(),
    ]);
    exit;
}
