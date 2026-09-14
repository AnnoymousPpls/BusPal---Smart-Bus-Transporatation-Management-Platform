<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $busId = (int) ($_POST['busId'] ?? 0);
    if (!$busId) send_error('Missing bus id.');
    if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) send_error('No photo uploaded.');

    if (!extension_loaded('gd')) send_error('Server is missing the GD extension needed to resize images.', 500);

    $tmpPath = $_FILES['photo']['tmp_name'];
    $info = getimagesize($tmpPath);
    if (!$info) send_error('That file isn\'t a valid image.');

    [$width, $height, $type] = $info;
    $src = match ($type) {
        IMAGETYPE_JPEG => imagecreatefromjpeg($tmpPath),
        IMAGETYPE_PNG => imagecreatefrompng($tmpPath),
        IMAGETYPE_WEBP => imagecreatefromwebp($tmpPath),
        default => null,
    };
    if (!$src) send_error('Unsupported image type — use JPEG, PNG, or WebP.');

    $maxWidth = 900;
    $scale = min(1, $maxWidth / $width);
    $newW = (int) round($width * $scale);
    $newH = (int) round($height * $scale);
    $resized = imagecreatetruecolor($newW, $newH);
    imagecopyresampled($resized, $src, 0, 0, 0, 0, $newW, $newH, $width, $height);

    $filename = 'bus_' . $busId . '_' . bin2hex(random_bytes(6)) . '.jpg';
    $uploadDir = __DIR__ . '/../../uploads/bus_photos/';
    imagejpeg($resized, $uploadDir . $filename, 72);
    imagedestroy($src);
    imagedestroy($resized);

    $publicPath = 'uploads/bus_photos/' . $filename;
    $order = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM bus_photos WHERE bus_id = ?');
    $order->execute([$busId]);
    $nextOrder = $order->fetch()['next_order'];

    $pdo->prepare('INSERT INTO bus_photos (bus_id, photo_path, sort_order) VALUES (?, ?, ?)')
        ->execute([$busId, $publicPath, $nextOrder]);

    send_json(['path' => $publicPath], 201, 'Photo uploaded.');
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) send_error('Missing photo id.');
    $stmt = $pdo->prepare('SELECT photo_path FROM bus_photos WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if ($row) {
        $fullPath = __DIR__ . '/../../' . $row['photo_path'];
        if (file_exists($fullPath)) unlink($fullPath);
        $pdo->prepare('DELETE FROM bus_photos WHERE id = ?')->execute([$id]);
    }
    send_json(['id' => $id], 200, 'Photo removed.');
}

send_error('Method not allowed.', 405);
