<?php
// Start or resume the session
session_start();

// Firebase Realtime Database URL
$details_url = 'https://test-dc739-default-rtdb.firebaseio.com/detials/users.json';

// Function to make cURL request with enhanced error handling
function makeRequest($url, $method = 'GET', $data = null) {
    $ch = curl_init($url);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }

    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
        return false;
    }

    curl_close($ch);

    return json_decode($response, true);
}

// Function to handle both adding and updating the amount
function handleAmountAction($rollNo, $userDetails, $userDept, $amountToUpdate) {
    // Validate the amount (add your own validation logic if needed)
    if ($amountToUpdate > 0) {
        // Check if the user has an existing wallet amount field
        if (!isset($userDetails['Amount'])) {
            // If the user doesn't have a wallet amount field, create it
            $userDetails['Amount'] = $amountToUpdate;
        } else {
            // Add or update the amount based on the button clicked
            $userDetails['Amount'] += $amountToUpdate;
        }

        // Update only the 'Amount' field for the user in the database
        $response = makeRequest('https://test-dc739-default-rtdb.firebaseio.com/detials/users/' . $userDept . '/' . $rollNo . '.json', 'PATCH', ['Amount' => $userDetails['Amount']]);

        // Check for errors in the cURL request
        if ($response === null) {
            return 'Error updating amount in Firebase.';
        } else {
            // Set the wallet amount for display
            return $userDetails['Amount'];
        }
    }
}

$userDetails = [];
$walletAmount = "nil"; // Default value
$userDept = "nil"; // Default value for the department
$rollNo = '';
$message = ''; // Variable to store success or error message

// Fetch user details if the Roll No. is provided
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rollNo = $_POST['rollno'] ?? '';
    $detailsData = makeRequest($details_url);

    // Check if there's an error fetching user details
    if ($detailsData === false) {
        $message = "Connection is not stable. Please try again later.";
    } else {
        foreach ($detailsData as $dept => $deptUsers) {
            if (isset($deptUsers[$rollNo])) {
                $userDetails = $deptUsers[$rollNo];

                // Check if the user has an existing wallet amount
                $walletAmount = isset($userDetails['Amount']) ? $userDetails['Amount'] : "nil";

                // Store the department information
                $userDept = $dept;

                break; // Exit the loop once user details are found
            }
        }
    }
}

// Check if the "Clear" button is clicked
$clearButtonClicked = ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['clear']));

// Check if the "Fetch" button is clicked
$fetchButtonClicked = ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['fetch']));

// Clear user details and roll number only if the "Clear" button is clicked
if ($clearButtonClicked) {
    $userDetails = [];
    $walletAmount = "nil";
    $userDept = "nil";
    $rollNo = "";
    $message = ''; // Clear the message on "Clear"
} else {
    // Handle adding or updating the amount only if "Submit" is clicked
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add'])) {
        $amountToUpdate = isset($_POST['amount']) ? (float)$_POST['amount'] : 0.0;

        // Use the common function to handle both adding and updating
        $result = handleAmountAction($rollNo, $userDetails, $userDept, $amountToUpdate);

        if (is_numeric($result)) {
            $message = 'Amount Added: ₹' . number_format($amountToUpdate, 0, '', '') . ' successfully.';
            $walletAmount = $result; // Update the displayed wallet amount
        } else {
            $message = 'Failed to update amount: ' . $result;
        }

        // Fetch updated details after updating the amount
        $detailsData = makeRequest($details_url);

        // Check if there's an error fetching user details
        if ($detailsData === false) {
            $message = "Connection is not stable. Please try again later.";
        } else {
            foreach ($detailsData as $dept => $deptUsers) {
                if (isset($deptUsers[$rollNo])) {
                    $userDetails = $deptUsers[$rollNo];

                    // Check if the user has an existing wallet amount
                    $walletAmount = isset($userDetails['Amount']) ? $userDetails['Amount'] : "nil";

                    // Store the department information
                    $userDept = $dept;

                    break; // Exit the loop once user details are found
                }
            }
        }
    }
}

// Generate a unique token if it doesn't exist
if (!isset($_SESSION['form_token'])) {
    $_SESSION['form_token'] = bin2hex(random_bytes(32));
}

// Check for form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['form_token']) && $_POST['form_token'] === $_SESSION['form_token']) {
    if (isset($_POST['fetch'])) {
        // Wallet information retrieval logic remains the same...
    }

    // Generate a new unique token to prevent resubmission on refresh
    $_SESSION['form_token'] = bin2hex(random_bytes(32));
}
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wallet System</title>
    <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
        }

        header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            color: #fff;
            text-align: center;
            z-index: 999; /* Make sure it's on top of other elements */
            border-bottom: none; /* Remove border */
        }

        .wallet-container {
            display: flex;
            align-items: flex-start; /* Align to the start (left) */
            margin-top: 60px; /* Adjust the margin to leave space for the header */
        }

        .wallet-details-container {
            background-color: #fff;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            text-align: left;
            width: 100%;
            max-width: 300px; /* Adjust the max-width as needed */
        }

        .wallet-form-container {
            background-color: #fff;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            text-align: center;
            margin-left: 20px; /* Adjust the margin between containers */
            width: 100%;
            max-width: 400px; /* Adjust the max-width as needed */
        }

        .wallet-label {
            display: block;
            margin-bottom: 8px;
        }

        .wallet-input, .wallet-button {
            margin-bottom: 16px;
            padding: 8px;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 4px;
        }

        .wallet-input[readonly] {
            background-color: #eee;
            cursor: not-allowed;
        }

        .wallet-button {
            background-color: #55c2da;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        .wallet-button:hover {
            background-color: #5783db;
        }

        .wallet-message-success {
            color: green;
        }

        .wallet-message-error {
            color: red;
        }

        .wallet-message {
            margin-top: 10px;
        }

        .wallet-hidden {
            display: none;
        }
        .wallet-message-success {
            color: green;
        }

        .wallet-message-error {
            color: red;
        }

    </style>
</head>
<body>
    <header>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <link rel="stylesheet" href="../css/admin_style.css">
    <?php include '../components/admin_header.php';?>
    <script src="../js/admin_script.js"></script>
    </header>

<?php
// Function to format date in d/m/y format
function formatDOB($dob) {
    $date = new DateTime($dob);
    return $date->format('d/m/Y');
}

// Check if user details are set before populating the input fields
$userDetailsAvailable = !empty($userDetails);

// Check if the "Clear" button is clicked
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['clear'])) {
    // Clear user details, roll number, and message
    $userDetails = [];
    $walletAmount = "nil";
    $userDept = "nil";
    $rollNo = "";
    $message = '';
}
?>

<div class="wallet-container">
    <!-- Display user details in the input fields on the left side -->
    <div class="wallet-details-container">
        <label class="wallet-label">User Information:</label>
        Name: <input type="text" class="wallet-input" name="name" placeholder="Name" value="<?= $userDetailsAvailable ? $userDetails['Name'] : ''; ?>" readonly><br>
        Email: <input type="text" class="wallet-input" name="email" placeholder="Email" value="<?= $userDetailsAvailable ? $userDetails['Email'] : ''; ?>" readonly><br>
        Dob: <input type="text" class="wallet-input" name="dob" placeholder="DOB" value="<?= $userDetailsAvailable ? formatDOB($userDetails['DOB']) : ''; ?>" readonly><br>
        Department: <input type="text" class="wallet-input" name="department" placeholder="Department" value="<?= $userDetailsAvailable ? $userDept : ''; ?>" readonly><br>
        Balance: <input type="text" class="wallet-input" name="amount" placeholder="Amount" value="<?= $userDetailsAvailable ? $walletAmount : ''; ?>" readonly>
    </div>

    <!-- Form for fetching and updating details on the right side -->
    <div class="wallet-form-container">
    <form method="post">
        <h2>Wallet System</h2>
        <label for="rollno" class="wallet-label">Enter Roll No:</label>
        <input type="text" class="wallet-input" name="rollno" value="<?= $rollNo; ?>" required>
        <input type="hidden" name="form_token" value="<?= $_SESSION['form_token']; ?>">
        <button type="submit" class="wallet-button" name="fetch">Fetch</button>

        <!-- "Add/Update Amount" section -->
        <?php if ($userDetailsAvailable && !$clearButtonClicked) : ?>
            <div id="addUpdateAmountSection">
                <label for="amount" class="wallet-label">Add/Update Amount:</label>
                <input type="number" class="wallet-input" name="amount" required>
                <button type="submit" class="wallet-button" name="add">Submit</button>
            </div>
        <?php endif; ?>
        <!-- Error message container -->
        <div class="wallet-message <?= isset($message) && $message !== '' ? ($message === 'Amount Added: ₹' . number_format($amountToUpdate, 0, '', '') . ' successfully.' ? 'wallet-message-success' : 'wallet-message-error') : 'wallet-hidden'; ?>">
            <?= $message; ?>
        </div>
        
    </form>
    <form method="post">
        <button type="submit" class="wallet-button" name="clear">Clear</button>
    </form>
</div>


    </div>
</div>

</body>
</html>
