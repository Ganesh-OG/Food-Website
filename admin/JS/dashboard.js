import { renderAdminShell, supabase, formatCurrency, createStatusTag, escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
    const view = await renderAdminShell({
        title: "Dashboard",
        subtitle: "Broader operational view for sales, users, messages, and live site settings.",
        requiredAnyPower: ["sales_dashboard", "dashboard_view", "dashboard_edit"]
    });

    if (!view?.root) return;

    const { root, hasPower, hasAnyPower } = view;

    root.innerHTML = `
        <div class="panel-grid">
            <div class="panel-grid three" id="metricCards"></div>
            <div class="panel-grid two" id="detailCards"></div>
        </div>
    `;

    const [productsRes, ordersRes, contactsRes, usersRes, serviceRes, configRes] = await Promise.all([
        hasAnyPower(["product_view", "product_add", "product_edit"]) ? supabase.from("products").select("id, name, stock, category, Status", { count: "exact" }) : Promise.resolve({ data: [], count: 0 }),
        hasAnyPower(["sales_dashboard", "dashboard_view", "order_complete", "order_cancel", "order_partial_cancel"]) ? supabase.from("orders").select("order_id, email, overall_total, status, order_date, products", { count: "exact" }).order("order_date", { ascending: false }).limit(12) : Promise.resolve({ data: [], count: 0 }),
        hasPower("message_view") ? supabase.from("contacts").select("id, name, email, Status, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [], count: 0 }),
        hasAnyPower(["wallet_view", "wallet_add_money"]) ? supabase.from("users").select("id, name, balance, role, user_type", { count: "exact" }).limit(200) : Promise.resolve({ data: [], count: 0 }),
        hasPower("site_control") ? supabase.from("service_status").select("*").limit(1) : Promise.resolve({ data: [] }),
        hasPower("site_control") ? supabase.from("app_config").select("*").limit(1) : Promise.resolve({ data: [] })
    ]);

    const products = productsRes.data || [];
    const orders = ordersRes.data || [];
    const contacts = contactsRes.data || [];
    const users = usersRes.data || [];
    const serviceRow = serviceRes.data?.[0];
    const configRow = configRes.data?.[0];

    const pendingOrders = orders.filter(order => normalizeOrderStatus(order.status) === "Order Pending").length;
    const completedOrders = orders.filter(order => normalizeOrderStatus(order.status) === "Complete").length;
    const cancelledOrders = orders.filter(order => normalizeOrderStatus(order.status) === "Cancelled").length;
    const revenue = orders
        .filter(order => normalizeOrderStatus(order.status) !== "Cancelled")
        .reduce((sum, order) => sum + Number(order.overall_total || 0), 0);
    const refunded = orders.reduce((sum, order) => sum + getRefundTotal(order), 0);
    const lowStock = products.filter(product => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5).length;
    const outOfStock = products.filter(product => Number(product.stock || 0) <= 0).length;
    const totalWallet = users.reduce((sum, row) => sum + Number(row.balance || 0), 0);
    const externalUsers = users.filter(user => String(user.user_type || "").toLowerCase() === "external").length;

    const metricCards = [];

    if (hasAnyPower(["product_view", "product_add", "product_edit"])) {
        metricCards.push(card("Products", productsRes.count ?? products.length, `${lowStock} low stock • ${outOfStock} out of stock`));
    }

    if (hasAnyPower(["sales_dashboard", "dashboard_view", "order_complete", "order_cancel", "order_partial_cancel"])) {
        metricCards.push(card("Orders", ordersRes.count ?? orders.length, `${pendingOrders} pending • ${completedOrders} complete • ${cancelledOrders} cancelled`));
        metricCards.push(card("Revenue", formatCurrency(revenue), `Refunds marked: ${formatCurrency(refunded)}`));
    }

    if (hasPower("message_view")) {
        metricCards.push(card("Messages", contactsRes.count ?? contacts.length, `${contacts.filter(item => normalizeMessageStatus(item.Status) === "Pending").length} pending review`));
    }

    if (hasAnyPower(["wallet_view", "wallet_add_money"])) {
        metricCards.push(card("Users", usersRes.count ?? users.length, `${externalUsers} customers • wallet ${formatCurrency(totalWallet)}`));
    }

    if (hasPower("site_control")) {
        metricCards.push(card("Service", createStatusTag(serviceRow?.status || "Unknown"), configRow?.opening_hours || "Opening hours not configured"));
    }

    document.getElementById("metricCards").innerHTML = metricCards.join("");
    document.getElementById("detailCards").innerHTML = [
        detailCard("Recent Orders", orders.length ? orders.slice(0, 6).map(order => `
            <div class="list-item">
                <strong>${escapeHtml(order.order_id || "Order")}</strong>
                <div class="muted">${escapeHtml(order.email || "No email")}</div>
                <div class="muted">${formatCurrency(order.overall_total || 0)} • ${escapeHtml(normalizeOrderStatus(order.status))}</div>
            </div>
        `).join("") : `<div class="empty">No recent orders found.</div>`),
        detailCard("Recent Messages", contacts.length ? contacts.slice(0, 6).map(item => `
            <div class="list-item">
                <strong>${escapeHtml(item.name || "Unknown sender")}</strong>
                <div class="muted">${escapeHtml(item.email || "No email")}</div>
                <div class="muted">${escapeHtml(normalizeMessageStatus(item.Status))}</div>
            </div>
        `).join("") : `<div class="empty">No recent messages found.</div>`),
        detailCard("Stock Snapshot", hasAnyPower(["product_view", "product_add", "product_edit"])
            ? `
                <div class="list-item"><strong>Low stock items</strong><div class="muted">${lowStock}</div></div>
                <div class="list-item"><strong>Out of stock items</strong><div class="muted">${outOfStock}</div></div>
                <div class="list-item"><strong>Categories live</strong><div class="muted">${new Set(products.map(item => item.category).filter(Boolean)).size}</div></div>
            `
            : `<div class="empty">Product metrics unavailable for this role.</div>`),
        detailCard("Site Snapshot", hasPower("site_control")
            ? `
                <div class="list-item"><strong>Status</strong><div class="muted">${escapeHtml(serviceRow?.status || "Unknown")}</div></div>
                <div class="list-item"><strong>Hours</strong><div class="muted">${escapeHtml(configRow?.opening_hours || "Not set")}</div></div>
                <div class="list-item"><strong>Phone</strong><div class="muted">${escapeHtml(Array.isArray(configRow?.phones) ? configRow.phones.join(", ") : "") || "Not set"}</div></div>
            `
            : `<div class="empty">Site controls are not assigned to this role.</div>`)
    ].join("");
}

function card(title, value, note) {
    return `
        <div class="card">
            <h3>${title}</h3>
            <div class="metric">${value}</div>
            <div class="muted">${note}</div>
        </div>
    `;
}

function detailCard(title, body) {
    return `
        <div class="card">
            <h3>${title}</h3>
            <div class="stack">${body}</div>
        </div>
    `;
}

function normalizeOrderStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value.startsWith("complete")) return "Complete";
    if (value.startsWith("cancel")) return "Cancelled";
    return "Order Pending";
}

function normalizeMessageStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value === "read" || value === "reviewed") return "Read";
    if (value === "replied" || value === "answered" || value === "resolved") return "Replied";
    return "Pending";
}

function getRefundTotal(order) {
    return Object.entries(order?.products || {})
        .filter(([key]) => key !== "__meta")
        .reduce((sum, [, item]) => sum + Number(item.refunded_total || 0), 0);
}
