import { supabase } from "../../components/JS/config.js";
import { canAccessAdmin, clearStoredSession, refreshStoredSession, hasMasterControlPower } from "../../components/JS/session.js";

const USER_MANAGEMENT_POWERS = [
    "user_add",
    "user_bulk_add",
    "user_bulk_additon",
    "user_add_admin",
    "user_add_billing_staff",
    "user_add_custom_role",
    "user_add_manager",
    "user_add_sales_staff",
    "password_assist",
    "default_password"
];

const NAV_ITEMS = [
    {
        key: "dashboard",
        label: "Dashboard",
        icon: "fa-chart-line",
        href: "admin.html",
        anyPowers: ["sales_dashboard"]
    },
    {
        key: "products",
        label: "Products",
        icon: "fa-box-open",
        href: "products.html",
        anyPowers: ["product_view", "product_add", "product_edit", "product_disable_stock", "product_disable_qty"]
    },
    {
        key: "orders",
        label: "Orders",
        icon: "fa-receipt",
        href: "orders.html",
        anyPowers: ["sales_dashboard"]
    },
    {
        key: "messages",
        label: "Messages",
        icon: "fa-envelope-open-text",
        href: "messages.html",
        anyPowers: ["message_view", "message_reply", "message_delete", "message_mark_answered"]
    },
    {
        key: "wallet",
        label: "Wallet",
        icon: "fa-wallet",
        href: "wallet.html",
        anyPowers: ["wallet_view", "wallet_add_money"]
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

    const nav = availableNav.map(item => `
        <a href="${item.href}" class="${item.key === activePage ? "active" : ""}">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            <span>${item.label}</span>
        </a>
    `).join("");

    mount.innerHTML = `
        <div class="admin-shell">
            <aside class="admin-sidebar">
                <a class="admin-mark" href="./select-mode.html" aria-label="Admin home">
                    <span class="admin-mark-icon"><i class="fa-solid fa-utensils" aria-hidden="true"></i></span>
                    <span class="admin-mark-copy">
                        <strong>Admin</strong>
                        <span>${escapeHtml(title)}</span>
                    </span>
                </a>

                <nav class="admin-nav" id="adminSidebarNav">${nav}</nav>
            </aside>

            <main class="admin-main">
                <div class="admin-topbar">
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
                        <button class="admin-user-trigger" type="button" id="adminUserMenuToggle" aria-expanded="false" aria-controls="adminUserMenu">
                            <span class="admin-user-avatar" aria-hidden="true">
                                <i class="fa-solid fa-user"></i>
                            </span>
                            <span class="admin-user-trigger-icon" aria-hidden="true">
                                <i class="fa-solid fa-chevron-down"></i>
                            </span>
                        </button>

                        <div class="admin-user-menu" id="adminUserMenu" hidden>
                            <div class="admin-user-copy">
                                <strong>${escapeHtml(user.name || user.id || "Admin")}</strong>
                                <span>${escapeHtml(user.email || "")}</span>
                                <small>${escapeHtml(user.role || "Admin")} • ${powers.length} active powers</small>
                            </div>

                            <a class="btn-ghost icon-btn admin-user-profile-link" href="./profile.html">
                                <i class="fa-solid fa-id-badge" aria-hidden="true"></i>
                                <span>Profile</span>
                            </a>

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

    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
        clearStoredSession();
        window.location.href = "../signin.html";
    });

    const userMenuToggle = document.getElementById("adminUserMenuToggle");
    const userMenu = document.getElementById("adminUserMenu");
    const userPanel = userMenuToggle?.closest(".admin-user-panel");

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

export { supabase };
