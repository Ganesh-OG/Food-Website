<?php
// update_order_status.php

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['orderId'], $_POST['date'])) {
    $orderId = $_POST['orderId'];
    $date = $_POST['date'];

    // Construct the URL for the specific order
    $firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/Orders/$date/$orderId.json";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $firebaseUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        echo 'cURL error: ' . curl_error($ch);
    } else {
        $orderData = json_decode($response, true);

        // Check if the order exists
        if ($orderData) {
            // Update the status of the order to "Complete"
            $orderData['status'] = 'Complete';

            // Save the updated data back to Firebase
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['status' => 'Complete']));
            $response = curl_exec($ch);

            if (curl_errno($ch)) {
                echo 'cURL error: ' . curl_error($ch);
            } else {
                // Order status updated successfully
                $successMessage = 'Order status updated successfully';

                // Redirect back to the orders.php page with a success message
                header('Location: ../admin/orders.php?headerMessage=' . urlencode($successMessage));
                exit;
            }
        } else {
            // Order not found
            echo 'Error: Order not found';
        }
    }

    curl_close($ch);
} else {
    // Invalid request
    http_response_code(400);
    echo 'Invalid request';
}
?>
