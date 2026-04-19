<?php
// Fetch data from Firebase using PHP
$firebase_url = 'https://test-dc739-default-rtdb.firebaseio.com/messages.json';
$firebase_data = file_get_contents($firebase_url);

if ($firebase_data === false) {
    die('Error fetching data from Firebase');
}

$data = json_decode($firebase_data, true);

if ($data === null) {
    die('Error decoding JSON data');
}
?>

<footer class="footer">
   <section class="grid">
   <div class="box" id="emailBox">
   <img src="images/email-icon.png" alt="">
   <h3>Our Email</h3>
   <?php
      // Display email details if available
      if (isset($data['Our Email']) && is_array($data['Our Email'])) {
         foreach ($data['Our Email'] as $email) {
            echo '<a href="#" onclick="confirmGmailCompose(\'' . $email . '\')">' . $email . '</a>';
         }
      } else {
         echo 'N/A';
      }
   ?>
</div>

<script>
function confirmGmailCompose(email) {
   // Display a confirmation dialog
   var confirmation = confirm("Are you sure you want to compose an email to " + email + "?");

   // If the user clicks 'OK' (true), proceed with opening Gmail compose window
   if (confirmation) {
      openGmailCompose(email);
   }
   // If the user clicks 'Cancel' (false), do nothing
}

function openGmailCompose(email) {
   // Compose Gmail link
   var gmailLink = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email);

   // Open Gmail compose window in a new tab
   window.open(gmailLink, '_blank');
}
</script>

      <div class="box" id="hoursBox">
         <img src="images/clock-icon.png" alt="">
         <h3>Opening Hours</h3>
         <p><?= isset($data['Opening Hours']) ? $data['Opening Hours'] : 'N/A'; ?></p>
      </div>

      <div class="box" id="addressBox">
   <img src="images/map-icon.png" alt="">
   <h3>Our Address</h3>
   <a href="<?= isset($data['Link']) ? $data['Link'] : '#'; ?>" onclick="confirmRedirect(event)">
      <?= isset($data['Adress']) ? nl2br($data['Adress']) : 'N/A'; ?>
   </a>
</div>

<script>
function confirmRedirect(event) {
   event.preventDefault(); // Prevents the default behavior of the link

   // Display a confirmation dialog
   var confirmation = confirm("Are you sure you want to redirect to the location?");

   // If the user clicks 'OK' (true), open the link in a new tab
   if (confirmation) {
      var link = event.target.getAttribute('href');
      window.open(link, '_blank');
   }
   // If the user clicks 'Cancel' (false), do nothing
}
</script>


      <div class="box" id="numberBox">
         <img src="images/phone-icon.png" alt="">
         <h3>Our Number</h3>
         <?php
            // Display phone numbers if available
            if (isset($data['Phone No']) && is_array($data['Phone No'])) {
               foreach ($data['Phone No'] as $number) {
                  echo '<a href="tel:' . $number . '">' . $number . '</a>';
               }
            } else {
               echo 'N/A';
            }
         ?>
      </div>
   </section>

   <div class="credit">&copy; copyright @ <?= date('Y'); ?> by <span>Dark_Hunter</span> | all rights reserved!</div>
</footer>

<div class="loader">
   <img src="images/loader.gif" alt="">
</div>
