<?php
// Check if a session is not already started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Include the display.php file
include('display.php');
?>

<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <meta http-equiv="X-UA-Compatible" content="IE=edge">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <link rel="shortcut icon" href="images/ngplogo.jpg" type="image">

   <!-- Font Awesome CDN link -->
   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">

   <!-- Custom CSS file link -->
   <link rel="stylesheet" href="css/style.css">
   <!-- Additional CSS styles if needed -->

   <style>
      /* Your custom styles here */
   </style>
</head>
<body>

<header class="header">
   <section class="flex">
      <a href="home.php" class="logo"><img src="images/ngplogo.jpg" style="width:50px;height:50px;" alt="Your Logo"></a>
      <nav class="navbar">
         <a href="home.php">Home</a>
         <a href="about.php">About</a>
         <a href="menu.php">Menu</a>
         <a href="orders.php">Orders</a>
         <a href="contact.php">Contact</a>
      </nav>

      <div class="icons">
         <?php
            // Check if user details are available in the session
            if(isset($_SESSION['email'])) {
               $email = $_SESSION['email'];

               // Get existing cart items from Firebase
               $firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/cart.json";
               $cartId = str_replace(['$', '#', '[', ']', '/', '.'], '', $email);

               $existingCart = json_decode(file_get_contents($firebaseUrl), true);

               // Calculate the total number of unique items in the cart
               $cartCount = isset($existingCart[$cartId]) ? count($existingCart[$cartId]) : 0;
         ?>
         <a href="cart.php"><i class="fas fa-shopping-cart"></i><span>(<?php echo $cartCount; ?>)</span></a>
         <?php
            }
         ?>
         <div id="user-btn" class="fas fa-user"></div>
         <div id="menu-btn" class="fas fa-bars"></div>
      </div>

      <div class="profile">
         <?php
            // Check if user details are available in the session
            if(isset($_SESSION['email'])) {
               $email = $_SESSION['email'];

               // Call the function to get user details
               $userDetails = getUserDetails($email);

               // Display user details
               if (is_array($userDetails)) {
                  echo "<p class='name'>" . $userDetails['Name'] . "</p>";
                  echo "<p><strong>Email:</strong> " . $userDetails['Email'] . "</p>";
                  echo "<p><strong>Rollno:</strong> " . $userDetails['Rollno'] . "</p>";
                  echo "<p><strong>Department:</strong> " . $userDetails['Department'] . "</p>";
                  echo "<div class='flex'>";
                  echo "<a href='profile.php' class='btn'>profile</a>";
                  echo "<a href='components/user_logout.php' onclick='return confirm(\"Logout from this website?\");' class='delete-btn'>logout</a>";
                  echo "</div>";
               } else {
                  // Handle other cases or display a generic message
                  echo "<p class='name'>Welcome to our website!</p>";
               }
            }
         ?>
      </div>
   </section>
</header>

<!-- Additional HTML content if needed -->

<!-- Additional scripts if needed -->
<script src="js/your_additional_script.js"></script>

</body>
</html>
