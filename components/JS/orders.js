import { supabase } from "./config.js";

let isOpen = false;


// ================= INIT (header/footer now loaded by user_header.js/footer.js) =================
document.addEventListener("DOMContentLoaded", () => {
    loadOrders();
});





// ================= LOAD ORDERS =================
async function loadOrders() {

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("email", user.email)
        .order("order_date", { ascending: false });

    const container = document.getElementById("ordersContainer");
    container.innerHTML = "";

    orders.forEach(order => {

        const div = document.createElement("div");
        div.className = "box";
        div.style.display = "none";

        let rows = "";

        if (order.products) {
            Object.values(order.products).forEach(p => {
                rows += `
                    <tr>
                        <td>${p.name}</td>
                        <td>₹ ${p.price}</td>
                        <td>${p.quantity}</td>
                        <td>₹ ${p.total_cost}</td>
                    </tr>
                `;
            });
        }

        div.innerHTML = `
            <p class="order-status" data-status="${order.status}">
                Order ID: ${order.order_id}
            </p>

            <p>Placed on: ${order.order_date}</p>

            <table class="small-item-details">
                <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                </tr>
                ${rows}
            </table>

            <p>Total: ₹ ${order.overall_total}</p>
            <p>Status: ${order.status}</p>
        `;

        container.appendChild(div);
    });
}


// ================= TOGGLE =================
window.toggleButtons = function () {

    const pending = document.getElementById("pendingBtn");
    const complete = document.getElementById("completeBtn");
    const cancel = document.getElementById("cancelBtn");

    const boxes = document.querySelectorAll(".box");

    if (!isOpen) {

        pending.style.display = "inline-block";
        complete.style.display = "inline-block";
        cancel.style.display = "inline-block";

        // Hide orders boxes only
        document.querySelectorAll('#ordersContainer .box').forEach(b => b.style.display = "none");

        isOpen = true;

    } else {

        pending.style.display = "none";
        complete.style.display = "none";
        cancel.style.display = "none";

        // Hide orders boxes only
        document.querySelectorAll('#ordersContainer .box').forEach(b => b.style.display = "none");

        isOpen = false;
    }
};



// ================= FILTER =================
document.addEventListener("click", (e) => {

    if (e.target.id === "pendingBtn") filter("Order Pending");
    if (e.target.id === "completeBtn") filter("Complete");
    if (e.target.id === "cancelBtn") filter("Cancelled");

});


function filter(status) {

    document.querySelectorAll("#ordersContainer .box").forEach(box => {

        const s = box.querySelector(".order-status")?.dataset.status;

        box.style.display = (s === status) ? "block" : "none";
    });
}
