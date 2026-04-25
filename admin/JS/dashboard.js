import { renderAdminShell, supabase, formatCurrency, createStatusTag, escapeHtml } from "./common.js";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
    const view = await renderAdminShell({
        title: "Dashboard",
        subtitle: "Quick overview tailored to the signed-in role.",
        requiredAnyPower: [
            "sales_dashboard",
            "product_view",
            "message_view",
            "wallet_access",
            "site_control",
            "footer_manage",
            "about_edit",
            "slider_manage"
        ]
    });

    if (!view?.root) return;

    const { root, hasPower, hasAnyPower } = view;

    root.innerHTML = `
        <div class="panel-grid three" id="metricCards"></div>
        <div class="panel-grid two">
            <div class="card" ${hasPower("sales_dashboard") ? "" : "hidden"}>
                <h3>Latest Orders</h3>
                <div class="list" id="latestOrders"></div>
            </div>
            <div class="card" ${hasPower("message_view") ? "" : "hidden"}>
                <h3>Recent Messages</h3>
                <div class="list" id="latestMessages"></div>
            </div>
        </div>
    `;

    const [productsRes, ordersRes, contactsRes, usersRes, serviceRes] = await Promise.all([
        hasAnyPower(["product_view", "product_add", "product_edit"]) ? supabase.from("products").select("id, stock", { count: "exact" }) : Promise.resolve({ data: [], count: 0 }),
        hasPower("sales_dashboard") ? supabase.from("orders").select("order_id, email, overall_total, status, order_date", { count: "exact" }).order("order_date", { ascending: false }).limit(5) : Promise.resolve({ data: [], count: 0 }),
        hasPower("message_view") ? supabase.from("contacts").select("id, name, Status, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], count: 0 }),
        hasPower("wallet_access") ? supabase.from("users").select("id, balance", { count: "exact" }) : Promise.resolve({ data: [], count: 0 }),
        hasPower("site_control") ? supabase.from("service_status").select("*").limit(1) : Promise.resolve({ data: [] })
    ]);

    const products = productsRes.data || [];
    const orders = ordersRes.data || [];
    const contacts = contactsRes.data || [];
    const users = usersRes.data || [];
    const serviceRow = serviceRes.data?.[0];

    const metricCards = [];

    if (hasAnyPower(["product_view", "product_add", "product_edit"])) {
        const totalStock = products.reduce((sum, item) => sum + Number(item.stock || 0), 0);
        metricCards.push(card("Products", productsRes.count ?? products.length, `Total stock: ${totalStock}`));
    }

    if (hasPower("sales_dashboard")) {
        metricCards.push(card("Orders", ordersRes.count ?? orders.length, "Pending, completed and cancelled"));
        metricCards.push(card("Revenue Snapshot", formatCurrency(orders.reduce((sum, item) => sum + Number(item.overall_total || 0), 0)), "From the latest loaded orders"));
    }

    if (hasPower("message_view")) {
        metricCards.push(card("Messages", contactsRes.count ?? contacts.length, "Contacts collected from the website"));
    }

    if (hasPower("wallet_access")) {
        const totalWallet = users.reduce((sum, row) => sum + Number(row.balance || 0), 0);
        metricCards.push(card("Users", usersRes.count ?? users.length, `Wallet total: ${formatCurrency(totalWallet)}`));
    }

    if (hasPower("site_control")) {
        metricCards.push(card("Service", createStatusTag(serviceRow?.status || "Unknown"), "Live canteen status"));
    }

    document.getElementById("metricCards").innerHTML = metricCards.join("");

    const latestOrders = document.getElementById("latestOrders");
    if (latestOrders) {
        latestOrders.innerHTML = orders.length
        ? orders.map(order => `
            <div class="list-item">
                <strong>${escapeHtml(order.order_id)}</strong>
                <div class="muted">${escapeHtml(order.email || "")}</div>
                <div>${formatCurrency(order.overall_total)} • ${createStatusTag(order.status)}</div>
            </div>
        `).join("")
        : `<div class="empty">No orders found.</div>`;
    }

    const latestMessages = document.getElementById("latestMessages");
    if (latestMessages) {
        latestMessages.innerHTML = contacts.length
        ? contacts.map(message => `
            <div class="list-item">
                <strong>${escapeHtml(message.name || "Unknown")}</strong>
                <div class="muted">${escapeHtml(message.id || "")}</div>
                <div>${createStatusTag(message.Status || "Pending")}</div>
            </div>
        `).join("")
        : `<div class="empty">No messages found.</div>`;
    }
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
