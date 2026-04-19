<?php
// Start the session if it's not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check if staff email is set in session
if (!isset($_SESSION['staff_email'])) {
    // Redirect to index.php
    header("Location: ../index.php");
    exit(); // Ensure that script execution stops after redirection
}

// Fetch data from the Firebase Realtime Database
$url = "https://test-dc739-default-rtdb.firebaseio.com/detials.json";
$data = file_get_contents($url);

if ($data === false) {
    // Error handling for failed HTTP request
    echo "Error fetching details from the database.";
} else {
    $details = json_decode($data, true);

    // Specify the target email
    $targetEmail = $_SESSION['staff_email'];

    // Initialize $detailsArray
    $detailsArray = [];

    // Check if the target email exists in the "Management" section
    foreach ($details['Management'] as $key => $user) {
        if ($user['Email'] === $targetEmail) {
            // Set $AdminDetails to user details
            $AdminDetails = $user;
            $privileges = (strpos($key, "Admin") === 0) ? "Admin" : "Staff"; // Check if the key starts with "Admin"


            // Populate $detailsArray only for the targeted email
            $detailsArray = [
                'Privileges' => '<span style="color: black; font-weight: bold;">' . $privileges . '</span>',
                'UserName' => $AdminDetails['Name'],
                'UserEmail' => $AdminDetails['Email'],
                // Add more key-value pairs as needed
            ];

            break; // Break the loop once the email is found
        }
    }
}
?>

<!-- Your HTML code continues from here -->
<header class="header">
<link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">

    <section class="flex">
        <a href="Orders.php" class="logo">Admin<span>Panel</span></a>

        <nav class="navbar">
            <a href="Orders.php">Home</a>
            <a href="products.php">Products</a>
            <a href="Wallet.php">Wallet</a>
            <a href="loader.php">Users</a>
            <a href="messages.php">Messages</a>
            <a href="Web-updates.php">Updates</a>
        </nav>

        <div class="icons">
            <div id="menu-btn" class="fas fa-bars"></div>
            <div id="user-btn" class="fas fa-user"></div>
        </div>

        <div class="profile">
            <?php if (!empty($detailsArray)): ?>
                <p style="font-size: 20px;"><?= $detailsArray['Privileges']; ?></p>
                <p style="font-size: 18px;">Name: <?= $detailsArray['UserName']; ?></p>
                <p style="font-size: 18px;">Email: <?= $detailsArray['UserEmail']; ?></p>
            <?php else: ?>
                <p style="font-size: 16px;">User with email <?= $targetEmail; ?> not found.</p>
            <?php endif; ?>
            <div class="flex-btn">
                <a class="btn" >Register</a>
            </div>
            <a href="../components/admin_logout.php" onclick="return confirm('logout from this website?');" class="delete-btn">logout</a>
        </div>
    </section>
</header>
