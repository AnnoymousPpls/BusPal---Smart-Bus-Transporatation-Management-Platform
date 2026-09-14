<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/response.php';

function generate_token(): string {
    return bin2hex(random_bytes(32)); // 64 hex chars, matches auth_tokens.token CHAR(64)
}

function create_session(PDO $pdo, int $accountId): string {
    $token = generate_token();
    $stmt = $pdo->prepare('INSERT INTO auth_tokens (token, account_id) VALUES (?, ?)');
    $stmt->execute([$token, $accountId]);
    return $token;
}

/** Reads the Authorization: Bearer <token> header from any server/proxy config that might mangle it. */
function bearer_token(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? null) : null);
    if (!$header || stripos($header, 'Bearer ') !== 0) return null;
    return trim(substr($header, 7));
}

/** Returns the logged-in account row, or sends a 401 and exits if there isn't one. Call this at the top of any protected endpoint. */
function require_auth(PDO $pdo): array {
    $token = bearer_token();
    if (!$token) send_error('Not logged in.', 401);

    $stmt = $pdo->prepare(
        'SELECT a.* FROM auth_tokens t JOIN accounts a ON a.id = t.account_id WHERE t.token = ?'
    );
    $stmt->execute([$token]);
    $account = $stmt->fetch();
    if (!$account) send_error('Session expired — please log in again.', 401);
    return $account;
}

/** Call after require_auth() when an endpoint is restricted to specific roles (e.g. ['owner']). */
function require_role(array $account, array $allowedRoles): void {
    if (!in_array($account['role'], $allowedRoles, true)) {
        send_error('You don\'t have permission to do that.', 403);
    }
}
