import { renderAdminShell, supabase, formatCurrency, createStatusTag, escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
    const root = renderAdminShell({
        title: "Dashboard",
        subtitle: "Quick overview of the Supabase-backed admin data."
    });

    if (!root) return;

    root.innerHTML = `
        <div class="panel-grid three" id="metricCards"></div>
        <div class="panel-grid two">
            <div class="card">
                <h3>Latest Orders</h3>
                <div class="list" id="latestOrders"></div>
            </div>
            <div class="card">
                <h3>Recent Messages</h3>
                <div class="list" id="latestMessages"></div>
            </div>
        </div>
    `;

    const [
        productsRes,
        ordersRes,
        contactsRes,
        usersRes,
        serviceRes
    ] = await Promise.all([
        supabase.from("products").select("id, stock", { count: "exact" }),
        supabase.from("orders").select("order_id, email, overall_total, status, order_date", { count: "exact" }).order("order_date", { ascending: false }).limit(5),
        supabase.from("contacts").select("id, name, Status, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(5),
        supabase.from("users").select("id, balance", { count: "exact" }),
        supabase.from("service_status").select("*").limit(1)
    ]);

    const products = productsRes.data || [];
    const orders = ordersRes.data || [];
    const contacts = contactsRes.data || [];
    const users = usersRes.data || [];
    const serviceRow = serviceRes.data?.[0];

    const totalStock = products.reduce((sum, item) => sum + Number(item.stock || 0), 0);
    const totalWallet = users.reduce((sum, user) => sum + Number(user.balance || 0), 0);

    document.getElementById("metricCards").innerHTML = [
        card("Products", productsRes.count ?? products.length, `Total stock: ${totalStock}`),
        card("Orders", ordersRes.count ?? orders.length, "Pending, completed and cancelled"),
        card("Messages", contactsRes.count ?? contacts.length, "Contacts collected from the website"),
        card("Users", usersRes.count ?? users.length, `Wallet total: ${formatCurrency(totalWallet)}`),
        card("Service", createStatusTag(serviceRow?.status || "Unknown"), "Live canteen status"),
        card("Revenue Snapshot", formatCurrency(orders.reduce((sum, item) => sum + Number(item.overall_total || 0), 0)), "From the latest loaded orders")
    ].join("");

    document.getElementById("latestOrders").innerHTML = orders.length
        ? orders.map(order => `
            <div class="list-item">
                <strong>${escapeHtml(order.order_id)}</strong>
                <div class="muted">${escapeHtml(order.email || "")}</div>
                <div>${formatCurrency(order.overall_total)} • ${createStatusTag(order.status)}</div>
            </div>
        `).join("")
        : `<div class="empty">No orders found.</div>`;

    document.getElementById("latestMessages").innerHTML = contacts.length
        ? contacts.map(message => `
            <div class="list-item">
                <strong>${escapeHtml(message.name || "Unknown")}</strong>
                <div class="muted">${escapeHtml(message.id || "")}</div>
                <div>${createStatusTag(message.Status || "Pending")}</div>
            </div>
        `).join("")
        : `<div class="empty">No messages found.</div>`;
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
