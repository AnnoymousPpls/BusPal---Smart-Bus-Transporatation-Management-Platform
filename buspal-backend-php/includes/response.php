<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // tighten this to your actual frontend origin before going anywhere near production
header('Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function send_json($data, int $status = 200, ?string $message = null): void {
    http_response_code($status);
    echo json_encode([
        'success' => $status >= 200 && $status < 300,
        'data' => $data,
        'message' => $message,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function send_error(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(['success' => false, 'data' => null, 'message' => $message]);
    exit;
}

/** Reads and JSON-decodes the request body. Returns [] if empty/invalid rather than null, so callers can use ?? safely. */
function body(): array {
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
