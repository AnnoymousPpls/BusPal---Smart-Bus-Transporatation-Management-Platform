<?php

require_once __DIR__ . '/../../includes/auth_helper.php';

$me = require_auth($pdo);
require_role($me, ['owner', 'manager']);

$method = strtoupper($_SERVER['REQUEST_METHOD']);


/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

$uploadDir = __DIR__ . '/../../uploads/bus_photos/';
$publicDir = 'uploads/bus_photos/';
$maxPhotosPerBus = 4;


/*
|--------------------------------------------------------------------------
| HELPER: CREATE UPLOAD DIRECTORY
|--------------------------------------------------------------------------
*/

function ensure_upload_directory(string $directory): void
{
    /*
     * On Windows/XAMPP, is_writable() can sometimes incorrectly
     * return false even though PHP can actually write to the folder.
     *
     * Therefore we DO NOT use is_writable() here.
     */

    if (!is_dir($directory)) {

        if (!mkdir($directory, 0777, true)) {

            if (!is_dir($directory)) {
                send_error(
                    'Unable to create bus photo upload directory.',
                    500
                );
            }
        }
    }

    if (!is_dir($directory)) {
        send_error(
            'Bus photo upload directory does not exist.',
            500
        );
    }
}


/*
|--------------------------------------------------------------------------
| HELPER: GET PHOTO COUNT
|--------------------------------------------------------------------------
*/

function get_bus_photo_count(PDO $pdo, int $busId): int
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM bus_photos
         WHERE bus_id = ?'
    );

    $stmt->execute([$busId]);

    return (int) $stmt->fetchColumn();
}


/*
|--------------------------------------------------------------------------
| POST
| Upload bus photo
|--------------------------------------------------------------------------
*/

if ($method === 'POST') {

    $busId = (int) ($_POST['busId'] ?? 0);

    if (!$busId) {
        send_error('Missing bus id.');
    }


    /*
    |--------------------------------------------------------------------------
    | Check bus exists
    |--------------------------------------------------------------------------
    */

    $busStmt = $pdo->prepare(
        'SELECT id
         FROM buses
         WHERE id = ?
         LIMIT 1'
    );

    $busStmt->execute([$busId]);

    if (!$busStmt->fetch()) {
        send_error(
            'Bus not found.',
            404
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Maximum 4 photos
    |--------------------------------------------------------------------------
    */

    $photoCount = get_bus_photo_count(
        $pdo,
        $busId
    );

    if ($photoCount >= $maxPhotosPerBus) {

        send_error(
            'This bus already has the maximum of 4 photos.',
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check uploaded file
    |--------------------------------------------------------------------------
    */

    if (
        empty($_FILES['photo']) ||
        !isset($_FILES['photo']['error'])
    ) {
        send_error(
            'No photo uploaded.'
        );
    }


    if (
        $_FILES['photo']['error'] !== UPLOAD_ERR_OK
    ) {

        $uploadError = $_FILES['photo']['error'];

        $message = match ($uploadError) {

            UPLOAD_ERR_INI_SIZE,
            UPLOAD_ERR_FORM_SIZE =>
                'The uploaded photo is too large.',

            UPLOAD_ERR_PARTIAL =>
                'The photo upload was incomplete.',

            UPLOAD_ERR_NO_FILE =>
                'No photo was uploaded.',

            UPLOAD_ERR_NO_TMP_DIR =>
                'Server temporary upload directory is missing.',

            UPLOAD_ERR_CANT_WRITE =>
                'PHP could not write the uploaded file.',

            UPLOAD_ERR_EXTENSION =>
                'The upload was stopped by a PHP extension.',

            default =>
                'Photo upload failed.'
        };

        send_error(
            $message,
            400
        );
    }


    $tmpPath = $_FILES['photo']['tmp_name'];


    if (!is_uploaded_file($tmpPath)) {

        send_error(
            'Invalid uploaded file.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Check GD
    |--------------------------------------------------------------------------
    */

    if (!extension_loaded('gd')) {

        send_error(
            'Server is missing the GD extension needed to process images.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Validate image
    |--------------------------------------------------------------------------
    */

    $info = @getimagesize($tmpPath);

    if (!$info) {

        send_error(
            'That file is not a valid image.'
        );
    }


    $width  = (int) $info[0];
    $height = (int) $info[1];
    $type   = (int) $info[2];


    /*
    |--------------------------------------------------------------------------
    | Allow only JPEG / PNG / WEBP
    |--------------------------------------------------------------------------
    */

    $allowedTypes = [
        IMAGETYPE_JPEG,
        IMAGETYPE_PNG,
        IMAGETYPE_WEBP
    ];

    if (!in_array($type, $allowedTypes, true)) {

        send_error(
            'Unsupported image type. Use JPEG, PNG, or WebP.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Create source image
    |--------------------------------------------------------------------------
    */

    $src = match ($type) {

        IMAGETYPE_JPEG =>
            @imagecreatefromjpeg($tmpPath),

        IMAGETYPE_PNG =>
            @imagecreatefrompng($tmpPath),

        IMAGETYPE_WEBP =>
            @imagecreatefromwebp($tmpPath),

        default =>
            null
    };


    if (!$src) {

        send_error(
            'Unable to process the uploaded image.',
            400
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Resize image
    |--------------------------------------------------------------------------
    |
    | Maximum width = 900px
    |
    | Smaller images are NOT enlarged.
    |
    */

    $maxWidth = 900;

    $scale = min(
        1,
        $maxWidth / $width
    );

    $newWidth = max(
        1,
        (int) round($width * $scale)
    );

    $newHeight = max(
        1,
        (int) round($height * $scale)
    );


    $resized = imagecreatetruecolor(
        $newWidth,
        $newHeight
    );


    if (!$resized) {

        imagedestroy($src);

        send_error(
            'Unable to create resized image.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Preserve transparency
    |--------------------------------------------------------------------------
    */

    imagealphablending(
        $resized,
        false
    );

    imagesavealpha(
        $resized,
        true
    );


    /*
    |--------------------------------------------------------------------------
    | Resize
    |--------------------------------------------------------------------------
    */

    $copied = imagecopyresampled(
        $resized,
        $src,
        0,
        0,
        0,
        0,
        $newWidth,
        $newHeight,
        $width,
        $height
    );


    if (!$copied) {

        imagedestroy($src);
        imagedestroy($resized);

        send_error(
            'Unable to resize bus photo.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Make sure upload directory exists
    |--------------------------------------------------------------------------
    */

    $uploadDir = __DIR__ . '/../../uploads/bus_photos/';

    ensure_upload_directory(
        $uploadDir
    );


    /*
    |--------------------------------------------------------------------------
    | Generate unique filename
    |--------------------------------------------------------------------------
    */

    try {

        $randomName = bin2hex(
            random_bytes(8)
        );

    } catch (Throwable $e) {

        imagedestroy($src);
        imagedestroy($resized);

        send_error(
            'Unable to generate photo filename.',
            500
        );
    }


    $filename =
        'bus_' .
        $busId .
        '_' .
        $randomName .
        '.jpg';


    $fullPath =
        $uploadDir .
        $filename;


    /*
    |--------------------------------------------------------------------------
    | Save JPEG
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | We intentionally DO NOT use is_writable().
    |
    | imagejpeg() itself tells us whether PHP can actually write.
    |
    */

    $saved = @imagejpeg(
        $resized,
        $fullPath,
        82
    );


    /*
    |--------------------------------------------------------------------------
    | Clean image resources
    |--------------------------------------------------------------------------
    */

    imagedestroy($src);
    imagedestroy($resized);


    /*
    |--------------------------------------------------------------------------
    | Verify save
    |--------------------------------------------------------------------------
    */

    if (
        !$saved ||
        !file_exists($fullPath) ||
        filesize($fullPath) <= 0
    ) {

        /*
         * If a partial file was created, remove it.
         */

        if (file_exists($fullPath)) {
            @unlink($fullPath);
        }

        send_error(
            'Failed to save bus photo. PHP could not write the image to the upload directory.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Public path
    |--------------------------------------------------------------------------
    */

    $publicPath =
        $publicDir .
        $filename;


    /*
    |--------------------------------------------------------------------------
    | Find next sort order
    |--------------------------------------------------------------------------
    */

    $orderStmt = $pdo->prepare(
        'SELECT
            COALESCE(
                MAX(sort_order),
                -1
            ) + 1
         FROM bus_photos
         WHERE bus_id = ?'
    );

    $orderStmt->execute([
        $busId
    ]);

    $nextOrder =
        (int) $orderStmt->fetchColumn();


    /*
    |--------------------------------------------------------------------------
    | Save database record
    |--------------------------------------------------------------------------
    */

    try {

        $stmt = $pdo->prepare(
            'INSERT INTO bus_photos
                (
                    bus_id,
                    photo_path,
                    sort_order
                )
             VALUES
                (?, ?, ?)'
        );

        $stmt->execute([
            $busId,
            $publicPath,
            $nextOrder
        ]);

    } catch (Throwable $e) {

        /*
         * Database failed, so remove the physical file
         * to prevent orphaned images.
         */

        if (file_exists($fullPath)) {
            @unlink($fullPath);
        }

        error_log(
            'Bus photo database error: ' .
            $e->getMessage()
        );

        send_error(
            'Photo was saved but could not be registered in the database.',
            500
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Success
    |--------------------------------------------------------------------------
    */

    send_json(
        [
            'id' =>
                (int) $pdo->lastInsertId(),

            'busId' =>
                $busId,

            'path' =>
                $publicPath
        ],
        201,
        'Photo uploaded successfully.'
    );
}


/*
|--------------------------------------------------------------------------
| DELETE
| Delete bus photo
|--------------------------------------------------------------------------
*/

if ($method === 'DELETE') {

    $id =
        (int) (
            $_GET['id'] ?? 0
        );


    if (!$id) {

        send_error(
            'Missing photo id.'
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Find photo
    |--------------------------------------------------------------------------
    */

    $stmt = $pdo->prepare(
        'SELECT
            id,
            photo_path
         FROM bus_photos
         WHERE id = ?
         LIMIT 1'
    );

    $stmt->execute([
        $id
    ]);

    $photo = $stmt->fetch();


    if (!$photo) {

        send_error(
            'Photo not found.',
            404
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Build physical file path
    |--------------------------------------------------------------------------
    */

    $relativePath =
        ltrim(
            $photo['photo_path'],
            '/\\'
        );


    $fullPath =
        __DIR__ .
        '/../../' .
        str_replace(
            '/',
            DIRECTORY_SEPARATOR,
            $relativePath
        );


    /*
    |--------------------------------------------------------------------------
    | Delete physical image
    |--------------------------------------------------------------------------
    */

    if (file_exists($fullPath)) {

        if (!@unlink($fullPath)) {

            send_error(
                'Unable to delete photo file from server.',
                500
            );
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Delete database record
    |--------------------------------------------------------------------------
    */

    $deleteStmt = $pdo->prepare(
        'DELETE FROM bus_photos
         WHERE id = ?'
    );

    $deleteStmt->execute([
        $id
    ]);


    /*
    |--------------------------------------------------------------------------
    | Success
    |--------------------------------------------------------------------------
    */

    send_json(
        [
            'id' =>
                $id
        ],
        200,
        'Photo removed successfully.'
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