<?php
$firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/contact.json";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $firebaseUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
$messages = json_decode($response, true);
?>

<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <meta http-equiv="X-UA-Compatible" content="IE=edge">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>Messages</title>
   <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">

   <!-- Font Awesome CDN link  -->
   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">

   <!-- Custom CSS file link  -->
   <link rel="stylesheet" href="../css/admin_style.css">
    <?php include '../components/admin_header.php' ?>

</head>
<body>


<!-- Messages section starts  -->
<section class="messages">
   <h1 class="heading">Messages</h1>
   <div class="box-container">

   <?php if ($messages): ?>
       <?php foreach ($messages as $token => $message): ?>
           <div class="box">
               <p>Name: <span><?php echo $message['name']; ?></span></p>
               <p>Number: <span><?php echo $message['number']; ?></span></p>
               <p>Email: <span><?php echo $message['email']; ?></span></p>
               <p>Message: <span><?php echo $message['message']; ?></span></p>
               <a class="btn" href="">reply</a>
               <a class="delete-btn" href="#">Delete</a>
           </div>
       <?php endforeach; ?>
   <?php else: ?>
       <p>No messages found.</p>
   <?php endif; ?>
   
   </div>
</section>

<!-- Custom JS file link  -->
<script src="../js/admin_script.js"></script>

</body>
</html>