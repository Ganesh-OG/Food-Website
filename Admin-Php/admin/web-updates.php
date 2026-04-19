<?php
session_start(); // Start the session

require '../vendor/autoload.php';

use Google\Cloud\Storage\StorageClient;

// Your Google Cloud Storage configuration
$bucketName = 'test-dc739.appspot.com';
$fileName = 'about/about_paragraph.txt';

// Set the path to your service account credentials JSON file
putenv('GOOGLE_APPLICATION_CREDENTIALS=' . __DIR__ . '/../servicekey/test-dc739.json');

// Instantiate the StorageClient
$storage = new StorageClient();

// Get the bucket
$bucket = $storage->bucket($bucketName);

// Replace this URL with your actual Firebase URL
$firebase_url = 'https://test-dc739-default-rtdb.firebaseio.com/messages.json';
$response = file_get_contents($firebase_url);
$data = json_decode($response, true);

// Check if the data is successfully retrieved
if ($data && isset($data['Adress'], $data['Link'], $data['Opening Hours'], $data['Our Email'], $data['Phone No'])) {
    // Store key-value pairs
    $address = $data['Adress'];
    $link = $data['Link'];
    $openingHours = $data['Opening Hours'];
    $emails = $data['Our Email'];
    $phoneNumbers = $data['Phone No'];
} else {
    // Set default values or handle the error as needed
    $address = '';
    $link = '';
    $openingHours = '';
    $emails = ['Email1' => '', 'Email2' => ''];
    $phoneNumbers = ['Number-1' => '', 'Number-2' => ''];
}

// Set a default value for $existingContent
$existingContent = '';

// Try to retrieve the existing content of the file
$object = $bucket->object($fileName);
if ($object->exists()) {
    $existingContent = $object->downloadAsString();
}

$message = ''; // Variable to store the submission message

// Check if the form is submitted
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['footer-update'])) {
    // Update values from the form
    $address = $_POST['address'];
    $link = $_POST['link'];
    $openingHours = $_POST['openingHours'];
    $emails['Email1'] = $_POST['email1'];
    $emails['Email2'] = $_POST['email2'];
    $phoneNumbers['Number-1'] = $_POST['phoneNumber1'];
    $phoneNumbers['Number-2'] = $_POST['phoneNumber2'];

    // Update Firebase data
    $firebase_data = [
        'Adress' => $address,
        'Link' => $link,
        'Opening Hours' => $openingHours,
        'Our Email' => $emails,
        'Phone No' => $phoneNumbers,
    ];

    $curl = curl_init($firebase_url);
    curl_setopt($curl, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($firebase_data));
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen(json_encode($firebase_data)),
    ]);

    $result = curl_exec($curl);

    if ($result === false) {
        echo 'cURL error: ' . curl_error($curl);
    } else {
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);

        if ($httpCode == 200) {
            $message = 'Update successful!';
        } else {
            $message = 'Update failed! HTTP Code: ' . $httpCode;
        }
    }

    curl_close($curl);

    // Prevent form re-submission on page refresh
    $successMessage = urlencode($message);
    header("Location: web-updates.php?success=$successMessage");
    exit();
}

// Handle file upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_image'])) {
    $stepName = $_POST['stepName'];
    $fileInputName = "file_$stepName";

    // Check if a file is selected
    if (empty($_FILES[$fileInputName]['name'])) {
        $message = 'No image selected!';
    } else {
        // Delete the existing object
        $existingObject = $bucket->object("about/$stepName");
        if ($existingObject->exists()) {
            $existingObject->delete();
        }

        // Upload the file to Google Cloud Storage with a new name and extension
        $newObjectName = "about/$stepName." . pathinfo($_FILES[$fileInputName]['name'], PATHINFO_EXTENSION);
        $newObject = $bucket->upload(fopen($_FILES[$fileInputName]['tmp_name'], 'r'), [
            'name' => $newObjectName,
        ]);

        if ($newObject->exists()) {
            $message = 'Image update successful!';
        } else {
            // Handle the case where the upload failed
            // You may set an error message or perform appropriate error handling
            $message = 'Image update failed!';
        }
    }

    // Prevent form re-submission on page refresh
    $successMessage = urlencode($message);
    header("Location: web-updates.php?success=$successMessage");
    exit();
}

// Check if the form is submitted for the "About" section
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['about-update'])) {
    // Update the content of the file in Google Cloud Storage
    $aboutContent = $_POST['aboutContent'];

    // Upload the updated content to the specified file
    $object = $bucket->upload($aboutContent, [
        'name' => $fileName,
    ]);

    if ($object->exists()) {
        $message = 'About section update successful!';
    } else {
        // Handle the case where the upload failed
        // You may set an error message or perform appropriate error handling
        $message = 'About section update failed!';
    }

    // Prevent form re-submission on page refresh
    $successMessage = urlencode($message);
    header("Location: web-updates.php?success=$successMessage");
    exit();
}

// Include Firebase SDK
require '../vendor/autoload.php';

use Google\Cloud\Storage\StorageClient as GoogleStorageClient;

// Authenticate with Firebase using the service account key
$storage = new GoogleStorageClient([
    'keyFilePath' => __DIR__ . '/../servicekey/test-dc739.json' // Adjust the path accordingly
]);

// Reference to your storage bucket
$bucket = $storage->bucket('test-dc739.appspot.com');

// Get all images from Firebase storage
$objects = $bucket->objects([
    'prefix' => 'display/'
]);

// Array to store image URLs and file names without extension
$imageData = [];

foreach ($objects as $object) {
    // Assuming you only want to fetch images
    if (pathinfo($object->name(), PATHINFO_EXTENSION) === 'jpg' || pathinfo($object->name(), PATHINFO_EXTENSION) === 'png') {
        // Extract the file name without extension
        $fileNameWithoutExtension = pathinfo($object->name(), PATHINFO_FILENAME);
        
        // Generate a signed URL for the image (valid for 1 hour)
        $imageUrl = $object->signedUrl(time() + 3600); // Expires in 1 hour
        
        // Store image URL and file name without extension
        $imageData[] = [
            'url' => $imageUrl,
            'fileName' => $fileNameWithoutExtension
        ];
    }
}

// Check if the image count is 5
$imageCount = count($imageData);

// Check if the form is submitted for uploading image
if(isset($_POST['upload'])) {
    $fileName = $_POST['fileName'];
    $file = $_FILES['file'];

    // Path to your service account key JSON file
    $keyFilePath = __DIR__ . '/../servicekey/test-dc739.json';

    // Initialize Firebase Storage client
    $storage = new GoogleStorageClient([
        'keyFilePath' => $keyFilePath
    ]);

    // Reference to your storage bucket
    $bucket = $storage->bucket('test-dc739.appspot.com');

    // Create a storage object
    $object = $bucket->upload(
        fopen($file['tmp_name'], 'r'),
        ['name' => 'display/' . $fileName . '.png']
    );

    // Encode the success message
    $successMessage = urlencode("File uploaded successfully");

    // Redirect to web-updates.php with success message
    header("Location: web-updates.php?success=$successMessage");
    exit;
}
// Handle file deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_file'])) {
    $fileNameToDelete = $_POST['delete_file'];
    
    // Find the object in the bucket with the matching filename and delete it
    $objectToDelete = $bucket->object("display/$fileNameToDelete.png");
    if ($objectToDelete->exists()) {
        $objectToDelete->delete();
        $message = 'Image deleted successfully!';
    } else {
        // Handle the case where the file to delete does not exist
        $message = 'Image does not exist or could not be deleted!';
    }

    // Redirect back to the page with the success message
    $successMessage = urlencode($message);
    header("Location: web-updates.php?success=$successMessage");
    exit();
}
?>



<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Updates</title>
    <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">
    <link rel="stylesheet" href="../css/admin_style.css">
    <?php include '../components/admin_header.php';?>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <script src="../js/admin_script.js"></script>
    <style>
    /* Add your existing styles here */
    /* ... */

    textarea.box,
    input.box {
        font-size: 16px;
        text-align: left;
        color: #34495e;
        display: block;
        width: 100%;
        box-sizing: border-box;
    }
    

    /* Style for PC */
    @media only screen and (min-width: 601px) {
        textarea.box.pc-style {
            width: 1021px;
            height: 222px;
        }
    }

    button.btn-updates {
        width: 1000px;
        margin: 0 auto;
        margin-top: 20px;
    }

    .horizontal-buttons {
        display: flex;
        justify-content: center;
        margin-top: 20px;
    }

    .horizontal-buttons button {
        width: calc(980px / 4);
        margin: 0 5px;
    }

    .wide-button {
        width: 1020px;
        margin: 0 auto;
        text-align: center;
    }

    .show-products,
    .show-products.b2,
    .show-products.b3 {
        padding-top: 0;
        margin-top: 20px;
        display: none;
    }
    /* Default button styles */
.btn {
    background-color: #3498db; /* Default button color */
    color: #ffffff; /* Default text color */
    border: none;
    padding: 10px 20px;
    cursor: pointer;
    margin: 5px;
    border-radius: 5px;
}

/* Apply dull color to last clicked button, excluding the Updates button */
.btn-footer:focus,
.btn-home:focus,
.btn-about:focus,
.btn-session:focus {
    background-color: #4834d4; /* Dull button color */
    color: white; /* Dull text color */
    outline: none; /* Remove default focus outline */
}




/* Mobile Styles */
@media only screen and (max-width: 500px) {
    button.btn-updates {
        width: 100%;
        margin-top: 20px;
    }

    .horizontal-buttons button {
        width: calc(50% - 10px); /* Set width to 50% of container minus margins */
        margin: 0 5px 10px; /* Add some vertical margin between buttons */
        font-size: 12px; /* Decrease font size */
        padding: 5px 10px; /* Adjust padding */
        height: 40px; /* Adjust the height of the buttons */
    }

    .show-products,
    .show-products.b2,
    .show-products.b3 {
        margin-top: 20px;
    }

    /* Adjust width and margin for the "About" button in mobile version */
    .horizontal-buttons .btn:nth-child(3) {
        width: calc(50% - 15px); /* Set width to 50% of container minus margins */
        margin: 0 5px 10px; /* Add some vertical margin between buttons */
    }
    .wide-button {
        width: 100%; /* Make the wide button full width */
        margin: 0 5px 10px; /* Add some vertical margin */
    }
}


</style>


<script>
    // After 15 seconds, clear the URL and the displayed message
    setTimeout(function() {
        var url = window.location.href;
        var cleanUrl = url.split('?')[0]; // Remove query parameters
        window.history.replaceState({}, document.title, cleanUrl); // Clear the URL
        document.getElementById('message').innerHTML = ''; // Clear the displayed message
    }, 15000); // 15 seconds in milliseconds

    document.addEventListener("DOMContentLoaded", function () {
        var buttons = document.querySelector('.horizontal-buttons');
        var section = document.querySelector('.show-products');
        var section2 = document.querySelector('.show-products.b2'); // Updated class name
        var section3 = document.querySelector('.show-products.b3'); // Updated class name
        var section4 = document.querySelector('.show-products.b4'); // New session section

        var updatesButton = document.querySelector('.btn-updates');
        var footerButton = document.querySelector('.horizontal-buttons .btn:nth-child(1)');
        var homeButton = document.querySelector('.horizontal-buttons .btn:nth-child(2)');
        var aboutButton = document.querySelector('.horizontal-buttons .btn:nth-child(3)');
        var sessionButton = document.querySelector('.horizontal-buttons .btn:nth-child(4)'); // Session button

        // Variable to track the state of sections and buttons
        var sectionsVisible = false;
        var buttonsVisible = false;

        function hideAllSections() {
            section.style.display = 'none';
            section2.style.display = 'none';
            section3.style.display = 'none';
            section4.style.display = 'none'; // Hide session section
        }

        function hideAllButtons() {
            buttons.style.display = 'none';
            buttonsVisible = false;
        }

        function showButtons() {
            buttons.style.display = 'flex';
            buttonsVisible = true;
        }

        // Event listener for the "Updates" button
        updatesButton.addEventListener('click', function () {
            if (sectionsVisible && buttonsVisible) {
                hideAllSections();
                hideAllButtons();
                sectionsVisible = false;
                buttonsVisible = false;
            } else {
                showButtons();
                sectionsVisible = true;
                buttonsVisible = true;
            }
        });

        // Event listener for the other buttons
        footerButton.addEventListener('click', function (event) {
            event.stopPropagation();
            if (section.style.display === 'none') {
                hideAllSections();
                section.style.display = 'block';
                sectionsVisible = true;
            } else {
                hideAllSections();
                sectionsVisible = false;
            }
        });

        homeButton.addEventListener('click', function (event) {
            event.stopPropagation();
            if (section2.style.display === 'none') {
                hideAllSections();
                section2.style.display = 'block';
                sectionsVisible = true;
            } else {
                hideAllSections();
                sectionsVisible = false;
            }
        });

        aboutButton.addEventListener('click', function (event) {
            event.stopPropagation();
            if (section3.style.display === 'none') {
                hideAllSections();
                section3.style.display = 'block';
                sectionsVisible = true;
            } else {
                hideAllSections();
                sectionsVisible = false;
            }
        });

        sessionButton.addEventListener('click', function (event) {
            event.stopPropagation();
            if (section4.style.display === 'none') {
                hideAllSections();
                section4.style.display = 'block';
                sectionsVisible = true;
            } else {
                hideAllSections();
                sectionsVisible = false;
            }
        });
    });
    function confirmDelete(fileName) {
        // Display a confirmation dialog
        var confirmDelete = confirm("Are you sure you want to delete the image?");
        
        // If user confirms, submit the form to delete the image
        if (confirmDelete) {
            var form = document.getElementById('deleteForm_' + fileName);
            form.submit();
        }
    }
</script>

</head>
<body>
<div id="messageContainer">
    <?php
    // Extract the success message from the URL parameter if it exists
    if(isset($_GET['success'])) {
        $successMessage = urldecode($_GET['success']); // Decode URL parameter
        echo '<script>';
        echo 'document.addEventListener("DOMContentLoaded", function() {';
        echo 'var messageContainer = document.getElementById("messageContainer");';
        echo 'messageContainer.innerHTML = "<p style=\"color: green; font-weight: bold; font-size: 10px;\">' . $successMessage . '</p>";';
        echo 'setTimeout(function() { messageContainer.innerHTML = ""; }, 15000);'; // Remove message after 15 seconds
        echo 'setTimeout(function() { window.history.replaceState({}, document.title, window.location.pathname); }, 15000);'; // Remove message from URL after 15 seconds
        echo '});';
        echo '</script>';
    }
    ?>
</div>

    <button class="btn btn-updates" style="background-color: #4834d4;">Updates</button>
    <div class="horizontal-buttons" style="display: none;">
        <button class="btn btn-footer" tabindex="0" >Footer</button>
        <button class="btn btn-home" tabindex="0" >Home</button>
        <button class="btn btn-about" tabindex="0" >About</button>
        <button class="btn btn-session" tabindex="0" >Session</button>
    </div>

    <form method="post" action="">
        <section class="show-products">
            <div class="box-container">
                <div class="box">
                    <label for="address" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Address:</label>
                    <textarea id="address" name="address" rows="4" cols="50" maxlength="90" required class="box"><?=$address?></textarea><br>

                    <!-- Replace the existing label and input for the link with the following code -->
                    <label for="link" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Link:</label>
                    <textarea id="link" name="link" rows="2" cols="50" maxlength="50" required class="box"><?=$link?></textarea><br>

                    <label for="openingHours" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Opening Hours:</label>
                    <input type="text" id="openingHours" name="openingHours" value="<?=$openingHours?>" required class="box"><br>

                    <label for="email1" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Email 1:</label>
                    <input type="email" id="email1" name="email1" value="<?=$emails['Email1']?>" required class="box"><br>

                    <label for="email2" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Email 2:</label>
                    <input type="email" id="email2" name="email2" value="<?=$emails['Email2']?>" required class="box"><br>

                    <label for="phoneNumber1" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Phone Number 1:</label>
                    <input type="text" id="phoneNumber1" name="phoneNumber1" value="<?=$phoneNumbers['Number-1']?>" required class="box"><br>

                    <label for="phoneNumber2" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Phone Number 2:</label>
                    <input type="text" id="phoneNumber2" name="phoneNumber2" value="<?=$phoneNumbers['Number-2']?>" required class="box"><br>

                    <button class="btn" name="footer-update">Update</button>
                </div>
            </div>
        </section>
    </form>


<!-- Output HTML content here -->
<section class="show-products b2">
    <?php if ($imageCount != 5): ?>
        <!-- Form for uploading a new image -->
        <div class="box-container">
            <div class="box">
                <form action="" method="post" enctype="multipart/form-data">
                    <input type="text" placeholder="Enter Text To Display In Silder"name="fileName" class="box" required>
                    <input type="file" name="file" accept=".png" class="file-input" required>
                    <button type="submit" name="upload" class="btn">Upload Image</button>
                </form>
            </div>
        </div>
    <?php endif; ?>
    
    <!-- Display existing images -->
    <div class="box-container">
    <?php foreach ($imageData as $data): ?>
        <div class="box">
            <input type="text" value="<?php echo $data['fileName']; ?>" class="box" readonly>
            <img src="<?php echo $data['url']; ?>" alt="Firebase Image">
            <form id="deleteForm_<?php echo $data['fileName']; ?>" method="post" action="">
                <input type="hidden" name="delete_file" value="<?php echo $data['fileName']; ?>">
                <!-- Call confirmDelete() function with the file name as parameter -->
                <button type="button" class="btn btn-delete" onclick="confirmDelete('<?php echo $data['fileName']; ?>')">Delete Image</button>
            </form>

        </div>
    <?php endforeach; ?>
    </div>
</section>



<section class="show-products b3" style="display: none;">
<div class="box-container">
<?php
$stepNames = ['choose', 'pay', 'eatfood'];

foreach ($stepNames as $stepName) {
    // Find any file with the specified name and any valid extension
    $objects = $bucket->objects(['prefix' => "about/$stepName"]);

    foreach ($objects as $object) {
        // Generate a signed URL for the image or video
        $imageUrl = $object->signedUrl(new \DateTime('tomorrow'));

        // Capitalize the first letter of each word in $stepName
        $stepDisplayName = ucwords(str_replace('_', ' ', $stepName));

        echo "<div class='box'>";
        echo "<h3 style='font-size: 16px; text-align: left; color: #34495e;'>$stepDisplayName</h3>";
        echo "<img src='$imageUrl' alt='$stepDisplayName'>";

        // Input field for choosing a file
        echo "<form method='post' action='' enctype='multipart/form-data'>";
        echo "<input type='file' name='file_$stepName' accept='image/*' style='margin-top: 10px;'>";
        echo "<input type='hidden' name='stepName' value='$stepName'>"; // Hidden field to track stepName
        echo "<button type='submit' class='btn' name='update_image'>Update Image</button>";
        echo "</form>";

        echo "<div class='label-container'>";
        echo "</div>";
        echo "</div>";
    }
}
?>
        <form method="post" action="" enctype="multipart/form-data">
            <!-- Single textarea for the about content -->
            <label style="font-size: 16px; text-align: left; color: #34495e; display: block;">About</label>
            <textarea id="aboutContent" name="aboutContent" rows="10" cols="50" required class="box pc-style"><?=$existingContent?></textarea><br>


            <!-- Button to submit the form and update the images -->
            <button class="btn wide-button" name="about-update">Update</button>
        </form>
    </div>

</section>
<section class="show-products b4">
    <div class="box-container">
        <div class="box">
            <label for="Status" style="font-size: 16px; text-align: left; color: #34495e; display: block;">Status:</label>
            <?php
                // Function to fetch status from Firebase URL
                function fetchStatus() {
                    $firebase_url = 'https://test-dc739-default-rtdb.firebaseio.com/Service/Status.json';

                    // Initialize cURL session
                    $ch = curl_init();

                    // Set cURL options
                    curl_setopt($ch, CURLOPT_URL, $firebase_url);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

                    // Execute cURL session
                    $response = curl_exec($ch);

                    // Close cURL session
                    curl_close($ch);

                    // Decode JSON response
                    $data = json_decode($response, true);

                    // Check if "Status" field is present and return appropriate message
                    if (isset($data)) {
                        return $data;
                    } else {
                        return "Status not available";
                    }
                }

                // Fetch status
                $status = fetchStatus();
            ?>
            <select id="Status" name="Status" class="box" required>
                <option value="IDLE" <?= ($status === 'IDLE') ? 'selected' : '' ?>>IDLE</option>
                <option value="RUNNING" <?= ($status === 'RUNNING') ? 'selected' : '' ?>>RUNNING</option>
            </select><br>
            <button class="btn" onclick="updateStatus()">Update</button>
            <label id="statusMessage" style="display: block; margin-top: 10px; font-size: 15px;"></label>
            <script>
                // Function to update status message
                function updateStatusMessage(status) {
                    var statusMessage = document.getElementById("statusMessage");
                    if (status === "IDLE") {
                        statusMessage.textContent = "The Canteen Is closed At the moment";
                        statusMessage.style.color = "red";
                    } else if (status === "RUNNING") {
                        statusMessage.textContent = "The Canteen Is Functioning";
                        statusMessage.style.color = "green";
                    }
                }

                // Function to fetch initial status and update message
                function initializeStatusMessage() {
                    var currentStatus = document.getElementById("Status").value;
                    updateStatusMessage(currentStatus);
                }

                // Call initializeStatusMessage function when the page loads
                initializeStatusMessage();

                function updateStatus() {
                    var newStatus = document.getElementById("Status").value;
                    var firebaseUrl = 'https://test-dc739-default-rtdb.firebaseio.com/Service.json';
                    
                    // Make a PUT request to update status in Firebase
                    fetch(firebaseUrl, {
                        method: 'PUT',
                        body: JSON.stringify({ Status: newStatus }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => {
                        if (response.ok) {
                            alert('Status updated successfully');
                            // Update status message based on new status
                            updateStatusMessage(newStatus);
                        } else {
                            alert('Failed to update status');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Failed to update status');
                    });
                }
            </script>
        </div>
    </div>
</section>




    <!-- ... (your existing HTML code) ... -->
</body>
</html>