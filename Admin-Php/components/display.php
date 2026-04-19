<?php

if (!function_exists('getUserDetails')) {
    define('FIREBASE_URL', 'https://test-dc739-default-rtdb.firebaseio.com/detials/users.json');

    function getUserDetails($email) {
        try {
            $firebaseUrl = FIREBASE_URL;

            // Fetch users' data from Firebase
            $response = file_get_contents($firebaseUrl);

            if ($response === false) {
                throw new Exception("Error fetching data from Firebase.");
            } else {
                $data = json_decode($response, true);

                // Call the function to get user details
                $userDetails = findUserDetails($data, $email);

                if ($userDetails) {
                    return $userDetails;
                } else {
                    throw new Exception("User details not found.");
                }
            }
        } catch (Exception $e) {
            return "<p>Error: " . $e->getMessage() . "</p>";
        }
    }

    function findUserDetails($data, $email) {
        foreach ($data as $department => $students) {
            foreach ($students as $rollNumber => $studentData) {
                // Check if 'Email' matches
                if (isset($studentData['Email']) && $studentData['Email'] === $email) {
                    // Add additional details and return
                    $studentData['Rollno'] = $rollNumber;
                    $studentData['Department'] = $department;
                    return $studentData;
                }
            }
        }
        return null; // User not found
    }
}
?>