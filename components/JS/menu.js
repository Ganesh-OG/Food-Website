import { supabase } from "./config.js";

// 🔥 IMPORTANT FIX (ensures add_cart.js loads first)
import "./add_cart.js";


// ================= HEADER + FOOTER =================
document.addEventListener("DOMContentLoaded", async () => {

    const header = await fetch("user_header.html");
    document.getElementById("headerContainer").innerHTML = await header.text();

    const footer = await fetch("footer.html");
    document.getElementById("footerContainer").innerHTML = await footer.text();

    await loadMenu();

    subscribeToProductChanges();
});


// ================= REALTIME =================
function subscribeToProductChanges() {

    supabase
        .channel("products-changes")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "products"
            },
            () => {
                loadMenu();
            }
        )
        .subscribe();
}


// ================= LOAD MENU =================
async function loadMenu() {

    const container = document.getElementById("menuContainer");
    if (!container) return;

    container.innerHTML = "";

    const { data: products } = await supabase
        .from("products")
        .select("*");

    if (!products || products.length === 0) {
        container.innerHTML = `<p class="empty">No products found!</p>`;
        return;
    }

    // 🔥 FILTER ENABLED ONLY
    const visibleProducts = products.filter(
        p => p.Status?.toLowerCase().trim() !== "disabled"
    );

    // 🔥 ALL DISABLED
    if (visibleProducts.length === 0) {
        container.innerHTML = `
            <p class="empty">
                Menu is currently unavailable.<br>
                Please check back later.
            </p>
        `;
        return;
    }

    visibleProducts.forEach(product => {

        const isOut = product.stock <= 0;

        const imageUrl = supabase.storage
            .from("Food-Website-Storage")
            .getPublicUrl(`Products/${product.image}`).data.publicUrl;

        const form = document.createElement("form");
        form.className = "box";

        form.innerHTML = `
            ${!isOut ? `<button class="fas fa-shopping-cart"></button>` : ""}

            <img src="${imageUrl}" 
                style="${isOut ? 'filter: grayscale(100%); opacity:0.5;' : ''}">

            <div class="cat">${product.category || "Food"}</div>
            <div class="name">${product.name}</div>

            <div class="flex">
                <div class="price"><span>₹</span>${product.price}</div>

                ${
                    isOut
                        ? `<div style="color:red;"><strong>Out of Stock</strong></div>`
                        : `
                        <div class="quantity">Quantity left: ${product.stock}</div>
                        <input type="number" class="qty"
                            min="1" max="${product.stock}" value="1">
                        `
                }
            </div>
        `;

        // ================= ADD TO CART =================
        if (!isOut) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();

                const qty = Number(form.querySelector(".qty").value);

                // 🔥 NOW SAFE (add_cart loaded via import)
                window.addToCart(product, qty);
            });
        }

        container.appendChild(form);
    });
}