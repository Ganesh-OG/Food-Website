import { supabase } from "../../components/JS/config.js";
import { canAccessAdmin, clearStoredSession, refreshStoredSession } from "../../components/JS/session.js";

const NAV_ITEMS = [
    {
        key: "dashboard",
        label: "Dashboard",
        href: "admin.html",
        anyPowers: ["sales_dashboard", "product_view", "message_view", "wallet_access", "site_control", "footer_manage", "about_edit", "slider_manage"]
    },
    {
        key: "products",
        label: "Products",
        href: "products.html",
        anyPowers: ["product_view", "product_add", "product_edit", "product_disable_stock", "product_disable_qty"]
    },
    {
        key: "orders",
        label: "Orders",
        href: "orders.html",
        anyPowers: ["sales_dashboard", "wallet_access"]
    },
    {
        key: "messages",
        label: "Messages",
        href: "messages.html",
        anyPowers: ["message_view", "message_reply", "message_delete", "message_mark_answered"]
    },
    {
        key: "wallet",
        label: "Wallet",
        href: "wallet.html",
        anyPowers: ["wallet_access"]
    },
    {
        key: "updates",
        label: "Website Updates",
        href: "updates.html",
        anyPowers: ["site_control", "about_edit", "slider_manage", "footer_manage"]
    }
];

export async function renderAdminShell({
    title,
    subtitle = "",
    actions = "",
    requiredPower = null,
    requiredAnyPower = []
}) {
    const mount = document.getElementById("adminLayout");
    if (!mount) return null;

    const { user, powers } = await refreshStoredSession();

    if (!user) {
        window.location.href = "../signin.html";
        return null;
    }

    if (!canAccessAdmin(user, powers)) {
        window.location.href = "../index.html";
        return null;
    }

    const activePage = document.body.dataset.adminPage || "dashboard";
    const availableNav = getAvailableNavItems(powers);
    const pageAllowed = isAllowed(requiredPower, requiredAnyPower, powers);

    if (!availableNav.length) {
        mount.innerHTML = `
            <main class="mode-card">
                <p class="eyebrow">Admin Access</p>
                <h1>No Modules Assigned</h1>
                <p class="subtle">Your role is recognized, but no admin powers are currently mapped to this account.</p>
                <div class="mode-actions">
                    <a class="primary-link" href="../index.html">User Side</a>
                    <a class="secondary-link" href="./select-mode.html">Back</a>
                </div>
            </main>
        `;
        return null;
    }

    if (!pageAllowed && availableNav.length) {
        const fallback = availableNav[0];
        window.location.href = fallback.href;
        return null;
    }

    const nav = availableNav.map(item => `
        <a href="${item.href}" class="${item.key === activePage ? "active" : ""}">
            <span>${item.label}</span>
        </a>
    `).join("");

    mount.innerHTML = `
        <div class="admin-shell">
            <aside class="admin-sidebar">
                <div class="brand-block">
                    <p class="eyebrow">Food Website</p>
                    <h1>Admin Control</h1>
                    <p>Tiered access using roles plus additional powers from the users table.</p>
                </div>

                <div class="admin-sidebar-card">
                    <div class="admin-sidebar-label">Signed in as</div>
                    <div class="admin-sidebar-name">${escapeHtml(user.name || user.id || "Admin")}</div>
                    <div class="admin-sidebar-role">${escapeHtml(user.role || "Admin")}</div>
                    <div class="admin-sidebar-meta">${powers.length} active powers</div>
                </div>

                <nav class="admin-nav">${nav}</nav>

                <div class="sidebar-note">
                    Role-based navigation is live. Each screen and action now checks role powers plus user-specific additional powers.
                </div>
            </aside>

            <main class="admin-main">
                <div class="admin-topbar">
                    <div class="mode-switcher">
                        <a class="mode-link" href="../index.html">User Side</a>
                        <a class="mode-link active" href="./select-mode.html">Admin Side</a>
                    </div>

                    <div class="admin-user-panel">
                        <div class="admin-user-copy">
                            <strong>${escapeHtml(user.name || user.id || "Admin")}</strong>
                            <span>${escapeHtml(user.email || "")}</span>
                        </div>
                        <button class="btn-ghost" type="button" id="adminLogoutBtn">Logout</button>
                    </div>
                </div>

                <div class="page-header">
                    <div>
                        <h2>${escapeHtml(title)}</h2>
                        <p>${escapeHtml(subtitle)}</p>
                    </div>
                    <div class="header-actions">${actions}</div>
                </div>

                <section id="pageContent"></section>
            </main>
        </div>
    `;

    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
        clearStoredSession();
        window.location.href = "../signin.html";
    });

    return {
        root: document.getElementById("pageContent"),
        user,
        powers,
        hasPower(code) {
            return powers.includes(code);
        },
        hasAnyPower(codes = []) {
            return codes.some(code => powers.includes(code));
        }
    };
}

function getAvailableNavItems(powers) {
    return NAV_ITEMS.filter(item => isNavVisible(item, powers));
}

function isNavVisible(item, powers) {
    if (!item.anyPowers?.length) return true;
    return item.anyPowers.some(code => powers.includes(code));
}

function isAllowed(requiredPower, requiredAnyPower, powers) {
    if (requiredPower) {
        return powers.includes(requiredPower);
    }

    if (requiredAnyPower?.length) {
        return requiredAnyPower.some(code => powers.includes(code));
    }

    return true;
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
