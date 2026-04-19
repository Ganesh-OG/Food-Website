<?php

$projectId = "test-dc739";
$serviceAccountFilePath = __DIR__ . '/../servicekey/test-dc739.json'; // Adjusted service key path
$databaseUrl = "https://test-dc739-default-rtdb.firebaseio.com";
$excelFilePath = 'book1.xlsx';

// Adjusted autoload path
require __DIR__ . '/../vendor/autoload.php';
use PhpOffice\PhpSpreadsheet\IOFactory;
use Kreait\Firebase\Factory;

$factory = (new Factory)
    ->withServiceAccount($serviceAccountFilePath)
    ->withDatabaseUri($databaseUrl);

$database = $factory->createDatabase();

function formatDate($date)
{
    try {
        $dateTime = new DateTime($date);
        return $dateTime->format('n/j/Y'); // Format as n/j/Y (no leading zeros)
    } catch (Exception $e) {
        return '';
    }
}

$messages = []; // Array to store messages

// Check if a file is uploaded
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_FILES['excelFile']) && isset($_POST['department'])) {
    $uploadedFile = $_FILES['excelFile'];
    $userProvidedDepartment = $_POST['department'];

    // Validate the file type
    $allowedExtensions = ['xlsx', 'xls'];
    $fileExtension = pathinfo($uploadedFile['name'], PATHINFO_EXTENSION);

    if (in_array(strtolower($fileExtension), $allowedExtensions)) {
        $excelFilePath = $uploadedFile['tmp_name'];

        $worksheet = IOFactory::load($excelFilePath)->getActiveSheet();

        $skippedRollNames = [];

        foreach ($worksheet->getRowIterator() as $row) {
            $rollno = $worksheet->getCellByColumnAndRow(1, $row->getRowIndex())->getValue();
            $DOBCell = $worksheet->getCellByColumnAndRow(2, $row->getRowIndex());
            $DOB = formatDate($DOBCell->getFormattedValue());
            $email = $worksheet->getCellByColumnAndRow(3, $row->getRowIndex())->getValue();
            $name = $worksheet->getCellByColumnAndRow(4, $row->getRowIndex())->getValue();
            $passwordCell = $worksheet->getCellByColumnAndRow(5, $row->getRowIndex());
            $password = ($passwordCell->getDataType() == \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_NUMERIC) ? (string)$passwordCell->getValue() : $DOB;

            // Check for valid data
            $isValidData = !empty($rollno) && !empty($DOB) && !empty($email) && !empty($name) && !empty($password);

            if ($isValidData) {
                $dataExistsInDepartments = false;

                // Iterate through all departments
                $departmentsSnapshot = $database->getReference("detials/users")->getSnapshot();
                $departments = $departmentsSnapshot->getValue() ?: [];

                foreach ($departments as $department => $value) {
                    $existingData = $database->getReference("detials/users/$department/$rollno")->getValue();

                    if ($existingData) {
                        // If data exists in any department, mark it as a duplicate entry for feedback
                        $dataExistsInDepartments = true;
                        $skippedRollNames[] = "<span style='color: blue;'>Duplicate Entry: $rollno $name (Department: $department)</span>";
                        break; // No need to check other departments once a duplicate is found
                    }
                }

                // If data doesn't exist in any department, insert into the user-defined department
                if (!$dataExistsInDepartments) {
                    $userData = [
                        'DOB' => $DOB,
                        'Email' => $email,
                        'Name' => $name,
                        'Password' => $password,
                    ];

                    $database->getReference("detials/users/$userProvidedDepartment/$rollno")->set($userData);
                }
            } else {
                $skippedRollNames[] = "<span style='color: red;'>Invalid Data: $rollno $name</span>";
            }
        }

        // Add messages to the array
        if (!empty($skippedRollNames)) {
            $messages[] = '<h3>Skipped Roll Numbers and Names:</h3>';
            $messages[] = '<ul>';
            foreach ($skippedRollNames as $skippedData) {
                $messages[] = '<li>' . $skippedData . '</li>';
            }
            $messages[] = '</ul>';
        }

        $messages[] = 'Import completed.';
    } else {
        $messages[] = 'Invalid file format. Please upload a valid Excel file.';
    }
}

?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Import User Data</title>
    <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    <?php include '../components/admin_header.php' ?>
    <script src="../js/admin_script.js"></script>
    <style>
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
    }

    header {
        position: fixed;
        top: 0;
        width: 100%; /* Set the width to 100% */
        color: #fff;
        text-align: center;
        z-index: 999;
        border-bottom: none; /* Remove the border from the header */
    }

    .container {
        max-width: 800px;
        width: 80%;
        height: 300px; /* Adjust the height as needed */
        background-color: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        box-sizing: border-box;
        margin: 120px auto 20px; /* Adjust the top margin to move the container down */
    }

    form {
        margin-bottom: 20px;
    }

    label {
        display: block;
        margin-bottom: 10px;
        font-weight: bold;
    }

    /* Add border styles for the input box */
    #department {
        width: 100%;
        padding: 15px;
        font-size: 10px;
        box-sizing: border-box;
        margin-bottom: 10px;
        border: 1px solid #ccc; /* Add border */
        border-radius: 4px; /* Add border-radius for rounded corners */
    }

    .file-input-container {
        position: relative;
        margin-bottom: 15px;
    }

    .custom-file-upload {
        display: inline-block;
        padding: 10px;
        background-color: #55c2da; /* Set the default background color */
        color: #fff;
        text-align: center;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        transition: background-color 0.3s;
    }

    .custom-file-upload:hover {
        background-color: #4834d4; /* Change the background color on hover */
    }

    input[type="file"] {
        width: 0.1px;
        height: 0.1px;
        opacity: 0;
        overflow: hidden;
        position: absolute;
        z-index: -1;
    }

    input[type="submit"] {
        width: 100%;
        margin-bottom: 15px;
        padding: 10px;
        font-size: 14px;
        box-sizing: border-box;
        background-color: #55c2da; /* Set the default background color */
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;
    }

    input[type="submit"]:hover {
        background-color: #4834d4; /* Change the background color on hover */
    }

    div.notification {
        margin-top: 20px;
        padding: 15px;
        border: 1px solid #ccc;
        background-color: #f8f8f8;
        border-radius: 4px;
    }

    h3 {
        font-size: 18px;
        margin-bottom: 10px;
        color: #333;
    }

    ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    li {
        margin-bottom: 5px;
        color: #777;
    }
</style>

</head>

<body>
<header>
    <link rel="stylesheet" href="../css/admin_style.css">
    <?php include '../components/admin_header.php';?>
    </header>
    <div class="container">
        <!-- Swapped positions: Enter Department and Select Excel File -->
        <form action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" method="post" enctype="multipart/form-data">
            <label for="department">Enter Department:</label>
            <input type="text" name="department" id="department" placeholder="Enter The Department" required>

            <label for="excelFile">Select Excel File:</label>
            <div class="file-input-container">
                <div class="custom-file-upload" onclick="document.getElementById('excelFile').click()">Browse</div>
                <input type="file" name="excelFile" id="excelFile" accept=".xlsx, .xls" style="display: none;" required
                    onchange="displayFileName()">
            </div>
            <br>

            <input type="submit" value="Upload">
        </form>

        <!-- Display all messages in a single container -->
        <?php
        if (!empty($messages)) {
            echo '<div class="notification">';
            foreach ($messages as $message) {
                echo $message;
            }
            echo '</div>';
        }
        ?>
    </div>

    <script>
        // Your existing JavaScript code remains unchanged
        function displayFileName() {
            var fileInput = document.getElementById('excelFile');
            var customUpload = document.querySelector('.custom-file-upload');
            if (fileInput.files.length > 0) {
                customUpload.innerHTML = 'File Selected: ' + fileInput.files[0].name;
            } else {
                customUpload.innerHTML = 'Browse';
            }
        }
    </script>
</body>

</html>
