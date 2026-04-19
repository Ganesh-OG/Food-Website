<?php

// Set the path to the service account key file
putenv('GOOGLE_APPLICATION_CREDENTIALS=/../fire-food/servicekey/test-dc739.json');

require '../vendor/autoload.php'; // Include the Google Cloud PHP autoloader

use Google\Cloud\Storage\StorageClient;

// Set your Google Cloud Storage bucket name
$bucketName = 'test-dc739.appspot.com';

// Create a StorageClient object
$storage = new StorageClient([
    'projectId' => 'test-dc739', // Replace 'test-dc739' with your actual Google Cloud project ID
]);

// Get the bucket object
$bucket = $storage->bucket($bucketName);

// Define the current and new file names
$currentFilename = 'Chicken Bryani';
$newFilename = 'bryani';

// Rename the file
$object = $bucket->object($currentFilename);
$object->rename($newFilename);

echo "File renamed successfully from $currentFilename to $newFilename.";
