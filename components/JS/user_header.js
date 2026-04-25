import { supabase } from "./config.js";
import { getCartCount, loadStoredCart } from "./cart_store.js";
import { canAccessAdmin, clearStoredSession, getStoredPowers, getStoredUser, refreshStoredSession } from "./session.js";

let headerPoller = null;

startHeaderInit();

function startHeaderInit() {
    const init = () => {
        if (headerPoller) {
            clearInterval(headerPoller);
            headerPoller = null;
        }

        headerPoller = setInterval(() => {
            const cartCount = document.getElementById("cartCount");
            const profile = document.getElementById("profileBox");

            if (!cartCount || !profile) return;

            clearInterval(headerPoller);
            headerPoller = null;
            initializeUserInfo();
        }, 100);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    document.addEventListener("headerLoaded", init);
}

async function syncHeaderCartCount() {
    const cartCountEl = document.getElementById("cartCount");
    if (!cartCountEl) return;

    try {
        const cartItems = await loadStoredCart(supabase);
        cartCountEl.textContent = `(${getCartCount(cartItems)})`;
    } catch (error) {
        console.error("Header cart sync error:", error);
        cartCountEl.textContent = "(0)";
    }
}

function getModeActions(user, powers) {
    if (!user) {
        return "";
    }

    const actions = [
        `<a href="profile.html" class="btn">profile</a>`
    ];

    if (canAccessAdmin(user, powers)) {
        actions.push(`<a href="admin/select-mode.html" class="btn profile-switch-btn">switch mode</a>`);
    }

    actions.push(`<a href="#" id="logoutBtn" class="delete-btn">logout</a>`);
    return actions.join("");
}

function renderGuestProfile(profile) {
    profile.innerHTML = `
        <p class="name">Guest User</p>
        <p class="profile-copy">Browse the menu, add items to cart, and sign in when you're ready.</p>
        <div class="flex profile-actions">
            <a href="signin.html" class="btn">sign in</a>
            <a href="register.html" class="delete-btn">register</a>
        </div>
    `;
}

function renderUserProfile(profile, user, powers) {
    const roleLabel = user.role || (user.user_type === "external" ? "Customer" : "User");
    const departmentLabel = user.user_type === "external"
        ? "External User"
        : (user.department || "Not assigned");
    const accessLabel = canAccessAdmin(user, powers)
        ? "User + Admin"
        : "User Only";

    profile.innerHTML = `
        <p class="name">${escapeHtml(user.name || "User")}</p>
        <p><strong>Email:</strong> ${escapeHtml(user.email || "N/A")}</p>
        <p><strong>ID:</strong> ${escapeHtml(user.id || "N/A")}</p>
        <p><strong>Role:</strong> ${escapeHtml(roleLabel)}</p>
        <p><strong>Department:</strong> ${escapeHtml(departmentLabel)}</p>
        <p><strong>Access:</strong> ${escapeHtml(accessLabel)}</p>
        <div class="flex profile-actions">
            ${getModeActions(user, powers)}
        </div>
    `;
}

async function initializeUserInfo() {
    try {
        const userBtn = document.getElementById("user-btn");
        const profile = document.getElementById("profileBox");
        const menuBtn = document.getElementById("menu-btn");
        const navbar = document.querySelector(".navbar");

        if (userBtn && profile && !userBtn.dataset.bound) {
            userBtn.dataset.bound = "true";
            userBtn.addEventListener("click", () => {
                profile.classList.toggle("active");
            });
        }

        if (menuBtn && navbar && !menuBtn.dataset.bound) {
            menuBtn.dataset.bound = "true";
            menuBtn.addEventListener("click", () => {
                navbar.classList.toggle("active");
            });
        }

        await syncHeaderCartCount();

        if (!profile) return;

        let user = getStoredUser();
        let powers = getStoredPowers();

        if (user?.id) {
            const refreshed = await refreshStoredSession();
            user = refreshed.user;
            powers = refreshed.powers;
        }

        if (!user) {
            renderGuestProfile(profile);
            return;
        }

        renderUserProfile(profile, user, powers);

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn && !logoutBtn.dataset.bound) {
            logoutBtn.dataset.bound = "true";
            logoutBtn.addEventListener("click", event => {
                event.preventDefault();
                clearStoredSession();
                window.location.href = "index.html";
            });
        }
    } catch (error) {
        console.error("Header initialization error:", error);
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

window.addEventListener("focus", () => {
    syncHeaderCartCount();
    initializeUserInfo();
});

document.addEventListener("cart:updated", () => {
    syncHeaderCartCount();
});
