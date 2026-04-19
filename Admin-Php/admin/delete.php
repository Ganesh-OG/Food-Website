<?php
require __DIR__ . '/../vendor/autoload.php';
use GuzzleHttp\Client;
use Google\Cloud\Storage\StorageClient;

session_start();

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['delete_id'])) {
    // Get the product ID to be deleted
    $productIdToDelete=$_GET['delete_id'];

    // Firebase Realtime Database credentials
    $firebaseDatabaseUrl = 'https://test-dc739-default-rtdb.firebaseio.com';
    $firebaseDatabaseSecret = 'HBaErp2c6d8XDLVJgVavNdwt0TVHluu0ghw5KXOR';

    $client = new Client();

    // Fetch the current products from Firebase
    $response = $client->get($firebaseDatabaseUrl . '/categories.json?auth=' . $firebaseDatabaseSecret);
    $currentProducts = json_decode($response->getBody(), true) ?: [];

    // Check if the product to be deleted exists
    if (isset($currentProducts[$productIdToDelete])) {
        // Save the product data before unsetting
        $deletedProductData = $currentProducts[$productIdToDelete];

        // Delete the product from Firebase
        unset($currentProducts[$productIdToDelete]);

        // Update the "categories" node with the modified array using PUT method
        $response = $client->put($firebaseDatabaseUrl . '/categories.json?auth=' . $firebaseDatabaseSecret, [
            'json' => $currentProducts
        ]);

        // Delete the corresponding file from Google Cloud Storage
        $storageBucket = 'test-dc739.appspot.com';
        $imagePath = "images/" . $deletedProductData['filename'];

        $storage = new StorageClient([
            'keyFile' => json_decode(file_get_contents(__DIR__ . '/../servicekey/test-dc739.json'), true),
        ]);

        $bucket = $storage->bucket($storageBucket);
        $object = $bucket->object($imagePath);

        // Delete the object (file) from the storage
        $object->delete();

        // Redirect to products.php with a success message
        header('Location: products.php?message=Product deleted successfully');
        exit;
    } else {
        // Redirect to products.php with an error message
        header('Location: products.php?message=Product not found');
        exit;
    }
} else {
    // Redirect to products.php with an error message
    header('Location: products.php?message=Invalid request');
    exit;
}
?>
