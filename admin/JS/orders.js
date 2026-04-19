import { renderAdminShell, supabase, showToast, formatCurrency, createStatusTag, escapeHtml } from "./common.js";

let orders = [];

document.addEventListener("DOMContentLoaded", initOrders);

async function initOrders() {
    const root = renderAdminShell({
        title: "Orders",
        subtitle: "Converted from the legacy PHP orders screen and now managed directly from Supabase."
    });

    if (!root) return;

    root.innerHTML = `
        <div class="card">
            <div class="toolbar">
                <select id="statusFilter">
                    <option value="">All statuses</option>
                    <option value="Order Pending">Order Pending</option>
                    <option value="Complete">Complete</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
                <input id="orderSearch" type="search" placeholder="Search by order ID or email">
                <button class="btn-ghost" id="refreshOrders">Refresh</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="ordersTable"></tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById("statusFilter").addEventListener("change", renderOrders);
    document.getElementById("orderSearch").addEventListener("input", renderOrders);
    document.getElementById("refreshOrders").addEventListener("click", loadOrders);

    await loadOrders();
}

async function loadOrders() {
    const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("order_date", { ascending: false });

    if (error) {
        showToast(error.message || "Unable to load orders", "error");
        return;
    }

    orders = data || [];
    renderOrders();
}

function renderOrders() {
    const table = document.getElementById("ordersTable");
    if (!table) return;

    const status = document.getElementById("statusFilter").value;
    const search = document.getElementById("orderSearch").value.trim().toLowerCase();

    const filtered = orders.filter(order => {
        const matchStatus = !status || order.status === status;
        const target = `${order.order_id || ""} ${order.email || ""}`.toLowerCase();
        const matchSearch = !search || target.includes(search);
        return matchStatus && matchSearch;
    });

    if (!filtered.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty">No orders match the current filter.</td></tr>`;
        return;
    }

    table.innerHTML = filtered.map(order => {
        const items = Object.values(order.products || {}).map(item => `
            <div>${escapeHtml(item.name)} x ${escapeHtml(item.quantity)}</div>
        `).join("") || "<div>No items</div>";

        const pending = String(order.status) === "Order Pending";

        return `
            <tr>
                <td>
                    <div><strong>${escapeHtml(order.order_id)}</strong></div>
                    <div class="muted">${escapeHtml(order.order_date || "")}</div>
                </td>
                <td>${escapeHtml(order.email || "")}</td>
                <td>${items}</td>
                <td>${formatCurrency(order.overall_total)}</td>
                <td>${createStatusTag(order.status)}</td>
                <td>
                    <div class="compact-actions">
                        <button class="btn-secondary" data-action="complete" data-id="${escapeHtml(order.order_id)}" ${pending ? "" : "disabled"}>Complete</button>
                        <button class="btn-danger" data-action="cancel" data-id="${escapeHtml(order.order_id)}" ${pending ? "" : "disabled"}>Cancel</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    table.querySelectorAll("button[data-action]").forEach(button => {
        button.addEventListener("click", () => handleOrderAction(button.dataset.id, button.dataset.action));
    });
}

async function handleOrderAction(orderId, action) {
    const order = orders.find(item => String(item.order_id) === String(orderId));
    if (!order) return;

    try {
        if (action === "complete") {
            const { error } = await supabase
                .from("orders")
                .update({ status: "Complete" })
                .eq("order_id", orderId);

            if (error) throw error;
            showToast(`Order ${orderId} marked as complete`);
        }

        if (action === "cancel") {
            await cancelOrder(order);
            showToast(`Order ${orderId} cancelled and stock restored`);
        }

        await loadOrders();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update order", "error");
    }
}

async function cancelOrder(order) {
    const userEmail = order.email;
    const total = Number(order.overall_total || 0);

    const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "Cancelled" })
        .eq("order_id", order.order_id);

    if (orderError) throw orderError;

    if (userEmail) {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("balance")
            .eq("email", userEmail)
            .maybeSingle();

        if (userError) throw userError;

        if (user) {
            const { error: balanceError } = await supabase
                .from("users")
                .update({ balance: Number(user.balance || 0) + total })
                .eq("email", userEmail);

            if (balanceError) throw balanceError;
        }
    }

    const products = Object.entries(order.products || {});
    for (const [productId, item] of products) {
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("stock")
            .eq("id", productId)
            .maybeSingle();

        if (productError) throw productError;
        if (!product) continue;

        const { error: stockError } = await supabase
            .from("products")
            .update({ stock: Number(product.stock || 0) + Number(item.quantity || 0) })
            .eq("id", productId);

        if (stockError) throw stockError;
    }
}
