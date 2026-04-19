<?php

// Firebase Realtime Database URL
$firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/Service.json";

// Initialize cURL session
$curl = curl_init();

// Set cURL options
curl_setopt_array($curl, [
    CURLOPT_URL => $firebaseUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
]);

// Execute cURL request
$response = curl_exec($curl);

// Close cURL session
curl_close($curl);

// Check if request was successful
if ($response === false) {
    // Return false if unable to fetch status
    echo json_encode(['status' => false]);
    exit();
}

// Decode JSON response
$data = json_decode($response, true);

// Check if service status is idle
$status = isset($data['Status']) ? strtoupper($data['Status']) : '';

// Return status based on service status
if ($status === 'IDLE') {
    echo json_encode(['status' => false]);
} else {
    echo json_encode(['status' => true]);
}

?>
