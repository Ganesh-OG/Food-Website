import { supabase } from "./config.js";


// ================= POPUP =================
function showPopup(message, type = "success") {

    let box = document.getElementById("popupBox");

    if (!box) {
        box = document.createElement("div");
        box.id = "popupBox";
        document.body.appendChild(box);
    }

    box.className = "";
    box.classList.add(type);

    box.innerText = message;

    void box.offsetWidth;

    box.classList.add("show");

    if (box.hideTimer) clearTimeout(box.hideTimer);

    box.hideTimer = setTimeout(() => {
        box.classList.remove("show");
    }, 2500);
}


// ================= UPDATE CART COUNT UI =================
function updateCartCountUI(cartItems) {

    const cartCountEl = document.getElementById("cartCount");

    if (!cartCountEl) return;

    const total = Object.values(cartItems)
        .reduce((sum, val) => sum + val, 0);

    cartCountEl.textContent = `(${total})`;
}


// ================= SERVICE CHECK =================
async function checkService() {

    const { data } = await supabase
        .from("service_status")
        .select("status")
        .single();

    if (!data || data.status !== "Working") {
        showPopup("Canteen is not functioning at the moment", "error");
        return false;
    }

    return true;
}


// ================= ADD TO CART =================
window.addToCart = async function (product, qty) {

    const ok = await checkService();
    if (!ok) return;

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        showPopup("Please login first", "error");
        return;
    }

    if (qty <= 0) {
        showPopup("Minimum quantity is 1", "error");
        return;
    }

    if (qty > product.stock) {
        showPopup(`Only ${product.stock} ${product.name} left`, "error");
        return;
    }

    try {

        // 🔥 FETCH CART
        const { data: cart } = await supabase
            .from("cart")
            .select("cart_items")
            .eq("user_email", user.email)
            .maybeSingle();

        let cartItems = cart?.cart_items || {};

        // 🔥 UPDATE
        cartItems[product.id] =
            (cartItems[product.id] || 0) + qty;

        // 🔥 SAVE
        const { error } = await supabase
            .from("cart")
            .upsert({
                user_email: user.email,
                cart_items: cartItems
            });

        if (error) {
            showPopup("Error adding to cart", "error");
            return;
        }

        // ✅ UPDATE HEADER COUNT INSTANTLY 🔥
        updateCartCountUI(cartItems);

        // ✅ SUCCESS POPUP
        showPopup(`${qty} ${product.name} added to cart`, "success");

    } catch (err) {
        console.error(err);
        showPopup("Something went wrong", "error");
    }
};