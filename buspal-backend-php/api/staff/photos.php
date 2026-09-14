<?php
require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {

    $staffId = (int) ($_POST['staffId'] ?? 0);

    if (!$staffId) {
        send_error('Missing staff id.');
    }

    if (
        empty($_FILES['photo']) ||
        $_FILES['photo']['error'] !== UPLOAD_ERR_OK
    ) {
        send_error('No photo uploaded.');
    }

    if (!extension_loaded('gd')) {
        send_error(
            'Server is missing the GD extension needed to resize images.',
            500
        );
    }

    $stmt = $pdo->prepare(
        'SELECT id, photo_path FROM staff WHERE id = ?'
    );
    $stmt->execute([$staffId]);

    $staff = $stmt->fetch();

    if (!$staff) {
        send_error('Staff member not found.', 404);
    }

    $tmpPath = $_FILES['photo']['tmp_name'];

    $info = getimagesize($tmpPath);

    if (!$info) {
        send_error('That file is not a valid image.');
    }

    [$width, $height, $type] = $info;

    $src = match ($type) {
        IMAGETYPE_JPEG => imagecreatefromjpeg($tmpPath),
        IMAGETYPE_PNG  => imagecreatefrompng($tmpPath),
        IMAGETYPE_WEBP => imagecreatefromwebp($tmpPath),
        default => null,
    };

    if (!$src) {
        send_error(
            'Unsupported image type — use JPEG, PNG, or WebP.'
        );
    }

    $maxWidth = 600;

    $scale = min(1, $maxWidth / $width);

    $newW = (int) round($width * $scale);
    $newH = (int) round($height * $scale);

    $resized = imagecreatetruecolor(
        $newW,
        $newH
    );

    imagecopyresampled(
        $resized,
        $src,
        0,
        0,
        0,
        0,
        $newW,
        $newH,
        $width,
        $height
    );

    $uploadDir =
        __DIR__ . '/../../uploads/staff_photos/';

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $filename =
        'staff_' .
        $staffId .
        '_' .
        bin2hex(random_bytes(6)) .
        '.jpg';

    $fullPath =
        $uploadDir . $filename;

    if (!imagejpeg($resized, $fullPath, 82)) {
        imagedestroy($src);
        imagedestroy($resized);

        send_error(
            'Failed to save the staff photo.',
            500
        );
    }

    imagedestroy($src);
    imagedestroy($resized);

    /*
     * Delete previous staff photo if one exists.
     */
    if (!empty($staff['photo_path'])) {

        $oldPath =
            __DIR__ . '/../../' .
            $staff['photo_path'];

        if (
            is_file($oldPath) &&
            realpath($oldPath) !== realpath($fullPath)
        ) {
            @unlink($oldPath);
        }
    }

    $publicPath =
        'uploads/staff_photos/' .
        $filename;

    $stmt = $pdo->prepare(
        'UPDATE staff SET photo_path = ? WHERE id = ?'
    );

    $stmt->execute([
        $publicPath,
        $staffId
    ]);

    send_json(
        [
            'id' => $staffId,
            'path' => $publicPath
        ],
        200,
        'Staff photo uploaded.'
    );
}

if ($method === 'DELETE') {

    $staffId =
        (int) ($_GET['staffId'] ?? 0);

    if (!$staffId) {
        send_error('Missing staff id.');
    }

    $stmt = $pdo->prepare(
        'SELECT photo_path FROM staff WHERE id = ?'
    );

    $stmt->execute([$staffId]);

    $staff = $stmt->fetch();

    if (!$staff) {
        send_error('Staff member not found.', 404);
    }

    if (!empty($staff['photo_path'])) {

        $fullPath =
            __DIR__ . '/../../' .
            $staff['photo_path'];

        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }

    $pdo->prepare(
        'UPDATE staff SET photo_path = NULL WHERE id = ?'
    )->execute([$staffId]);

    send_json(
        ['id' => $staffId],
        200,
        'Staff photo removed.'
    );
}

send_error('Method not allowed.', 405);