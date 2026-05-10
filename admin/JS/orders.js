import { renderAdminShell, supabase, showToast, formatCurrency, createStatusTag, escapeHtml, askForTextDecision } from "./common.js";

let orders = [];
let canCompleteOrders = false;
let canCancelOrders = false;
let canPartialCancelOrders = false;

document.addEventListener("DOMContentLoaded", initOrders);

async function initOrders() {
    const view = await renderAdminShell({
        title: "Orders",
        subtitle: "Order access is limited to roles that have the sales dashboard power.",
        requiredAnyPower: ["sales_dashboard", "order_complete", "order_cancel", "order_partial_cancel"]
    });

    if (!view?.root) return;

    const { root, hasPower } = view;
    canCompleteOrders = hasPower("sales_dashboard") || hasPower("order_complete");
    canCancelOrders = hasPower("sales_dashboard") || hasPower("order_cancel");
    canPartialCancelOrders = hasPower("sales_dashboard") || hasPower("order_partial_cancel");

    root.innerHTML = `
        <div class="card orders-card">
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
        const matchStatus = !status || normalizeOrderStatus(order.status) === status;
        const target = `${order.order_id || ""} ${order.email || ""}`.toLowerCase();
        const matchSearch = !search || target.includes(search);
        return matchStatus && matchSearch;
    });

    if (!filtered.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty">No orders match the current filter.</td></tr>`;
        return;
    }

    table.innerHTML = filtered.map(order => {
        const items = getOrderItems(order).map(item => `
            <div>
                ${escapeHtml(item.name)} x ${escapeHtml(item.quantity)}
                ${item.delivery_status ? `• ${escapeHtml(item.delivery_status)}` : ""}
                ${item.refund_status ? `• ${escapeHtml(item.refund_status)}` : ""}
            </div>
        `).join("") || "<div>No items</div>";

        const pending = normalizeOrderStatus(order.status) === "Order Pending";

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
                        ${canCompleteOrders ? `<button class="btn-secondary" data-action="complete" data-id="${escapeHtml(order.order_id)}" ${pending ? "" : "disabled"}>Complete</button>` : ""}
                        ${canPartialCancelOrders ? `<button class="btn-ghost" data-action="partial" data-id="${escapeHtml(order.order_id)}" ${pending ? "" : "disabled"}>Partial Cancel</button>` : ""}
                        ${canCancelOrders ? `<button class="btn-danger" data-action="cancel" data-id="${escapeHtml(order.order_id)}" ${pending ? "" : "disabled"}>Cancel</button>` : ""}
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

    if (action === "complete" && !canCompleteOrders) {
        showToast("You do not have permission to complete orders", "error");
        return;
    }

    if (action === "cancel" && !canCancelOrders) {
        showToast("You do not have permission to cancel orders", "error");
        return;
    }

    if (action === "partial" && !canPartialCancelOrders) {
        showToast("You do not have permission to partially cancel orders", "error");
        return;
    }

    try {
        if (action === "complete") {
            const confirmed = window.confirm(`Mark order ${orderId} as complete?`);
            if (!confirmed) return;
            const { error } = await supabase
                .from("orders")
                .update({ status: "Complete" })
                .eq("order_id", orderId);

            if (error) throw error;
            showToast(`Order ${orderId} marked as complete`);
        }

        if (action === "cancel") {
            const cancelled = await cancelOrder(order);
            if (!cancelled) return;
            showToast(`Order ${orderId} cancelled and stock restored`);
        }

        if (action === "partial") {
            const partiallyCancelled = await partiallyCancelOrder(order);
            if (!partiallyCancelled) return;
            showToast(`Partial cancellation saved for ${orderId}`);
        }

        await loadOrders();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update order", "error");
    }
}

async function cancelOrder(order) {
    const decision = await askForTextDecision({
        title: `Cancel order ${order.order_id}`,
        message: "This will cancel the full order, refund the user wallet, and restore stock.",
        confirmLabel: "Full cancellation",
        promptLabel: "Reason for cancelling",
        placeholder: "Example: kitchen closed / payment issue / user requested",
        required: true
    });
    if (!decision.confirmed) return false;

    const userEmail = order.email;
    const total = Number(order.overall_total || 0);
    const products = withOrderMeta(order.products, meta => ({
        ...meta,
        cancellation_reason: decision.value,
        cancellation_type: "full",
        cancelled_at: new Date().toISOString()
    }));

    const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "Cancelled", products })
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

    const items = Object.entries(order.products || {}).filter(([key]) => key !== "__meta");
    for (const [productId, item] of items) {
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

    return true;
}

async function partiallyCancelOrder(order) {
    const items = getOrderItems(order).filter(item => !sameText(item.delivery_status, "Not delivered"));
    if (!items.length) {
        throw new Error("All items are already marked as cancelled or not delivered");
    }

    const decision = await askForPartialCancelDecision(order, items);
    if (!decision.confirmed) return false;

    let refundTotal = 0;
    const updatedProducts = withOrderMeta(order.products, meta => ({
        ...meta,
        partial_cancellation_reason: decision.reason,
        partial_cancellation_at: new Date().toISOString()
    }));

    decision.selectedIndexes.forEach(index => {
        const item = items[index];
        const productId = item.__productId;
        const refundAmount = Number(item.total_cost || 0);
        refundTotal += refundAmount;
        updatedProducts[productId] = {
            ...updatedProducts[productId],
            delivery_status: "Not delivered",
            refund_status: "Refunded",
            cancel_reason: decision.reason,
            refunded_total: refundAmount,
            stock_issue: true
        };
    });

    const { error: orderError } = await supabase
        .from("orders")
        .update({
            status: "Complete",
            products: updatedProducts
        })
        .eq("order_id", order.order_id);

    if (orderError) throw orderError;
    if (refundTotal > 0) {
        await creditUserWallet(order.email, refundTotal);
    }

    return true;
}

async function creditUserWallet(userEmail, amount) {
    if (!userEmail || !Number(amount)) return;

    const { data: user, error: userError } = await supabase
        .from("users")
        .select("balance")
        .eq("email", userEmail)
        .maybeSingle();

    if (userError) throw userError;
    if (!user) return;

    const { error: balanceError } = await supabase
        .from("users")
        .update({ balance: Number(user.balance || 0) + Number(amount || 0) })
        .eq("email", userEmail);

    if (balanceError) throw balanceError;
}

function getOrderItems(order) {
    return Object.entries(order?.products || {})
        .filter(([key]) => key !== "__meta")
        .map(([productId, item]) => ({
            __productId: productId,
            ...item
        }));
}

function withOrderMeta(products, transform) {
    const nextProducts = { ...(products || {}) };
    nextProducts.__meta = transform({ ...(nextProducts.__meta || {}) });
    return nextProducts;
}

function normalizeOrderStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value.startsWith("complete")) return "Complete";
    if (value.startsWith("cancel")) return "Cancelled";
    return "Order Pending";
}

function parseSelectionIndexes(value, max) {
    return Array.from(new Set(
        String(value || "")
            .split(/[,\s]+/)
            .map(entry => Number(entry) - 1)
            .filter(index => Number.isInteger(index) && index >= 0 && index < max)
    ));
}

function sameText(first, second) {
    return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function askForPartialCancelDecision(order, items) {
    return new Promise(resolve => {
        const existing = document.getElementById("adminPartialCancelModal");
        existing?.remove();

        const overlay = document.createElement("div");
        overlay.id = "adminPartialCancelModal";
        overlay.className = "admin-modal-overlay";
        overlay.innerHTML = `
            <div class="admin-modal-card admin-partial-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="partialCancelTitle">
                <div class="admin-modal-header">
                    <div>
                        <p class="eyebrow">Partial Cancel</p>
                        <h3 id="partialCancelTitle">Order ${escapeHtml(order.order_id)}</h3>
                    </div>
                    <button class="admin-modal-close btn-ghost" type="button" aria-label="Close partial cancel dialog">
                        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
                <p class="muted">Select the unavailable items to mark as not delivered. Only the selected items will be refunded.</p>
                <div class="admin-partial-cancel-list">
                    ${items.map((item, index) => `
                        <label class="admin-partial-cancel-item">
                            <input type="checkbox" value="${index}">
                            <span class="admin-partial-cancel-item-copy">
                                <strong>${escapeHtml(item.name || "Item")}</strong>
                                <small>${escapeHtml(`Qty: ${item.quantity || 0}`)}${item.total_cost ? ` • ${escapeHtml(formatCurrency(item.total_cost))}` : ""}</small>
                            </span>
                        </label>
                    `).join("")}
                </div>
                <label class="admin-modal-field">
                    <span>Reason</span>
                    <textarea id="partialCancelReason" rows="4" placeholder="Example: item out of stock" required></textarea>
                </label>
                <div class="admin-modal-actions">
                    <button class="btn-ghost" type="button" data-modal-cancel>Cancel</button>
                    <button class="btn" type="button" data-modal-confirm>Save Partial Cancel</button>
                </div>
            </div>
        `;

        const cleanup = (result) => {
            document.removeEventListener("keydown", handleEscape);
            overlay.remove();
            resolve(result);
        };

        const cancel = () => cleanup({ confirmed: false, selectedIndexes: [], reason: "" });

        const confirm = () => {
            const selectedIndexes = Array.from(overlay.querySelectorAll('input[type="checkbox"]:checked'))
                .map(input => Number(input.value))
                .filter(index => Number.isInteger(index) && index >= 0 && index < items.length);
            const reason = String(overlay.querySelector("#partialCancelReason")?.value || "").trim();

            if (!selectedIndexes.length) {
                showToast("Select at least one item for partial cancellation", "error");
                return;
            }

            if (!reason) {
                showToast("A reason is required for partial cancellation", "error");
                overlay.querySelector("#partialCancelReason")?.focus();
                return;
            }

            cleanup({ confirmed: true, selectedIndexes, reason });
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                cancel();
            }
        };

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                cancel();
            }
        });

        overlay.querySelector("[data-modal-cancel]")?.addEventListener("click", cancel);
        overlay.querySelector(".admin-modal-close")?.addEventListener("click", cancel);
        overlay.querySelector("[data-modal-confirm]")?.addEventListener("click", confirm);
        document.addEventListener("keydown", handleEscape);
        document.body.appendChild(overlay);
        overlay.querySelector('input[type="checkbox"]')?.focus();
    });
}
