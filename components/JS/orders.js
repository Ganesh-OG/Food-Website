import { supabase } from "./config.js";
import { showAuthPrompt } from "./auth_prompt.js";

let isOpen = false;
let ordersData = [];

const STATUS_LABELS = {
    "Order Pending": "Pending Orders",
    "Complete": "Completed Orders",
    "Cancelled": "Cancelled Orders"
};


// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
    loadOrders();
});


// ================= HELPERS =================
function getOrdersContainer() {
    return document.getElementById("ordersContainer");
}

function getEmptyState() {
    return document.getElementById("ordersEmptyState");
}

function ensureEmptyState() {
    const container = getOrdersContainer();
    if (!container) return null;

    let emptyState = getEmptyState();
    if (emptyState) return emptyState;

    emptyState = document.createElement("p");
    emptyState.id = "ordersEmptyState";
    emptyState.className = "empty";
    emptyState.style.display = "none";
    container.appendChild(emptyState);

    return emptyState;
}

function showEmptyState(message) {
    const emptyState = ensureEmptyState();
    if (!emptyState) return;

    emptyState.textContent = message;
    emptyState.style.display = "block";
}

function hideEmptyState() {
    const emptyState = getEmptyState();
    if (emptyState) emptyState.style.display = "none";
}

function hideAllOrders() {
    document.querySelectorAll("#ordersContainer .box").forEach(box => {
        box.style.display = "none";
    });
}

function updateEmptyStateFor(status = "") {
    const totalOrders = ordersData.length;

    if (!status) {
        if (totalOrders === 0) {
            showEmptyState("No Orders");
        } else {
            hideEmptyState();
        }
        return;
    }

    const matchingOrders = ordersData.filter(order => normalizeOrderStatus(order.status) === status);
    if (matchingOrders.length === 0) {
        showEmptyState(`No Orders in ${STATUS_LABELS[status]}`);
    } else {
        hideEmptyState();
    }
}


// ================= LOAD ORDERS =================
async function loadOrders() {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        ordersData = [];
        hideAllOrders();
        showEmptyState("No Orders");
        return;
    }

    const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("email", user.email)
        .order("order_date", { ascending: false });

    const container = getOrdersContainer();
    if (!container) return;

    container.innerHTML = "";
    ordersData = Array.isArray(orders) && !error ? orders : [];

    ordersData.forEach(order => {
        const div = document.createElement("div");
        div.className = "box";
        div.style.display = "none";

        let rows = "";

        if (order.products) {
            Object.entries(order.products).forEach(([key, p]) => {
                if (key === "__meta") return;
                const notDelivered = String(p.delivery_status || "").toLowerCase() === "not delivered";
                rows += `
                    <tr class="${notDelivered ? "refunded-row" : ""}">
                        <td>${p.name}</td>
                        <td>₹ ${p.price}</td>
                        <td>${p.quantity}</td>
                        <td>
                            ₹ ${p.total_cost}
                            ${notDelivered ? `<div class="refund-copy">Not delivered • Out of stock • Refunded ₹ ${Number(p.refunded_total || p.total_cost || 0).toFixed(2)}</div>` : ""}
                        </td>
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
            ${renderOrderMeta(order)}
            <p>Status: ${normalizeOrderStatus(order.status)}</p>
        `;

        container.appendChild(div);
    });

    ensureEmptyState();
    updateEmptyStateFor();
}


// ================= TOGGLE =================
window.toggleButtons = function () {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        showAuthPrompt({
            title: "Sign in to view orders",
            message: "Sign in or register to view your pending, completed, and cancelled orders.",
            redirect: "orders.html",
            preserveSourceCopy: true
        });
        return;
    }

    const pending = document.getElementById("pendingBtn");
    const complete = document.getElementById("completeBtn");
    const cancel = document.getElementById("cancelBtn");

    if (!pending || !complete || !cancel) return;

    if (!isOpen) {
        pending.style.display = "inline-block";
        complete.style.display = "inline-block";
        cancel.style.display = "inline-block";
        hideAllOrders();
        updateEmptyStateFor();
        isOpen = true;
        return;
    }

    pending.style.display = "none";
    complete.style.display = "none";
    cancel.style.display = "none";
    hideAllOrders();
    updateEmptyStateFor();
    isOpen = false;
};


// ================= FILTER =================
document.addEventListener("click", (e) => {
    if (e.target.id === "pendingBtn") filter("Order Pending");
    if (e.target.id === "completeBtn") filter("Complete");
    if (e.target.id === "cancelBtn") filter("Cancelled");
});

function filter(status) {
    let visibleCount = 0;

    document.querySelectorAll("#ordersContainer .box").forEach(box => {
        const currentStatus = normalizeOrderStatus(box.querySelector(".order-status")?.dataset.status);
        const shouldShow = currentStatus === status;

        box.style.display = shouldShow ? "block" : "none";

        if (shouldShow) {
            visibleCount++;
        }
    });

    if (visibleCount === 0) {
        showEmptyState(`No Orders in ${STATUS_LABELS[status]}`);
    } else {
        hideEmptyState();
    }
}

function normalizeOrderStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value.startsWith("complete")) return "Complete";
    if (value.startsWith("cancel")) return "Cancelled";
    return "Order Pending";
}

function renderOrderMeta(order) {
    const meta = order?.products?.__meta || {};
    const notes = [
        meta.cancellation_reason ? `Cancellation reason: ${meta.cancellation_reason}` : "",
        meta.partial_cancellation_reason ? `Partial cancellation reason: ${meta.partial_cancellation_reason}` : ""
    ].filter(Boolean);

    if (!notes.length) {
        return "";
    }

    return `
        <p class="order-note">
            ${notes.join(" • ")}
        </p>
    `;
}
