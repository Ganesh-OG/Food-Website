import { supabase } from "./config.js";
import "./add_cart.js";

let cartData = {};

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {

    const header = await fetch("user_header.html");
    document.getElementById("headerContainer").innerHTML = await header.text();

    const footer = await fetch("footer.html");
    document.getElementById("footerContainer").innerHTML = await footer.text();

    await loadCartFromDB();
    await updateHeaderFromDB();
    loadMenu();
});

// ================= LOAD CART =================
async function loadCartFromDB() {

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

    cartData = data?.cart_items || {};
}

// ================= UPDATE CART =================
async function updateCartDB() {

    const user = JSON.parse(localStorage.getItem("user"));

    await supabase
        .from("cart")
        .update({ cart_items: cartData })
        .eq("user_email", user.email);
}

// ================= HEADER UPDATE =================
async function updateHeaderFromDB() {

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) return;

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

    const cart = data?.cart_items || {};

    let total = 0;
    Object.values(cart).forEach(q => total += q);

    const el = document.getElementById("cartCount");
    if (el) el.textContent = total > 0 ? `(${total})` : "";
}

// ================= CART BAR =================
function showCartBar() {

    const bar = document.getElementById("cartBar");
    if (!bar) return;

    bar.classList.add("show");

    let total = 0;
    Object.values(cartData).forEach(q => total += q);

    document.getElementById("cartText").textContent =
        `${total} item${total > 1 ? "s" : ""} added`;
}

// ================= TOAST =================
function showToast(message) {

    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);
}

// ================= LOAD MENU =================
async function loadMenu() {

    const container = document.getElementById("menuContainer");
    container.innerHTML = "";

    const { data: products } = await supabase
        .from("products")
        .select("*");

    if (!products) return;

    // ================= GROUP BY CATEGORY =================
    const grouped = {};

    products.forEach(p => {
        const cat = (p.category || "Others").toLowerCase();

        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    // ================= RENDER =================
    Object.keys(grouped).forEach(category => {

        // 🔥 CATEGORY HEADER (ONLY MOBILE VIA CSS)
        const header = document.createElement("div");
        header.className = "category-header";
        header.textContent = category.toUpperCase();
        container.appendChild(header);

        grouped[category].forEach(product => {

            const isOut = product.stock <= 0;
            const qty = cartData[product.id] || 0;

            const img = supabase.storage
                .from("Food-Website-Storage")
                .getPublicUrl(`Products/${product.image}`).data.publicUrl;

            const card = document.createElement("div");
            card.className = "box";

            card.innerHTML = `
                <div class="img-wrapper">
                    <img src="${img}">
                </div>

                <div style="flex:1">
                    <div class="name">${product.name}</div>

                    <div class="flex">
                        <div class="price">₹${product.price}</div>

                        ${
                            isOut
                                ? `<div class="out-of-stock">Out</div>`
                                : `
                                <div class="cart-action">
                                    ${
                                        qty > 0
                                            ? getStepper(qty)
                                            : `<button class="add-cart">ADD</button>`
                                    }
                                </div>
                                `
                        }
                    </div>
                </div>
            `;

            attachCartLogic(card, product);
            container.appendChild(card);
        });
    });
}

// ================= CART EVENTS =================
function attachCartLogic(card, product) {

    const actionBox = card.querySelector(".cart-action");
    if (!actionBox) return;

    actionBox.addEventListener("click", async (e) => {
        e.preventDefault();

        let currentQty = cartData[product.id] || 0;
        let actionType = "";

        if (e.target.classList.contains("add-cart")) {
            currentQty = 1;
            actionType = "add";
        }

        if (e.target.dataset.type === "inc") {
            currentQty++;
            actionType = "inc";
        }

        if (e.target.dataset.type === "dec") {
            currentQty--;
            actionType = "dec";
        }

        if (currentQty <= 0) {
            delete cartData[product.id];
            actionBox.innerHTML = `<button class="add-cart">ADD</button>`;
        } else {
            cartData[product.id] = currentQty;
            actionBox.innerHTML = getStepper(currentQty);
        }

        await updateCartDB();
        await updateHeaderFromDB();
        showCartBar();

        // TOAST
        if (actionType === "add" || actionType === "inc") {
            showToast(`${product.name} added`);
        }
        else if (actionType === "dec" && currentQty > 0) {
            showToast(`${product.name} updated`);
        }
        else if (currentQty <= 0) {
            showToast(`${product.name} removed`);
        }
    });
}

// ================= STEPPER =================
function getStepper(qty) {
    return `
        <div class="qty-box">
            <button class="qty-btn" data-type="dec">-</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" data-type="inc">+</button>
        </div>
    `;
}