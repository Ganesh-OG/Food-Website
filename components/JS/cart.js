import { supabase } from "./config.js";

let cartData = {};
let walletBalance = 0;
let overallTotal = 0;
let isServiceWorking = true;


// ================= LOAD HEADER + FOOTER =================
document.addEventListener("DOMContentLoaded", async () => {

    const header = await fetch("user_header.html");
    document.getElementById("headerContainer").innerHTML = await header.text();

    const footer = await fetch("footer.html");
    document.getElementById("footerContainer").innerHTML = await footer.text();

});


// ================= POPUP =================
function showPopup(message) {
    const box = document.getElementById("popupBox");
    const text = document.getElementById("popupMessage");

    if (!box || !text) return;

    text.innerText = message;
    box.style.display = "flex";

    setTimeout(() => {
        box.style.display = "none";
    }, 3000);
}


// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {

    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    await checkService();
    await loadUser(user.email);
    await loadCart(user.email);
    setupDropdown();
    blockCartInteractions();

    const btn = document.getElementById("proceedToPaymentBtn");
    if (btn) btn.onclick = proceedPayment;

    setInterval(checkService, 60000);
});


// ================= GLOBAL BLOCK =================
function blockCartInteractions() {

    const cart = document.querySelector(".cart");
    if (!cart) return;

    cart.addEventListener("click", (e) => {

        // ✅ Allow Add More Items
        if (e.target.closest(".gray-rectangle-box")) {
            window.location.href = "menu.html";
            return;
        }

        // ❌ Block everything else
        if (!isServiceWorking) {
            e.preventDefault();
            e.stopPropagation();
            showPopup("Canteen is not functioning at the moment");
        }
    });
}


// ================= SERVICE =================
async function checkService() {

    const { data, error } = await supabase
        .from("service_status")
        .select("status")
        .single();

    if (error || !data) return;

    const cart = document.querySelector(".cart");
    const btn = document.getElementById("proceedToPaymentBtn");

    if (data.status !== "Working") {

        if (isServiceWorking === true) {
            showPopup("Canteen is not functioning at the moment");
        }

        isServiceWorking = false;

        if (cart) cart.style.opacity = "0.5";

        // 🔥 DO NOT disable — just style
        if (btn) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }

    } else {

        if (isServiceWorking === false) {
            showPopup("Canteen is back online");
        }

        isServiceWorking = true;

        if (cart) cart.style.opacity = "1";

        if (btn) {
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    }
}


// ================= USER =================
async function loadUser(email) {

    const { data } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

    walletBalance = Number(data?.balance || 0);

    const walletOption = document.querySelector('[data-value="Wallet"]');

    if (walletOption) {
        walletOption.innerHTML =
            `<i class="fas fa-wallet"></i> Wallet : ₹${walletBalance}`;
    }
}


// ================= CART =================
async function loadCart(email) {

    const container = document.getElementById("cartContainer");
    if (!container) return;

    container.innerHTML = "";
    overallTotal = 0;

    const { data } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", email)
        .maybeSingle();

    if (!data || !data.cart_items) {
        const empty = document.getElementById("emptyMsg");
        if (empty) empty.style.display = "block";
        return;
    }

    cartData = data.cart_items;

    const ids = Object.keys(cartData);

    const { data: products } = await supabase
        .from("products")
        .select("*")
        .in("id", ids);

    products.forEach(product => {

        const qty = cartData[product.id];
        const total = qty * product.price;
        overallTotal += total;

        const imageUrl = supabase.storage
            .from("Food-Website-Storage")
            .getPublicUrl(`Products/${product.image}`).data.publicUrl;

        const div = document.createElement("div");
        div.className = "product-box";

        div.innerHTML = `
            <div class="item">
                <img src="${imageUrl}">
            </div>

            <div class="item-details">
                <div class="item-name">${product.name}</div>
                <div class="item-price">₹${product.price}</div>

                <div class="item-quantity">
                    <i class="fas fa-minus quantity-btn" onclick="updateQuantity('${product.id}', -1)"></i>
                    <input type="text" value="${qty}" readonly>
                    <i class="fas fa-plus quantity-btn" onclick="updateQuantity('${product.id}', 1)"></i>
                </div>

                <div class="item-total">₹${total}</div>

                <div class="item-actions">
                    <i class="fas fa-trash" onclick="removeItem('${product.id}')"></i>
                </div>
            </div>
        `;

        container.appendChild(div);
    });

    const totalText = document.getElementById("overallTotal");
    if (totalText) {
        totalText.textContent = `Overall Total: ₹${overallTotal}`;
    }
}


// ================= CHECKOUT =================
async function proceedPayment() {

    await checkService();

    if (!isServiceWorking) {
        showPopup("Canteen is not functioning at the moment");
        return;
    }

    const selectedEl = document.querySelector(".custom-dropdown-selected");
    const selected = selectedEl?.getAttribute("data-value");

    if (!selected) {
        showPopup("Choose payment method");
        return;
    }

    if (selected !== "Wallet") {
        showPopup("Only Wallet supported");
        return;
    }

    const wallet = Number(walletBalance);
    const total = Number(overallTotal);

    if (wallet < total) {
        showPopup(`Insufficient balance. Add ₹${total - wallet}`);
        return;
    }

    localStorage.setItem("paymentSelected", selected);

    window.startPaymentProcess();
}


// ================= UPDATE =================
window.updateQuantity = async (id, change) => {

    if (!isServiceWorking) {
        showPopup("Canteen is not functioning at the moment");
        return;
    }

    const currentQty = cartData[id] || 0;
    const newQty = currentQty + change;

    const { data: product } = await supabase
        .from("products")
        .select("stock, name")
        .eq("id", id)
        .single();

    if (!product) return;

    if (product.stock === 0) {
        showPopup(`${product.name} is out of stock`);
        return;
    }

    if (change > 0 && newQty > product.stock) {
        showPopup(`Only ${product.stock} left for ${product.name}`);
        return;
    }

    if (newQty <= 0) delete cartData[id];
    else cartData[id] = newQty;

    await updateCart();
};


window.removeItem = async (id) => {
    delete cartData[id];
    await updateCart();
};


async function updateCart() {

    const user = JSON.parse(localStorage.getItem("user"));

    await supabase
        .from("cart")
        .update({ cart_items: cartData })
        .eq("user_email", user.email);

    location.reload();
}


// ================= DROPDOWN =================
function setupDropdown() {

    const dropdown = document.querySelector('.payment-dropdown');
    if (!dropdown) return;

    const selected = dropdown.querySelector('.custom-dropdown-selected');
    const options = dropdown.querySelector('.custom-dropdown-options');

    if (!selected || !options) return;

    selected.onclick = () => {

        if (!isServiceWorking) {
            showPopup("Canteen is not functioning at the moment");
            return;
        }

        options.classList.toggle('show-options');
    };

    options.onclick = (e) => {

        const value = e.target.dataset.value;
        if (!value) return;

        if (!isServiceWorking) {
            showPopup("Canteen is not functioning at the moment");
            return;
        }

        const wallet = Number(walletBalance);
        const total = Number(overallTotal);

        if (value === "Wallet") {
            if (wallet < total) {
                showPopup(`Add ₹${total - wallet}`);
            }
        } else {
            showPopup(`${value} not supported`);
        }

        selected.innerText = e.target.innerText;
        selected.setAttribute("data-value", value);

        localStorage.setItem("paymentSelected", value);

        options.classList.remove("show-options");
    };
}