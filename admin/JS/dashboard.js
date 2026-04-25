import { renderAdminShell, supabase, formatCurrency, createStatusTag } from "./common.js";

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
    const view = await renderAdminShell({
        title: "Dashboard",
        subtitle: "Quick overview for roles that have the dashboard power.",
        requiredPower: "sales_dashboard"
    });

    if (!view?.root) return;

    const { root, hasPower, hasAnyPower } = view;

    root.innerHTML = `
        <div class="panel-grid three" id="metricCards"></div>
    `;

    const [productsRes, ordersRes, contactsRes, usersRes, serviceRes] = await Promise.all([
        hasAnyPower(["product_view", "product_add", "product_edit"]) ? supabase.from("products").select("id, stock", { count: "exact" }) : Promise.resolve({ data: [], count: 0 }),
        hasPower("sales_dashboard") ? supabase.from("orders").select("order_id, email, overall_total, status, order_date", { count: "exact" }).order("order_date", { ascending: false }).limit(5) : Promise.resolve({ data: [], count: 0 }),
        hasPower("message_view") ? supabase.from("contacts").select("id, name, Status, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [], count: 0 }),
        hasAnyPower(["wallet_view", "wallet_add_money"]) ? supabase.from("users").select("id, balance", { count: "exact" }) : Promise.resolve({ data: [], count: 0 }),
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

    if (hasAnyPower(["wallet_view", "wallet_add_money"])) {
        const totalWallet = users.reduce((sum, row) => sum + Number(row.balance || 0), 0);
        metricCards.push(card("Users", usersRes.count ?? users.length, `Wallet total: ${formatCurrency(totalWallet)}`));
    }

    if (hasPower("site_control")) {
        metricCards.push(card("Service", createStatusTag(serviceRow?.status || "Unknown"), "Live canteen status"));
    }

    document.getElementById("metricCards").innerHTML = metricCards.join("");
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
