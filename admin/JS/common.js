import { supabase } from "../../components/JS/config.js";
import { canAccessAdmin, clearStoredSession, refreshStoredSession, hasMasterControlPower } from "../../components/JS/session.js";
import { applyTheme, initThemeToggle } from "../../components/JS/theme.js";

const USER_MANAGEMENT_POWERS = [
    "user_view",
    "user_add",
    "user_bulk_add",
    "user_bulk_additon",
    "user_add_admin",
    "user_add_billing_staff",
    "user_add_custom_role",
    "user_add_manager",
    "user_add_sales_staff",
    "user_edit",
    "password_assist",
    "default_password"
];

const DASHBOARD_POWERS = ["sales_dashboard", "dashboard_view", "dashboard_edit"];
const ORDER_MODULE_POWERS = ["order_view", "order_edit", "sales_dashboard", "order_complete", "order_cancel", "order_partial_cancel"];
const MESSAGE_MODULE_POWERS = ["message_view", "message_edit", "message_reply", "message_delete", "message_mark_answered"];
const PRODUCT_MODULE_POWERS = ["product_view", "product_add", "product_edit", "product_disable_stock", "product_disable_qty"];
const WALLET_MODULE_POWERS = ["wallet_view", "wallet_edit", "wallet_add_money"];
const UPDATE_MODULE_POWERS = [
    "update_view",
    "update_edit",
    "site_management_view",
    "site_management_edit",
    "content_pages_view",
    "content_pages_edit",
    "site_control",
    "about_edit",
    "slider_manage",
    "footer_manage",
    "category_manage",
    "loader_manage",
    "site_logo_manage"
];
const CONTROL_CENTER_POWERS = [
    "control_center_view",
    "control_center_edit",
    "approve_deny_view",
    "approve_deny_edit",
    "edit_admins_view",
    "edit_admins_edit",
    "promote_users_view",
    "promote_users_edit",
    "role_powers_view",
    "role_powers_edit",
    "power_categories_view",
    "power_categories_edit",
    "create_power_view",
    "create_power_edit",
    "req_power",
    "approve_or_deny_power",
    "approve_oe_deny_power",
    "edit_roles_and_power"
];
const REQUEST_REVIEW_POWERS = ["approve_or_deny_power", "approve_oe_deny_power", "master_control", "master_controll"];

const NAV_ITEMS = [
    {
        key: "dashboard",
        label: "Dashboard",
        icon: "fa-chart-line",
        href: "admin.html",
        anyPowers: DASHBOARD_POWERS
    },
    {
        key: "products",
        label: "Products",
        icon: "fa-box-open",
        href: "products.html",
        anyPowers: PRODUCT_MODULE_POWERS
    },
    {
        key: "orders",
        label: "Orders",
        icon: "fa-receipt",
        href: "orders.html",
        anyPowers: ORDER_MODULE_POWERS
    },
    {
        key: "messages",
        label: "Messages",
        icon: "fa-envelope-open-text",
        href: "messages.html",
        anyPowers: MESSAGE_MODULE_POWERS
    },
    {
        key: "wallet",
        label: "Wallet",
        icon: "fa-wallet",
        href: "wallet.html",
        anyPowers: WALLET_MODULE_POWERS
    },
    {
        key: "users",
        label: "Users",
        icon: "fa-users-gear",
        href: "users.html",
        anyPowers: USER_MANAGEMENT_POWERS
    },
    {
        key: "updates",
        label: "Updates",
        icon: "fa-wand-magic-sparkles",
        href: "updates.html",
        anyPowers: UPDATE_MODULE_POWERS
    },
    {
        key: "control-center",
        label: "Control Center",
        icon: "fa-user-lock",
        href: "control-center.html",
        anyPowers: CONTROL_CENTER_POWERS
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

    applyTheme();
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
                <p class="subtle">This account does not have any admin modules enabled yet.</p>
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

    const roleDisplayName = await fetchRoleDisplayName(user?.role);
    const pendingRequestCount = await fetchPendingRequestCount(powers);
    const nav = availableNav.map(item => `
        <a href="${item.href}" class="${item.key === activePage ? "active" : ""}">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            <span>${item.label}</span>
        </a>
    `).join("");

    mount.innerHTML = `
        <div class="admin-shell">
            <aside class="admin-sidebar">
                <div class="admin-mobile-head">
                    <a class="admin-mark" href="./select-mode.html" aria-label="Admin home">
                        <span class="admin-mark-icon"><i class="fa-solid fa-utensils" aria-hidden="true"></i></span>
                        <span class="admin-mark-copy">
                            <strong>Admin</strong>
                            <span>${escapeHtml(title)}</span>
                        </span>
                    </a>
                    <div class="admin-mobile-user-slot" id="adminMobileUserSlot"></div>
                </div>

                <nav class="admin-nav" id="adminSidebarNav">${nav}</nav>
            </aside>

            <main class="admin-main">
                <div class="admin-topbar" id="adminTopbar">
                    <div class="admin-topbar-left">
                        <div class="page-header">
                            <div>
                                <h2>${escapeHtml(title)}</h2>
                                <p>${escapeHtml(subtitle)}</p>
                            </div>
                            <div class="header-actions">${actions}</div>
                        </div>
                    </div>

                    <div class="admin-user-panel">
                        <button class="theme-toggle admin-theme-toggle" type="button" data-theme-toggle aria-label="Toggle theme"></button>
                        <button class="admin-user-trigger" type="button" id="adminUserMenuToggle" aria-expanded="false" aria-controls="adminUserMenu">
                            <span class="admin-user-avatar" aria-hidden="true">
                                <i class="fa-solid fa-user"></i>
                            </span>
                            ${pendingRequestCount > 0 ? `<span class="admin-user-alert">${pendingRequestCount > 9 ? "9+" : pendingRequestCount}</span>` : ""}
                            <span class="admin-user-trigger-icon" aria-hidden="true">
                                <i class="fa-solid fa-chevron-down"></i>
                            </span>
                        </button>

                        <div class="admin-user-menu" id="adminUserMenu" hidden>
                            <div class="admin-user-copy">
                                <strong>${escapeHtml(roleDisplayName || user.name || user.id || "Admin")}</strong>
                                <span>${escapeHtml(user.email || "")}</span>
                                <small>${escapeHtml(user.role || "Admin")} • ${powers.length} active powers</small>
                            </div>

                            <a class="btn-ghost icon-btn admin-user-profile-link" href="./profile.html">
                                <i class="fa-solid fa-id-badge" aria-hidden="true"></i>
                                <span>Profile</span>
                            </a>

                            ${pendingRequestCount > 0 ? `
                                <a class="btn-ghost icon-btn admin-user-profile-link" href="./control-center.html#reviewSection">
                                    <i class="fa-solid fa-bell" aria-hidden="true"></i>
                                    <span>Role / Power Requests</span>
                                </a>
                            ` : ""}

                            <div class="mode-switcher admin-user-mode-switcher">
                                <a class="mode-link" href="../index.html">User Side</a>
                                <a class="mode-link active" href="./select-mode.html">Admin Side</a>
                            </div>

                            <button class="btn-ghost icon-btn admin-user-logout" type="button" id="adminLogoutBtn">
                                <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>

                <section id="pageContent"></section>
            </main>

            <nav class="admin-bottom-nav" aria-label="Mobile navigation">
                ${nav}
            </nav>
        </div>
    `;

    initThemeToggle();
    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
        clearStoredSession();
        window.location.href = "../signin.html";
    });

    const userMenuToggle = document.getElementById("adminUserMenuToggle");
    const userMenu = document.getElementById("adminUserMenu");
    const userPanel = userMenuToggle?.closest(".admin-user-panel");
    syncAdminUserPanelPlacement();
    window.addEventListener("resize", syncAdminUserPanelPlacement);

    if (userMenuToggle && userMenu && userPanel) {
        const setOpen = (isOpen) => {
            userPanel.classList.toggle("open", isOpen);
            userMenu.hidden = !isOpen;
            userMenuToggle.setAttribute("aria-expanded", String(isOpen));
        };

        userMenuToggle.addEventListener("click", () => {
            setOpen(userMenu.hidden);
        });

        document.addEventListener("click", event => {
            if (!userPanel.contains(event.target)) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        });
    }

    return {
        root: document.getElementById("pageContent"),
        user,
        powers,
        hasPower(code) {
            return hasMasterControl(powers) || powers.includes(String(code || "").trim().toLowerCase());
        },
        hasAnyPower(codes = []) {
            return hasMasterControl(powers) || codes.some(code => powers.includes(String(code || "").trim().toLowerCase()));
        }
    };
}

async function fetchPendingRequestCount(powers = []) {
    const normalized = (powers || []).map(item => String(item || "").trim().toLowerCase());
    const canReview = REQUEST_REVIEW_POWERS.some(code => normalized.includes(code));
    if (!canReview) return 0;

    try {
        const { count, error } = await supabase
            .from("access_requests")
            .select("id", { count: "exact", head: true })
            .ilike("status", "pending");

        if (error) {
            console.error("Pending request count failed:", error);
            return 0;
        }

        return Number(count || 0);
    } catch (error) {
        console.error("Pending request count failed:", error);
        return 0;
    }
}

function syncAdminUserPanelPlacement() {
    const userPanel = document.querySelector(".admin-user-panel");
    const mobileSlot = document.getElementById("adminMobileUserSlot");
    const topbar = document.getElementById("adminTopbar");

    if (!userPanel || !mobileSlot || !topbar) return;

    if (window.innerWidth <= 640) {
        if (userPanel.parentElement !== mobileSlot) {
            mobileSlot.appendChild(userPanel);
        }
        return;
    }

    if (userPanel.parentElement !== topbar) {
        topbar.appendChild(userPanel);
    }
}

async function fetchRoleDisplayName(roleName) {
    if (!roleName) return "";

    try {
        const { data, error } = await supabase
            .from("roles")
            .select("display_name")
            .ilike("role_name", String(roleName).trim())
            .maybeSingle();

        if (error) {
            console.error("Role display name lookup failed:", error);
            return "";
        }

        return String(data?.display_name || "").trim();
    } catch (error) {
        console.error("Role display name lookup failed:", error);
        return "";
    }
}

function getAvailableNavItems(powers) {
    return NAV_ITEMS.filter(item => isNavVisible(item, powers));
}

function isNavVisible(item, powers) {
    if (!item.anyPowers?.length) return true;
    return hasMasterControl(powers) || item.anyPowers.some(code => powers.includes(String(code || "").trim().toLowerCase()));
}

function isAllowed(requiredPower, requiredAnyPower, powers) {
    if (hasMasterControl(powers)) {
        return true;
    }

    if (requiredPower) {
        return powers.includes(String(requiredPower || "").trim().toLowerCase());
    }

    if (requiredAnyPower?.length) {
        return requiredAnyPower.some(code => powers.includes(String(code || "").trim().toLowerCase()));
    }

    return true;
}

function hasMasterControl(powers = []) {
    return hasMasterControlPower(powers);
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
    }, 5000);
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
    if (value.includes("read") || value.includes("reviewed")) return "complete";
    if (value.includes("replied") || value.includes("resolved") || value.includes("answered")) return "enabled";
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

export async function moveInStorage(bucket, fromPath, toPath) {
    const { error } = await supabase.storage
        .from(bucket)
        .move(fromPath, toPath);

    if (error) throw error;
}

export function getStoragePublicUrl(bucket, path) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

let adminFilePickerId = 0;

export function initAdminFilePickers(scope = document) {
    const root = scope instanceof Element || scope instanceof Document ? scope : document;
    const inputs = root.querySelectorAll('input[type="file"]:not([data-file-picker-bound])');

    inputs.forEach(input => {
        input.dataset.filePickerBound = "true";
        input.classList.add("file-picker-input");

        if (!input.id) {
            adminFilePickerId += 1;
            input.id = `adminFilePicker${adminFilePickerId}`;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "file-picker";

        const surface = document.createElement("div");
        surface.className = "file-picker-surface";
        surface.tabIndex = 0;
        surface.setAttribute("role", "button");
        surface.setAttribute("aria-controls", input.id);
        surface.innerHTML = `
            <span class="file-picker-copy">
                <span class="file-picker-title">Choose file or drag and drop files</span>
                <span class="file-picker-name">No file chosen</span>
            </span>
        `;

        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
        wrapper.appendChild(surface);

        surface.addEventListener("click", () => input.click());
        surface.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                input.click();
            }
        });

        const updateState = () => {
            const nameNode = wrapper.querySelector(".file-picker-name");
            const titleNode = wrapper.querySelector(".file-picker-title");
            const fileCount = input.files?.length || 0;

            if (nameNode) {
                nameNode.textContent = fileCount
                    ? fileCount === 1
                        ? input.files[0].name
                        : `${fileCount} files selected`
                    : "No file chosen";
            }

            if (titleNode) {
                titleNode.textContent = fileCount ? "File ready to upload" : "Choose file or drag and drop files";
            }

            wrapper.classList.toggle("has-file", fileCount > 0);
        };

        input.addEventListener("change", updateState);

        ["dragenter", "dragover"].forEach(eventName => {
            surface.addEventListener(eventName, event => {
                event.preventDefault();
                wrapper.classList.add("is-dragover");
            });
        });

        ["dragleave", "dragend", "drop"].forEach(eventName => {
            surface.addEventListener(eventName, event => {
                event.preventDefault();
                wrapper.classList.remove("is-dragover");

                if (eventName !== "drop") return;

                const files = event.dataTransfer?.files;
                if (!files?.length) return;

                try {
                    input.files = files;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                } catch (error) {
                    input.click();
                }
            });
        });

        updateState();
    });
}

export function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export async function askForTextDecision({
    title = "Confirm Action",
    message = "",
    confirmLabel = "Confirm",
    promptLabel = "Reason",
    placeholder = "",
    required = false
} = {}) {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (!confirmed) {
        return { confirmed: false, value: "" };
    }

    const response = window.prompt(`${promptLabel}${required ? " (required)" : " (optional)"}`, placeholder) ?? "";
    const value = String(response).trim();

    if (required && !value) {
        showToast("A reason is required for this action", "error");
        return { confirmed: false, value: "" };
    }

    return { confirmed: true, value };
}

export { supabase };
