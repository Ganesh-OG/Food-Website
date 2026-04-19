<?php
session_start(); // Start the session to access session variables

if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST["add_to_cart"])) {
    // Get the form data
    $productId = $_POST["pid"];
    $quantity = $_POST["qty"];

    // Get the email from the session variable
    if (isset($_SESSION['email'])) {
        $email = $_SESSION['email'];

        // Sanitize email to create a valid Firebase key
        $cartId = str_replace(['$', '#', '[', ']', '/', '.'], '', $email);

        // Firebase Realtime Database URL
        $firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/cart.json";

        // Get existing cart items from Firebase
        $existingCart = json_decode(file_get_contents($firebaseUrl), true);

        // Check if the product already exists in the cart
        if (isset($existingCart[$cartId][$productId])) {
            // Product exists, update the quantity
            $existingCart[$cartId][$productId] += $quantity;
        } else {
            // Product doesn't exist, add a new entry
            $existingCart[$cartId][$productId] = $quantity;
        }

        // Use cURL to make a PUT request to Firebase REST API to update the entire cart
        $ch = curl_init($firebaseUrl);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($existingCart));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
        ]);

        $result = curl_exec($ch);

        if ($result === false) {
            // Log or echo the error message
            echo 'Error updating cart: ' . curl_error($ch);
        } else {
            // Check the response from Firebase
            $response = json_decode($result, true);

            if ($response === null) {
                echo 'Error decoding Firebase response.';
            } else {
                // Check if Firebase returned an error message
                if (isset($response['error'])) {
                    echo 'Firebase error: ' . $response['error'];
                } else {
                    // Redirect to menu.php on success
                    header("Location: /fire-food/menu.php");
                    exit();
                }
            }
        }

        curl_close($ch);
    } else {
        // Handle the case when the email is not set in the session
        echo 'Email not found in session.';
    }
} else {
    echo 'Invalid request!';
}
?>
