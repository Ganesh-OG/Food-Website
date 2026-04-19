import { supabase } from "../../components/JS/config.js";

const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", href: "admin.html" },
    { key: "products", label: "Products", href: "products.html" },
    { key: "orders", label: "Orders", href: "orders.html" },
    { key: "messages", label: "Messages", href: "messages.html" },
    { key: "wallet", label: "Wallet", href: "wallet.html" },
    { key: "updates", label: "Website Updates", href: "updates.html" }
];

export function renderAdminShell({ title, subtitle = "", actions = "" }) {
    const mount = document.getElementById("adminLayout");
    if (!mount) return null;

    const activePage = document.body.dataset.adminPage || "dashboard";
    const nav = NAV_ITEMS.map(item => `
        <a href="${item.href}" class="${item.key === activePage ? "active" : ""}">${item.label}</a>
    `).join("");

    mount.innerHTML = `
        <div class="admin-shell">
            <aside class="admin-sidebar">
                <div class="brand-block">
                    <h1>Admin Control</h1>
                    <p>Legacy PHP admin converted into HTML, JS, CSS, and Supabase pages.</p>
                </div>
                <nav class="admin-nav">${nav}</nav>
                <div class="sidebar-note">
                    Current admin pages do not use session checks yet. Once the UI flow is stable, we can add admin auth on top.
                </div>
            </aside>
            <main class="admin-main">
                <div class="page-header">
                    <div>
                        <h2>${title}</h2>
                        <p>${subtitle}</p>
                    </div>
                    <div class="header-actions">${actions}</div>
                </div>
                <section id="pageContent"></section>
            </main>
        </div>
    `;

    return document.getElementById("pageContent");
}

export function showToast(message, type = "success") {
    const old = document.getElementById("adminToast");
    if (old) old.remove();

    const toast = document.createElement("div");
    toast.id = "adminToast";
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2600);
}

export function formatCurrency(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function getStatusClass(status) {
    const value = String(status || "").toLowerCase();
    if (value.includes("pending")) return "pending";
    if (value.includes("complete")) return "complete";
    if (value.includes("cancel")) return "cancelled";
    if (value.includes("working")) return "working";
    if (value.includes("enabled")) return "enabled";
    if (value.includes("disabled")) return "disabled";
    if (value.includes("stopped") || value.includes("idle")) return "stopped";
    return "pending";
}

export function createStatusTag(status) {
    return `<span class="tag ${getStatusClass(status)}">${escapeHtml(status || "N/A")}</span>`;
}

export function normalizeArrayValue(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        return value.split(",").map(item => item.trim()).filter(Boolean);
    }
    return [];
}

export function fileNameWithTimestamp(file) {
    const safeName = file.name.replace(/\s+/g, "-");
    return `${Date.now()}-${safeName}`;
}

export async function uploadToStorage(bucket, path, file) {
    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });

    if (error) throw error;
}

export async function removeFromStorage(bucket, path) {
    const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

    if (error) throw error;
}

export function getStoragePublicUrl(bucket, path) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

export function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export { supabase };
