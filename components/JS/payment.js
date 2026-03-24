import { supabase } from "./config.js";

let isProcessing = false;


// ================= POPUP =================
function showPopup(message) {
    document.getElementById("popupMessage").innerText = message;
    document.getElementById("popupBox").style.display = "flex";

    setTimeout(() => {
        document.getElementById("popupBox").style.display = "none";
    }, 3000);
}


// ================= LOADER =================
function showLoader(text = "Processing...") {
    document.getElementById("loaderText").innerText = text;
    document.getElementById("loaderBox").style.display = "flex";
}

function hideLoader() {
    document.getElementById("loaderBox").style.display = "none";
}


// ================= START PAYMENT =================
window.startPaymentProcess = async () => {

    if (isProcessing) return;

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const payment = localStorage.getItem("paymentSelected");

    // ❌ Payment not selected
    if (!payment) {
        showPopup("Please choose payment method before proceeding");
        return;
    }

    if (payment !== "Wallet") {
        showPopup("Only Wallet payment supported");
        return;
    }

    // 🔥 STEP 1: SERVICE CHECK
    const { data: service, error: serviceError } = await supabase
        .from("service_status")
        .select("status")
        .single();

    if (serviceError || !service || service.status !== "Working") {
        showPopup("Canteen is not functioning at the moment");
        return;
    }

    // 🔥 STEP 2: LOAD CART
    const { data: cart, error: cartError } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .single();

    if (cartError || !cart || !cart.cart_items || Object.keys(cart.cart_items).length === 0) {
        showPopup("Your cart is empty");
        return;
    }

    const cartData = cart.cart_items;

    // 🔥 STEP 3: PRODUCT CHECK
    const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, name, price, stock")
        .in("id", Object.keys(cartData));

    if (productError) {
        showPopup("Error loading products");
        return;
    }

    let total = 0;

    for (let p of products) {

        const qty = cartData[p.id];

        if (p.stock === 0) {
            showPopup(`${p.name} is out of stock. Remove item to continue`);
            return;
        }

        if (qty > p.stock) {
            showPopup(`${p.name} only ${p.stock} left`);
            return;
        }

        total += p.price * qty;
    }

    // 🔥 STEP 4: WALLET CHECK
    const { data: userData, error: walletError } = await supabase
        .from("users")
        .select("balance")
        .eq("email", user.email)
        .single();

    if (walletError || !userData) {
        showPopup("Error fetching wallet");
        return;
    }

    const wallet = Number(userData.balance);

    if (wallet < total) {
        showPopup(`Insufficient balance. Add ₹${total - wallet}`);
        return;
    }

    // ================= START PROCESS =================
    isProcessing = true;

    showLoader("⏳ Proceeding with checkout...");

    // 🔥 STEP 5: ADD TO QUEUE (SAFE)
    const { error: queueError } = await supabase
        .from("order_queue")
        .upsert({
            user_email: user.email,
            items: cartData,
            status: "waiting",
            created_at: new Date().toISOString()
        });

    if (queueError) {
        showPopup("Queue error. Try again");
        isProcessing = false;
        hideLoader();
        return;
    }

    waitForTurn(user.email);
};


// ================= QUEUE HANDLING =================
async function waitForTurn(email) {

    const interval = setInterval(async () => {

        const { data: queue, error: queueFetchError } = await supabase
            .from("order_queue")
            .select("*")
            .order("created_at", { ascending: true });

        if (queueFetchError || !queue) return;

        const position = queue.findIndex(q => q.user_email === email) + 1;

        document.getElementById("loaderText").innerText =
            `⏳ Waiting in queue... Position: ${position}`;

        // 🔥 YOUR TURN
        if (queue[0]?.user_email === email) {

            clearInterval(interval);

            document.getElementById("loaderText").innerText =
                "⚡ Processing your order...";

            // 🔥 RPC CALL
            const { data, error } = await supabase.rpc("process_order", {
                p_email: email
            });

            console.log("RPC RESPONSE:", data);
            console.log("RPC ERROR:", error);

            hideLoader();

            // ❌ HARD ERROR (404 / permission / missing RPC)
            if (error) {
                showPopup(error.message || "Order failed");
                isProcessing = false;
                return;
            }

            // ❌ BUSINESS ERROR (from DB)
            if (data !== "SUCCESS") {
                showPopup(data);

                isProcessing = false;

                await supabase
                    .from("order_queue")
                    .delete()
                    .eq("user_email", email);

                return;
            }

            // ✅ SUCCESS
            showPopup("✅ Order placed successfully!");

            await supabase
                .from("order_queue")
                .delete()
                .eq("user_email", email);

            localStorage.removeItem("paymentSelected");

            setTimeout(() => location.reload(), 1500);
        }

    }, 2000);
}