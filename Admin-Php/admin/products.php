<?php
require __DIR__ . '/../vendor/autoload.php';
use Google\Cloud\Storage\StorageClient;
use GuzzleHttp\Client;

session_start();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Set the session variable to mark the form as submitted
        $_SESSION['form_submitted'] = true;

        // Collect item details
        $itemName = $_POST['itemName'];
        $itemPrice = $_POST['itemPrice'];
        $itemType = $_POST['itemType'];
        $quantity = $_POST['quantity'];

        // Create a storage client
        $storage = new StorageClient([
            'projectId' => 'test-dc739',
            'keyFilePath' => __DIR__ . '/../servicekey/test-dc739.json',
        ]);

        // Get the bucket
        $bucketName = 'test-dc739.appspot.com';
        $bucket = $storage->bucket($bucketName);

        // Specify the file to upload
        $localFilePath = $_FILES['file']['tmp_name']; // Temporary file path
        $fileName = $_FILES['file']['name']; // Get the original file name
        $objectName = 'images/' . $fileName; // Specify the object name within the "images" directory

        // Upload the file
        $bucket->upload(
            fopen($localFilePath, 'r'), // Open the local file for reading
            [
                'name' => $objectName // Specify the object name in GCS
            ]
        );

        // Update Firebase Realtime Database with the filename and item details
        $firebaseDatabaseUrl = 'https://test-dc739-default-rtdb.firebaseio.com';
        $firebaseDatabaseSecret = 'HBaErp2c6d8XDLVJgVavNdwt0TVHluu0ghw5KXOR'; // Replace with your Firebase project's database secret

        $client = new Client();

        // Get the current products to create a new product ID
        $response = $client->get($firebaseDatabaseUrl . '/categories.json?auth=' . $firebaseDatabaseSecret);
        $currentProducts = json_decode($response->getBody(), true) ?: [];

        // Create a new product node in the "categories" collection
        $newProductKey = findAvailableProductKey($currentProducts);
        $currentProducts[$newProductKey] = [
            'filename' => $fileName,
            'itemPrice' => $itemPrice,
            'itemType' => $itemType,
            'product_name' => $itemName,
            'quantity' => $quantity,
        ];

        // Update the "categories" node with the new array using PUT method
        $response = $client->put($firebaseDatabaseUrl . '/categories.json?auth=' . $firebaseDatabaseSecret, [
            'json' => $currentProducts
        ]);

        $success_message = 'File uploaded successfully! Product ID: ' . $newProductKey;
        header("Location: products.php?success=" . urlencode($success_message));
        exit();
    }
} catch (Exception $e) {
    $error_message = 'Error: ' . $e->getMessage();
    header("Location: products.php?error=" . urlencode($error_message));
    exit();
}

// Display Products

// Function to find an available product key
function findAvailableProductKey($currentProducts) {
    $existingKeys = array_keys($currentProducts);

    // Find the first available key that is not in use
    for ($i = 1; $i <= count($existingKeys) + 1; $i++) {
        $potentialKey = 'p' . $i;
        if (!in_array($potentialKey, $existingKeys)) {
            return $potentialKey;
        }
    }

    // Fallback to a new key if needed (though this should not occur in normal scenarios)
    return 'p' . (count($existingKeys) + 1);
}

// Display Products (Continued)
$firebase_url = 'https://test-dc739-default-rtdb.firebaseio.com/categories.json';
$data_json = file_get_contents($firebase_url);

if ($data_json === false) {
    $error_message = 'Error fetching data from Firebase.';
    header("Location: products.php?error=" . urlencode($error_message));
    exit();
} else {
    $data = json_decode($data_json, true);

    if (is_array($data)) {
        $products = [];

        foreach ($data as $productId => $product) {
            $products[$productId] = [
                'name' => $product['product_name'],
                'image' => generateImageDownloadUrl($product['filename']),
                'price' => $product['itemPrice'],
                'quantity' => $product['quantity'],
                'type' => $product['itemType'],
            ];
        }
    } else {
        $error_message = 'No products added yet!';
        header("Location: products.php?error=" . urlencode($error_message));
        exit();
    }
}

// Function to generate a signed URL for image download
function generateImageDownloadUrl($filename) {
    $storageBucket = 'test-dc739.appspot.com';
    $imagePath = "images/$filename";

    $storage = new StorageClient([
        'keyFile' => json_decode(file_get_contents(__DIR__ . '/../servicekey/test-dc739.json'), true),
    ]);

    $bucket = $storage->bucket($storageBucket);
    $imageObject = $bucket->object($imagePath);
    $imageUrl = $imageObject->signedUrl(strtotime('+1 hour'));

    return $imageUrl;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Products</title>
    <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <?php include '../components/admin_header.php' ?>
    <link rel="stylesheet" href="../css/admin_style.css">
</head>
<body>
<div id="messageContainer">
    <?php
    // Function to display and remove messages
    function displayAndRemoveMessage($message, $color) {
        echo '<script>';
        echo 'document.addEventListener("DOMContentLoaded", function() {';
        echo 'var messageContainer = document.getElementById("messageContainer");';
        echo 'messageContainer.innerHTML = "<p style=\"color: ' . $color . '; font-weight: bold; font-size: 10px;\">' . $message . '</p>";';
        echo 'setTimeout(function() { messageContainer.innerHTML = ""; }, 15000);'; // Remove message after 15 seconds
        echo 'setTimeout(function() { window.history.replaceState({}, document.title, window.location.pathname); }, 15000);'; // Remove message from URL after 15 seconds
        echo '});';
        echo '</script>';
    }

    // Check for header message in URL parameter
    if(isset($_GET['headerMessage'])) {
        $headerMessage = urldecode($_GET['headerMessage']); // Decode URL parameter
        $messageColor = strpos($headerMessage, 'successfully') !== false ? 'green' : 'red'; // Determine message color
        displayAndRemoveMessage($headerMessage, $messageColor); // Display and remove the message
    }

    // Check for success message in URL parameter
    if(isset($_GET['success'])) {
        $successMessage = urldecode($_GET['success']); // Decode URL parameter
        displayAndRemoveMessage($successMessage, 'green'); // Display and remove the success message
    }

    // Check for error message in URL parameter
    if(isset($_GET['error'])) {
        $errorMessage = urldecode($_GET['error']); // Decode URL parameter
        displayAndRemoveMessage($errorMessage, 'red'); // Display and remove the error message
    }
    ?>
</div>

<section class="add-products">
    <form action="" method="post" enctype="multipart/form-data">
        <h3>Add New Product</h3>

        <label for="itemName" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Item Name:</label>
        <input type="text" name="itemName" id="itemName" placeholder="Item Name" required class="box"><br>

        <label for="itemPrice" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Item Price:</label>
        <input type="number" name="itemPrice" id="itemPrice" placeholder="Item Price" required class="box"><br>

        <label for="quantity" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Quantity:</label>
        <input type="number" name="quantity" id="quantity" placeholder="Enter quantity" required class="box"><br>

        <label for="itemType" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Category:</label>
        <select name="itemType" class="box" id="itemtype" required style="color: #34495e;">
            <option value="" disabled selected>select category --</option>
            <option value="main dish">main dish</option>
            <option value="fast food">fast food</option>
            <option value="drinks">drinks</option>
            <option value="desserts">desserts</option>
        </select><br>

        <label for="file" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Choose File:</label>
        <input type="file" name="file" id="file" required class="box"><br>

        <button type="submit" name="submit" class="btn">Upload</button><br>
    </form>
</section>

<section class="show-products" style="padding-top: 0;">

    <div class="box-container">
        <?php
        // Display all products at once using the existing HTML structure
        // Inside the foreach loop where you display products
        foreach ($products as $productId => $product) {
            echo '<div class="box">';
            echo '<img src="' . $product['image'] . '" alt="">';
            echo '<div class="flex">';
            echo '<div class="price"><span>₹</span>' . $product['price'] . '<span>/-</span></div>';
            echo '<div class="category">' . $product['type'] . '</div>';
            echo '</div>';
            echo '<div class="name">' . $product['name'] . '</div>';
            echo '<div class="flex-btn">';
            echo '<a href="update.php?update_id=' . $productId . '" class="option-btn">update</a>';
            echo '<a href="delete.php?delete_id=' . $productId . '" class="delete-btn" onclick="return confirm(\'Are you sure you want to delete this product?\')">delete</a>';
            echo '</div>';
            echo '</div>';
        }
        ?>
    </div>

</section>
<script src="../js/admin_script.js"></script>
</body>
</html>
