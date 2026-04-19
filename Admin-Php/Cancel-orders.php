<?php
// Check if the form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $orderId = $_POST['orderId'];
    $date = $_POST['date'];
    $email = $_POST['email'];
    $overallTotal = $_POST['overall_total'];
    
    // Retrieve the products array
    $productsJson = $_POST['products'];
    $products = json_decode($productsJson, true);

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
            // Update the status of the order to "Cancelled"
            $orderData['status'] = 'Cancelled';
            
            // Save the updated data back to Firebase
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['status' => 'Cancelled']));
            $response = curl_exec($ch);
            
            if (curl_errno($ch)) {
                echo 'cURL error: ' . curl_error($ch);
            } else {
                // Order status updated successfully
                $successMessage = 'Order status updated successfully /n';
                
                // Close the first cURL request
                curl_close($ch);
                
                // Open a new cURL request to update user's Amount
                $firebaseUserUrl = "https://test-dc739-default-rtdb.firebaseio.com/detials/users.json";
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $firebaseUserUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                $response = curl_exec($ch);
                
                if (curl_errno($ch)) {
                    echo 'cURL error: ' . curl_error($ch);
                } else {
                    $userData = json_decode($response, true);
                    
                    // Check if the user with the given email exists
                    foreach ($userData as $department => $departmentData) {
                        foreach ($departmentData as $rollNo => $userDetails) {
                            if ($userDetails['Email'] == $email) {
                                // Check if Amount field is not set, create it and set to $overallTotal
                                if (!isset($userData[$department][$rollNo]['Amount'])) {
                                    $userData[$department][$rollNo]['Amount'] = $overallTotal;
                                } else {
                                    // Update the Amount for the user by adding $overallTotal
                                    $userData[$department][$rollNo]['Amount'] += $overallTotal;
                                }
                                
                                // Save the updated user data back to Firebase
                                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($userData));
                                $response = curl_exec($ch);
                                
                                if (curl_errno($ch)) {
                                    echo 'cURL error: ' . curl_error($ch);
                                } else {
                                    // User Amount updated successfully
                                    $successMessage .= ' User Amount updated successfully /n';
                                }
                                
                                // Break out of the loop once the user is found and updated
                                break 2;
                            }
                        }
                    }
                }
                
                // Close the second cURL request
                curl_close($ch);

                // Open a new cURL request to update product quantities
                $firebaseCategoriesUrl = "https://test-dc739-default-rtdb.firebaseio.com/categories.json";
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $firebaseCategoriesUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                $response = curl_exec($ch);

                if (curl_errno($ch)) {
                    echo 'cURL error: ' . curl_error($ch);
                } else {
                    $categoriesData = json_decode($response, true);

                    // Check if the categories data is an array
                    if (is_array($categoriesData)) {
                        // Iterate through the products in the order
                        foreach ($products as $productId => $productData) {
                            // Check if the product ID exists in the categories data
                            if (isset($categoriesData[$productId])) {
                                // Update the quantity by adding the quantity from the order
                                $categoriesData[$productId]['quantity'] += $productData['quantity'];
                            }
                        }

                        // Save the updated categories data back to Firebase
                        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
                        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($categoriesData));
                        $response = curl_exec($ch);

                        if (curl_errno($ch)) {
                            echo 'cURL error: ' . curl_error($ch);
                        } else {
                            // Product quantities updated successfully
                            $successMessage .= ' Product quantities updated successfully';
                        }
                    }
                }

                // Close the third cURL request
                curl_close($ch);
                
                // Redirect back to the orders.php page with the combined success message
                header('Location: ../admin/orders.php?headerMessage=' . urlencode($successMessage));
                exit;
            }
        } else {
            // Order not found
            echo 'Error: Order not found';
        }
    }
} else {
    // Invalid request
    http_response_code(400);
    echo 'Invalid request';
}
?>
