<?php
// Firebase URL
$url = "https://test-dc739-default-rtdb.firebaseio.com/Orders.json";

// Retrieve data from Firebase
$data = file_get_contents($url);

// Decode JSON data
$orders = json_decode($data, true);

// Initialize an array to store order details
$orderDetailsArray = [];

// Initialize variables to track success and failure
$successMessage = "";
$failureMessage = "";

// Check if orderId and date are set in POST data
if(isset($_POST['orderId']) && isset($_POST['date'])) {
    // Retrieve the order IDs and dates from POST data
    $orderIds = $_POST['orderId'];
    $dates = $_POST['date'];

    // Loop through each order ID and date
    for($i = 0; $i < count($orderIds); $i++) {
        $orderId = $orderIds[$i];
        $date = $dates[$i];

        // Check if the date exists in Firebase data
        if(isset($orders[$date])) {
            // Retrieve order details for the specified date
            $orderDetails = $orders[$date];

            // Check if the order ID exists in the order details
            if(isset($orderDetails[$orderId])) {
                // Retrieve the order data for the specified order ID
                $orderData = $orderDetails[$orderId];

                // Check if order data exists
                if($orderData !== null) {
                    // Initialize array to store product details
                    $productDetailsArray = [];

                    // Loop through products
                    foreach ($orderData['products'] as $productId => $productDetails) {
                        // Store product ID and quantity
                        $productDetailsArray[$productId] = $productDetails['quantity'];
                    }

                    // Add order details to the array
                    $orderDetailsArray[] = [
                        "Date" => $date,
                        "Order ID" => $orderId,
                        "Email" => $orderData['email'],
                        "Overall Total" => $orderData['overall_total'],
                        "Products" => $productDetailsArray
                    ];

                    // Update the order status to "Cancelled"
                    $orders[$date][$orderId]['status'] = 'Cancelled';

                    // Save the updated order data back to Firebase
                    $firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/Orders/$date/$orderId.json";
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $firebaseUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['status' => 'Cancelled']));
                    $response = curl_exec($ch);
                    curl_close($ch);

                    // Retrieve user data
                    $firebaseUserUrl = "https://test-dc739-default-rtdb.firebaseio.com/detials/users.json";
                    $userData = json_decode(file_get_contents($firebaseUserUrl), true);

                    // Update user's amount
                    foreach ($userData as $department => $departmentData) {
                        foreach ($departmentData as $rollNo => $userDetails) {
                            if ($userDetails['Email'] == $orderData['email']) {
                                $userData[$department][$rollNo]['Amount'] += $orderData['overall_total'];
                                break 2;
                            }
                        }
                    }

                    // Save updated user data back to Firebase
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $firebaseUserUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($userData));
                    $response = curl_exec($ch);
                    curl_close($ch);

                    // Retrieve categories data
                    $firebaseCategoriesUrl = "https://test-dc739-default-rtdb.firebaseio.com/categories.json";
                    $categoriesData = json_decode(file_get_contents($firebaseCategoriesUrl), true);

                    // Update product quantities
                    foreach ($orderData['products'] as $productId => $productDetails) {
                        if (isset($categoriesData[$productId])) {
                            $categoriesData[$productId]['quantity'] += $productDetails['quantity'];
                        }
                    }

                    // Save updated categories data back to Firebase
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $firebaseCategoriesUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($categoriesData));
                    $response = curl_exec($ch);
                    curl_close($ch);

                    // Set success message
                    $successMessage = "Order details updated successfully.";
                } else {
                    $failureMessage = "No details found for the specified order ID and date.";
                }
            } else {
                $failureMessage = "No details found for the specified order ID and date.";
            }
        } else {
            $failureMessage = "No orders found for the specified date.";
        }
    }
} else {
    // Handle case when orderId or date is not set in POST data
    $failureMessage = "Error: Order ID or date is missing.";
}

// Build the redirect URL based on success or failure
$redirectUrl = "http://localhost/fire-food/admin/orders.php";
if(!empty($successMessage)) {
    $redirectUrl .= "?success=" . urlencode($successMessage);
}
if(!empty($failureMessage)) {
    if(strpos($redirectUrl, "?") !== false) {
        $redirectUrl .= "&failure=" . urlencode($failureMessage);
    } else {
        $redirectUrl .= "?failure=" . urlencode($failureMessage);
    }
}

// Redirect to orders.php with appropriate message
header("Location: $redirectUrl");
exit;
?>