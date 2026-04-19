<?php

function fetchUserWalletAndSetInSession() {

    // Check if the email session variable is set
    if (isset($_SESSION['email'])) {
        $userEmail = $_SESSION['email'];

        // Fetch user details from Firebase based on email
        $userDetails = fetchUserDetailsAndWalletBalance($userEmail);

        if ($userDetails !== null) {
            // Display the wallet balance if available, otherwise show "nil"
            $userWallet = isset($userDetails['Amount']) ? $userDetails['Amount'] : "nil";

            // Set wallet balance in the session
            $_SESSION['userWallet'] = $userWallet;

            return $userWallet; // Return user wallet for further use if needed
        } else {
            // Handle the case when the user is not found
            return "User not found.";
        }
    } else {
        // Handle the case when the email is not set (redirect to login, display an error, etc.)
        header('Location: login.php');
        exit();
    }
}

?>
