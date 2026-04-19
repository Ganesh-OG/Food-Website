<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orders</title>
    <link rel="shortcut icon" href="../images/ngplogo.jpg" type="image">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
    
<?php include '../components/admin_header.php' ?>
   <!-- custom css file link  -->
   <link rel="stylesheet" href="../css/admin_style.css">
    <style>
        /* Your existing styles remain unchanged */
        button {
            background-color: #cfcaca;
            padding: 10px;
            border-radius: 5px;
            cursor: pointer;
            width: calc(33.33% - 10px);
            text-align: center;
            margin: 5px 0;
            font-size: 14px;
        }

        .orders-button {
            width: 1135px;
        }

        button:hover {
            background-color: #89949c;
        }

        form {
            text-align: center;
            margin-bottom: 20px;
        }

        .box-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-around;
        }

        .box {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 8px;
            margin: 10px;
        }

        .small-item-details {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        .small-item-details th,
        .small-item-details td {
            padding: 8px;
            text-align: center;
            border: 1px solid #ddd;
            color: #333;
        }

        .small-item-details th {
            background-color: #f2f2f2;
            color: #555;
        }

        .small-item-details .product-name {
            font-weight: bold;
            color: #007bff;
            font-size: 16px;
        }

        .small-item-details .price,
        .small-item-details .quantity,
        .small-item-details .total {
            font-size: 14px;
        }
        .popup {
            position: fixed;
            max-height: 80vh; /* Set a maximum height for the popup */
            overflow-y: auto; /* Add vertical scrollbar if content exceeds max height */
            width: 1000px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #fff;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 1000; /* Adjust the z-index value to ensure it's higher than other elements */
        }

        .close-button {
            position: absolute;
            top: 4px;
            right: 4px;
            width: 20px; /* Adjust as needed */
            height: 20px; /* Adjust as needed */
            background-color: red;
            border-radius: 4px; /* Rounded corners */
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
        }

        .close-button::before,
        .close-button::after {
            content: "";
            position: absolute;
            width: 2px; /* Width of the X lines */
            height: 10px; /* Height of the X lines */
            background-color: white;
        }

        .close-button::before {
            transform: rotate(45deg);
        }

        .close-button::after {
            transform: rotate(-45deg);
        }

        table {
        border-collapse: collapse;
        width: 100%;
        }

        table {
            border-collapse: collapse;
            width: 100%;
        }

        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }

        th {
            background-color: #f2f2f2;
        }
        @media only screen and (max-width: 768px) {
        .popup {
            padding: 15px; /* Adjust padding for smaller screens */
            max-width: 90%; /* Adjusted maximum width for smaller screens */
        }

        .close-button {
            font-size: 16px; /* Adjust font size for smaller screens */
        }
        }

        @media only screen and (max-width: 768px) {
            button {
                width: calc(33.33% - 10px);
            }

            .orders-button {
                width: 100%;
            }

            .box {
                width: 100%;
            }
        }
    </style>
</head>

<body>
<div id="messageContainer">
    <?php
    // Function to display and remove messages
    function displayAndRemoveMessage($message, $color) {
        echo '<script>';
        echo 'document.addEventListener("DOMContentLoaded", function() {';
        echo 'var messageContainer = document.getElementById("messageContainer");';
        echo 'messageContainer.innerHTML = "<p style=\"color: ' . $color . '; font-weight: bold; font-size: 10px;\">' . $message . '</p>";';
        echo 'setTimeout(function() { messageContainer.innerHTML = ""; }, 15000);'; // Remove message after 15 seconds
        echo 'setTimeout(function() { window.history.replaceState({}, document.title, window.location.pathname); }, 15000);'; // Remove message from URL after 15 seconds
        echo '});';
        echo '</script>';
    }

    // Extract the message from the URL parameter if it exists
    if(isset($_GET['headerMessage'])) {
        $headerMessage = urldecode($_GET['headerMessage']); // Decode URL parameter
        $messageColor = strpos($headerMessage, 'successfully') !== false ? 'green' : 'red'; // Determine message color
        displayAndRemoveMessage($headerMessage, $messageColor); // Display and remove the message
    }

    // Extract the success message from the URL parameter if it exists
    if(isset($_GET['success'])) {
        $successMessage = urldecode($_GET['success']); // Decode URL parameter
        displayAndRemoveMessage($successMessage, 'green'); // Display and remove the success message
    }
    ?>
</div>

    <section class="orders">
        <button class="orders-button" style="background-color: #cfcaca;" onclick="toggleButtons()">Orders</button>
        <button id="togglePendingButton" style="display: none;">Pending Orders</button>
        <button id="toggleOrdersButton" style="display: none;">Completed Orders</button>
        <button id="toggleCancelledButton" style="display: none;">Cancelled Orders</button>
        <button class="orders-button" id="togglecancelAllButton" style="display: block; background-color:red; color:white" onclick="openCancelAllPopup()">Cancel All</button>
        <section class="placed-orders" style="display: none;">
        <div class="box-container" id="ordersContainer">
        <div id="cancelAllPopup" class="popup" style="display: none;">
           <!-- Close button (X) -->
            <span class="close-button" onclick="closeCancelAllPopup()">&times;</span>
            <!-- Content of the popup goes here -->
        </div>

<?php

$firebaseUrl = "https://test-dc739-default-rtdb.firebaseio.com/Orders.json";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $firebaseUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo 'cURL error: ' . curl_error($ch);
    exit;
}

curl_close($ch);

$data = json_decode($response, true);

if (is_array($data)) {
    $orderDetails = array();

    foreach ($data as $date => $orders) {
        if (is_array($orders)) {
            foreach ($orders as $orderId => $order) {
                $orderDetails[] = array(
                    'orderId' => $orderId, // Add the order ID to the array
                    'date' => $date,
                    'email' => $order['email'],
                    'payment_method' => isset($order['payment_method']) ? $order['payment_method'] : 'wallet',
                    'products' => $order['products'],
                    'overall_total' => $order['overall_total'],
                    'status' => $order['status'],
                );
            }
        }
    }

    foreach ($orderDetails as $order) {
        ?>
        <div class="box">
            <p data-status="<?php echo $order['status']; ?>" style="color: <?php echo getStatusColor($order['status']); ?>">
                Order ID: <?php echo $order['orderId']; ?></p>
            <p>  Placed on: <?php echo $order['date']; ?></p>

            <p>Email: <?php echo $order['email']; ?></p>
            <p>Payment Method: <?php echo $order['payment_method']; ?></p>

            <?php if (is_array($order['products'])) { ?>
                <p>Items:</p>
                <table class="small-item-details">
                    <tr>
                        <th>Product Name</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Total</th>
                    </tr>

                    <?php foreach ($order['products'] as $product) { ?>
                        <tr>
                            <td><?php echo $product['name']; ?></td>
                            <td>₹ <?php echo $product['price']; ?></td>
                            <td><?php echo $product['quantity']; ?></td>
                            <td>₹ <?php echo $product['total_cost']; ?></td>
                        </tr>
                    <?php } ?>

                </table>
            <?php } ?>

            <p>Total Price: ₹ <?php echo $order['overall_total']; ?></p>
            <p>Status: <span style="color: <?php echo getStatusColor($order['status']); ?>"><?php echo $order['status']; ?></span></p>
            <form action="Complete-orders.php" method="post" class="complete-form" onsubmit="return confirm('Are you sure you want to mark this order as complete?');">
                <input type="hidden" name="orderId" value="<?php echo $order['orderId']; ?>">
                <input type="hidden" name="date" value="<?php echo $order['date']; ?>">
                <button type="submit" class="btn" style="display:block; background-color: green;">Mark As Complete</button>
            </form>
            <form action="Cancel-orders.php" method="post" class="complete-form" onsubmit="return confirm('Are you sure you want to mark this order as Cancelled?');">
                <!-- Other hidden fields... -->
                <input type="hidden" name="orderId" value="<?php echo $order['orderId']; ?>">
                <input type="hidden" name="date" value="<?php echo $order['date']; ?>">
                <input type="hidden" name="overall_total" value="<?php echo $order['overall_total']; ?>">
                <input type="hidden" name="email" value="<?php echo $order['email']; ?>">
                <!-- Add a hidden field for products -->
                <input type="hidden" name="products" value='<?php echo json_encode($order['products']); ?>'>
                <button type="submit" class="btn" style="display:block; background-color: red;">Cancel</button>
            </form>

        </div>
    <?php
    }

} else {
    echo 'Error: Unable to decode JSON data.';
}

function getStatusColor($status) {
    switch ($status) {
        case 'Cancelled':
            return 'red';
        case 'Complete':
            return 'green';
        case 'Order Pending':
            return 'blue';
        default:
            return 'black'; // Default color if status doesn't match any of the cases
    }
}
?>
</div>

</section>
    </section>
<!-- ... (existing head content) ... -->
<script>
document.addEventListener('DOMContentLoaded', function () {
    const ordersButton = document.querySelector('.orders-button');
    const togglePendingButton = document.getElementById('togglePendingButton');
    const toggleOrdersButton = document.getElementById('toggleOrdersButton');
    const toggleCancelledButton = document.getElementById('toggleCancelledButton');
    const toggleCancelAllButton = document.getElementById('togglecancelAllButton');
    const ordersContainer = document.getElementById('ordersContainer');
    const placedOrdersSection = document.querySelector('.placed-orders');

    // Function to toggle visibility of buttons and container
    function toggleButtonsAndContainer() {
        const isInitialized = ordersButton.dataset.initialized === 'true';

        if (!isInitialized || ordersContainer.style.display === 'none') {
            // Show buttons
            togglePendingButton.style.display = 'inline-block';
            toggleOrdersButton.style.display = 'inline-block';
            toggleCancelledButton.style.display = 'inline-block';
            toggleCancelAllButton.style.display = 'inline-block';

            // Show orders container
            ordersContainer.style.display = 'block';

            ordersButton.dataset.initialized = 'true';
        } else {
            // Hide buttons
            togglePendingButton.style.display = 'none';
            toggleOrdersButton.style.display = 'none';
            toggleCancelledButton.style.display = 'none';
            toggleCancelAllButton.style.display = 'none';

            // Hide orders container
            ordersContainer.style.display = 'none';
        }
    }

    // Initial call to toggleButtonsAndContainer to show the orders by default
    toggleButtonsAndContainer();

    // Show the placed-orders section and pending orders by default
    placedOrdersSection.style.display = 'block';
    toggleOrders('Order Pending');

    // Toggle buttons and container on orders button click
    ordersButton.addEventListener('click', function () {
        toggleButtonsAndContainer();
    });

    // Function to toggle visibility of orders based on status
    function toggleOrders(status) {
        const orderBoxes = ordersContainer.getElementsByClassName('box');

        for (const box of orderBoxes) {
            const boxStatus = box.querySelector('p[data-status]').getAttribute('data-status');

            if (status === 'Order Pending') {
                if (boxStatus === 'Order Pending') {
                    box.style.display = 'block';
                } else {
                    box.style.display = 'none';
                }
            } else {
                if (boxStatus === status) {
                    if (box.style.display === 'none') {
                        box.style.display = 'block';
                    } else {
                        box.style.display = 'none';
                    }
                } else {
                    box.style.display = 'none';
                }
            }
        }

        // Show the placed-orders section when a toggle button is clicked
        placedOrdersSection.style.display = 'block';

        // Toggle display of "Mark As Complete" and "Cancel" buttons based on status
        const buttons = ordersContainer.querySelectorAll('.btn');
        for (const button of buttons) {
            if (status === 'Order Pending') {
                button.style.display = 'block';
            } else {
                button.style.display = 'none';
            }
        }
    }

    // Event listeners for toggle buttons
    toggleOrdersButton.addEventListener('click', function () {
        toggleOrders('Complete');
    });

    toggleCancelledButton.addEventListener('click', function () {
        toggleOrders('Cancelled');
    });

    // No event listener for the "Cancel All" button

    // Event listener for the "Pending Orders" button
    togglePendingButton.addEventListener('click', function () {
        // Toggle the visibility of the "Pending Orders" section
        if (ordersContainer.style.display === 'block') {
            ordersContainer.style.display = 'none';
        } else {
            // Show buttons
            togglePendingButton.style.display = 'inline-block';
            toggleOrdersButton.style.display = 'inline-block';
            toggleCancelledButton.style.display = 'inline-block';
            toggleCancelAllButton.style.display = 'inline-block';

            // Show orders container
            ordersContainer.style.display = 'block';

            ordersButton.dataset.initialized = 'true';

            // Show the placed-orders section and pending orders by default
            placedOrdersSection.style.display = 'block';
            toggleOrders('Order Pending');
        }
    });
});

function openCancelAllPopup() {
    const cancelAllPopup = document.getElementById('cancelAllPopup');
    const ordersContainer = document.getElementById('ordersContainer');
    const orderDetails = {};

    // Filter only orders with status 'Order Pending'
    const orderBoxes = ordersContainer.getElementsByClassName('box');
    for (const box of orderBoxes) {
        const status = box.querySelector('p[data-status]').getAttribute('data-status');
        if (status === 'Order Pending') {
            const orderId = box.querySelector('p[data-status]').innerText.split('Order ID: ')[1];
            const date = box.querySelector('p:nth-child(2)').innerText.split('Placed on: ')[1];

            // Group orders by date
            if (!orderDetails[date]) {
                orderDetails[date] = [];
            }

            orderDetails[date].push(orderId);
        }
    }

    // Create HTML content for the popup table
    const popupContent = `
    <span class="close-button" onclick="closeCancelAllPopup()"></span>
        <h3>Orders with Status 'Order Pending'</h3>
        <table>
            <tr>
                <th>Date</th>
                <th>Order IDs</th>
                <th>
                    <label><input type="checkbox" id="selectAllCheckbox" onclick="toggleSelectAll()"> Select All</label>
                </th>
            </tr>
            ${Object.entries(orderDetails).map(([date, orderIds]) => `
                <tr>
                    <td>${date}</td>
                    <td>${orderIds.map(orderId => `
                        <div>
                            <label><input type="checkbox" class="orderCheckbox" value="${orderId}" data-date="${date}"> ${orderId}</label>
                        </div>
                    `).join('')}</td>
                    <td>
                        <label><input type="checkbox" class="dateCheckbox" value="${date}" onclick="toggleRowCheckboxes(this)"> Select</label>
                    </td>
                </tr>
            `).join('')}
        </table>
        <button onclick="handlePopupButtonClick()" style="background-color: red; color:white;">Cancel</button>
        <div id="checkedItemsDisplay"></div>
    `;


    // Update the popup content
    cancelAllPopup.innerHTML = popupContent;

    cancelAllPopup.style.display = 'block';
}


function closeCancelAllPopup() {
    const cancelAllPopup = document.getElementById('cancelAllPopup');
    cancelAllPopup.style.display = 'none';
}

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const dateCheckboxes = document.getElementsByClassName('dateCheckbox');

    for (const checkbox of dateCheckboxes) {
        checkbox.checked = selectAllCheckbox.checked;
        toggleRowCheckboxes(checkbox);
    }
}

function toggleRowCheckboxes(clickedCheckbox) {
    const rowCheckboxes = clickedCheckbox.closest('tr').querySelectorAll('.orderCheckbox');

    for (const checkbox of rowCheckboxes) {
        checkbox.checked = clickedCheckbox.checked;
    }
}
// Function to handle the button click event
function handlePopupButtonClick() {
    // Collect checked checkboxes
    const checkedOrderCheckboxes = document.querySelectorAll('.orderCheckbox:checked');

    // Create a form element dynamically
    const form = document.createElement('form');
    form.action = 'Batch-cancel.php'; // Set the action to the PHP file
    form.method = 'post'; // Set the method to POST

    // Iterate through checked checkboxes
    checkedOrderCheckboxes.forEach(checkbox => {
        const orderId = checkbox.value;
        const date = checkbox.dataset.date;

        // Create input elements for orderId and date and append to form
        const orderIdInput = document.createElement('input');
        orderIdInput.type = 'hidden';
        orderIdInput.name = 'orderId[]'; // Use array notation to handle multiple values
        orderIdInput.value = orderId;
        form.appendChild(orderIdInput);

        const dateInput = document.createElement('input');
        dateInput.type = 'hidden';
        dateInput.name = 'date[]'; // Use array notation to handle multiple values
        dateInput.value = date;
        form.appendChild(dateInput);
    });

    // Append the form to the document body and submit it
    document.body.appendChild(form);
    form.submit();
}


// Asynchronous function to find order details based on order ID and date
async function findOrderDetailsAsync(orderId, date) {
    return new Promise(resolve => {
        const orderDetails = <?php echo json_encode($orderDetails); ?>;
        const foundOrder = orderDetails.find(order => order.orderId === orderId && order.date === date);
        resolve(foundOrder);
    });
}


</script>



<!-- ... (existing styles and scripts) ... -->


<!-- custom js file link  -->
<script src="../js/admin_script.js"></script>
</body>
</html>
