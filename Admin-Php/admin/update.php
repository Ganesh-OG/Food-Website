<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Include necessary files
require __DIR__ . '/../vendor/autoload.php';
use Google\Cloud\Storage\StorageClient;

// Function to generate a signed URL for image download
function generateImageDownloadUrl($filename)
{
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

// Your Firebase Realtime Database URL
$firebaseDatabaseUrl = 'https://test-dc739-default-rtdb.firebaseio.com/categories.json';

// Check if the form is submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the updated values from the form
    $productId = $_POST['productId'];
    $itemName = $_POST['itemName'];
    $itemPrice = $_POST['itemPrice'];
    $quantity = $_POST['quantity'];
    $category = $_POST['category'];

    // Fetch data from Firebase
    $data_json = file_get_contents($firebaseDatabaseUrl);

    // Check if data is successfully retrieved
    if ($data_json === false) {
        echo "<p>Error fetching data from Firebase.</p>";
        exit; // Stop execution if there's an error
    }

    $data = json_decode($data_json, true);

    // Check if the product ID exists in the data
    if (isset($data[$productId])) {
        // Update the product details
        $data[$productId]['product_name'] = $itemName;
        $data[$productId]['itemPrice'] = $itemPrice;
        $data[$productId]['quantity'] = $quantity;
        $data[$productId]['itemType'] = $category;

        // Handle file upload
        if ($_FILES['fileToUpload']['error'] === 0) {
            // File is uploaded successfully
            $newFilename = $_FILES['fileToUpload']['name'];

            // Delete the existing file in storage
            $storageBucket = 'test-dc739.appspot.com';
            $existingImagePath = "images/" . $data[$productId]['filename'];

            $storage = new StorageClient([
                'keyFile' => json_decode(file_get_contents(__DIR__ . '/../servicekey/test-dc739.json'), true),
            ]);

            $bucket = $storage->bucket($storageBucket);

            // Check if the object exists before deleting
            if ($bucket->object($existingImagePath)->exists()) {
                $bucket->object($existingImagePath)->delete();
            }

            // Upload the new file to storage
            $newImagePath = "images/$newFilename";
            $bucket->upload(
                file_get_contents($_FILES['fileToUpload']['tmp_name']),
                ['name' => $newImagePath]
            );

            // Update the filename in the data
            $data[$productId]['filename'] = $newFilename;
        }

        // Convert the updated data back to JSON
        $updated_data_json = json_encode($data);

        // Use cURL to update data in Firebase
        $ch = curl_init($firebaseDatabaseUrl);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $updated_data_json);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/json',
            'Content-Length: ' . strlen($updated_data_json)
        ));

        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode == 200) {
            header('Location: products.php?headerMessage=Product+updated+successfully!');
            exit;
        } else {
            header('Location: products.php?headerMessage=Error+updating+product+in+Firebase.');
exit;
        }
    } else {
        header('Location: products.php?headerMessage=Error:+Product+not+found!');
exit;
    }
} else {
    // Display product details

    // Check if the product ID is provided in the query string
    if (isset($_GET['update_id'])) {
        $productKey = $_GET['update_id'];


        // Fetch data from Firebase
        $data_json = file_get_contents($firebaseDatabaseUrl);

        // Check if data is successfully retrieved
        if ($data_json === false) {
            echo "<p>Error fetching data from Firebase.</p>";
            exit; // Stop execution if there's an error
        }

        $data = json_decode($data_json, true);

        // Check if the product ID exists in the data
        if (isset($data[$productKey])) {
            $product = $data[$productKey];
        } else {
            echo '<p>Error: Product not found!</p>';
            var_dump($data); // Add this line to print the data for debugging
            exit; // Stop execution if the product is not found
        }
    } else {
        echo '<p>Error: Product ID not provided!</p>';
        exit; // Stop execution if the product ID is not provided
    }
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Updates</title>
    <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">
    <link rel="stylesheet" href="../css/admin_style.css">
    <?php include '../components/admin_header.php';?>
    <!-- Include your CSS stylesheets here -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <script src="../js/admin_script.js"></script>
</head>
<body>

<section class="update-product">

   <h1 class="heading">update product</h1>


    <!-- Display all details of the product within input fields -->
    <form method="post" action="" enctype="multipart/form-data">
        <label for="productId">Product ID:</label>
        <input type="text" id="productId" name="productId" class="box" value="<?php echo $productKey; ?>" readonly>

        <label for="itemName">Item Name:</label>
        <input type="text" id="itemName" name="itemName" class="box" value="<?php echo $product['product_name']; ?> ">

        <label for="itemPrice">Item Price:</label>
        <input type="text" id="itemPrice" name="itemPrice" class="box" value="<?php echo $product['itemPrice']; ?>">

        <label for="quantity">Quantity:</label>
        <input type="text" id="quantity" name="quantity" class="box" value="<?php echo $product['quantity']; ?>">

        <label for="category">Category:</label>
        <input type="text" id="category" name="category" class="box" value="<?php echo $product['itemType']; ?>">

        <!-- Display the image outside the input fields -->
        <p><strong>Product Image:</strong></p>
        <img src="<?php echo generateImageDownloadUrl($product['filename']); ?>" class="box" alt="Product Image" style="max-width: 200px; margin-bottom: 10px;">

        <!-- File upload option -->
        <label for="fileToUpload">Choose File:</label>
        <input type="file" id="fileToUpload" name="fileToUpload" class="box">

        <!-- Update button -->
        <div class="flex-btn">
        <button type="submit"  class="btn">Update</button> 
        <a href="products.php" class="option-btn">go back</a>
      </div>
    </form>

    <!-- Add any additional details you want to display within input fields -->
</section>

</body>
</html>

<?php
}
?>
