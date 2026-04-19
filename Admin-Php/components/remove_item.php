<?php
// Start the session
session_start();

// Check if the email session variable is set
if (isset($_SESSION['email'])) {
    $userEmail = $_SESSION['email'];
    // Sanitize user email to create a safe key for Firebase
    $cartId = str_replace(['$', '#', '[', ']', '/', '.'], '', $userEmail);

    // Check if productId is provided in the POST request
    if (isset($_POST['productId'])) {
        $productId = $_POST['productId'];

        // Firebase Realtime Database URL for the cart
        $firebaseCartUrl = 'https://test-dc739-default-rtdb.firebaseio.com/cart/' . $cartId . '.json';
        
        // Initialize cURL session
        $ch = curl_init();
        // Set cURL options for fetching the current cart data
        curl_setopt($ch, CURLOPT_URL, $firebaseCartUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        // Execute cURL session and get the current cart data
        $currentCartData = curl_exec($ch);
        // Close cURL session
        curl_close($ch);

        // Decode the current cart data
        $currentCartData = json_decode($currentCartData, true);

        // Check if the current cart data is an array and contains the productId
        if (is_array($currentCartData) && array_key_exists($productId, $currentCartData)) {
            // Unset the specific product from the cart array
            unset($currentCartData[$productId]);

            // Initialize a new cURL session for updating the cart data
            $ch = curl_init();
            // Set cURL options for updating the cart data
            curl_setopt($ch, CURLOPT_URL, $firebaseCartUrl);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($currentCartData));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
            // Execute cURL session to update the cart data
            $result = curl_exec($ch);
            // Close cURL session
            curl_close($ch);

            // Check if the update was successful
            if ($result === 'null') {
                // Send a success response
                echo 'Item removed successfully';
            } else {
                // Send an error response
                echo 'Error removing item';
            }
        } else {
            // Send an error response if the productId is not found in the cart data
            echo 'Error: ProductId not found in the cart';
        }
    } else {
        // Send an error response if productId is not provided
        echo 'Error: ProductId not provided';
    }
} else {
    // Send an error response if the email session variable is not set
    echo 'Error: User not authenticated';
}
?>
