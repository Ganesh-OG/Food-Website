<?php
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_SESSION['email'])) {
    $userEmail = $_SESSION['email'];
    $cartId = str_replace(['$', '#', '[', ']', '/', '.'], '', $userEmail);

    // Get the product ID and quantity change from the POST request
    $productId = $_POST['productId'];
    $quantityChange = intval($_POST['quantityChange']);

    // Firebase Realtime Database URL for the cart
    $firebaseCartUrl = 'https://test-dc739-default-rtdb.firebaseio.com/cart/' . $cartId . '.json';

    // Initialize cURL session
    $ch = curl_init();

    // Set cURL options for retrieving current cart data
    curl_setopt($ch, CURLOPT_URL, $firebaseCartUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

    // Execute cURL session and get the result
    $result = curl_exec($ch);

    // Decode the JSON result
    $cartData = json_decode($result, true);

    // Update the quantity for the specified product
    if (isset($cartData[$productId])) {
        $cartData[$productId] += $quantityChange;

        // Ensure the quantity is not negative
        if ($cartData[$productId] < 0) {
            $cartData[$productId] = 0;
        }

        // If the product count is zero, delete the product from the cart
        if ($cartData[$productId] == 0) {
            unset($cartData[$productId]);
        }

        // Set cURL options for updating the cart data
        curl_setopt($ch, CURLOPT_URL, $firebaseCartUrl);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($cartData));

        // Execute cURL session to update the cart data
        curl_exec($ch);
    }

    // Close cURL session
    curl_close($ch);
}
?>
