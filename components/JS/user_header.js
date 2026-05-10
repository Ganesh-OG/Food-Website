import { supabase } from "./config.js";
import { getCartCount, loadStoredCart } from "./cart_store.js";
import { canAccessAdmin, clearStoredSession, getStoredPowers, getStoredUser, refreshStoredSession } from "./session.js";
import { applyTheme, initThemeToggle } from "./theme.js";

let headerPoller = null;
let mobileCartSliderTimer = null;
let mobileCartPreviewIndex = 0;

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

    try {
        const cartItems = await loadStoredCart(supabase);
        const totalCount = getCartCount(cartItems);
        if (cartCountEl) {
            cartCountEl.textContent = `(${totalCount})`;
        }
        await syncMobileCartTray(cartItems, totalCount);
    } catch (error) {
        console.error("Header cart sync error:", error);
        if (cartCountEl) {
            cartCountEl.textContent = "(0)";
        }
        hideMobileCartTray();
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
        applyTheme();
        initThemeToggle();
        await syncSiteLogo();
        const userBtn = document.getElementById("user-btn");
        const profile = document.getElementById("profileBox");
        const menuBtn = document.getElementById("menu-btn");
        const navbar = document.querySelector(".navbar");
        syncMobileNav();

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

async function syncSiteLogo() {
    const logoImage = document.getElementById("siteLogoImage");
    if (!logoImage) return;

    try {
        const { data, error } = await supabase
            .from("app_config")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        const fileName = getConfiguredLogoFileName(data);
        if (!fileName) return;

        const { data: publicData } = supabase.storage
            .from("Food-Website-Storage")
            .getPublicUrl(`Logo/${fileName}`);

        if (publicData?.publicUrl) {
            logoImage.src = publicData.publicUrl;
            logoImage.alt = "Site logo";
        }
    } catch (error) {
        console.error("Site logo sync error:", error);
    }
}

async function syncMobileCartTray(cartItems, totalCount = getCartCount(cartItems)) {
    const tray = document.getElementById("mobileCartTray");
    const countEl = document.getElementById("mobileCartTrayCount");
    const imagesEl = document.getElementById("mobileCartTrayImages");

    if (!tray || !countEl || !imagesEl) return;
    if (isCartPage()) {
        hideMobileCartTray();
        return;
    }

    if (!totalCount) {
        hideMobileCartTray();
        return;
    }

    const previewItems = await getMobileCartPreviewItems(cartItems);
    countEl.textContent = `${totalCount} item${totalCount === 1 ? "" : "s"} in cart`;
    tray.hidden = false;
    renderMobileCartPreview(imagesEl, previewItems);
}

async function getMobileCartPreviewItems(cartItems) {
    const productIds = Object.keys(cartItems || {}).filter(Boolean);
    if (!productIds.length) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from("products")
            .select("id, name, image")
            .in("id", productIds);

        if (error) throw error;

        const productMap = new Map((data || []).map(item => [String(item.id), item]));

        return productIds
            .map(id => {
                const product = productMap.get(String(id));
                if (!product?.image) return null;

                return {
                    id: String(product.id),
                    name: product.name || "Cart item",
                    imageUrl: supabase.storage
                        .from("Food-Website-Storage")
                        .getPublicUrl(`Products/${product.image}`).data.publicUrl
                };
            })
            .filter(Boolean)
            .slice(0, 8);
    } catch (error) {
        console.error("Mobile cart preview load error:", error);
        return [];
    }
}

function renderMobileCartPreview(mount, items) {
    clearMobileCartSlider();

    if (!items.length) {
        mount.innerHTML = `
            <span class="mobile-cart-fallback-icon">
                <i class="fas fa-shopping-bag" aria-hidden="true"></i>
            </span>
        `;
        return;
    }

    mobileCartPreviewIndex = mobileCartPreviewIndex % items.length;
    const activeItem = items[mobileCartPreviewIndex];

    mount.innerHTML = items
        .map((item, index) => `
            <img
                src="${escapeHtml(item.imageUrl)}"
                alt="${escapeHtml(item.name)}"
                class="mobile-cart-preview-image ${index === mobileCartPreviewIndex ? "is-active" : ""}"
                loading="lazy"
            >
        `)
        .join("");

    if (items.length > 1) {
        mobileCartSliderTimer = window.setInterval(() => {
            mobileCartPreviewIndex = (mobileCartPreviewIndex + 1) % items.length;
            const previews = mount.querySelectorAll(".mobile-cart-preview-image");
            previews.forEach((image, index) => {
                image.classList.toggle("is-active", index === mobileCartPreviewIndex);
            });
        }, 1800);
    }

    if (activeItem?.imageUrl) {
        mount.dataset.activeId = activeItem.id;
    }
}

function hideMobileCartTray() {
    const tray = document.getElementById("mobileCartTray");
    const imagesEl = document.getElementById("mobileCartTrayImages");
    if (tray) {
        tray.hidden = true;
    }
    if (imagesEl) {
        imagesEl.innerHTML = "";
    }
    clearMobileCartSlider();
}

function clearMobileCartSlider() {
    if (mobileCartSliderTimer) {
        window.clearInterval(mobileCartSliderTimer);
        mobileCartSliderTimer = null;
    }
}

function syncMobileNav() {
    const path = window.location.pathname.split("/").pop() || "index.html";
    const pageKey = path === "index.html" || path === "home.html"
        ? "home"
        : path === "about.html"
            ? "about"
            : path === "menu.html"
                ? "menu"
                : path === "orders.html"
                    ? "orders"
                    : path === "contact.html"
                        ? "contact"
                        : path === "profile.html"
                            ? "profile"
                            : "";

    document.querySelectorAll("[data-mobile-nav]").forEach(link => {
        link.classList.toggle("active", link.dataset.mobileNav === pageKey);
    });
}

function isCartPage() {
    const path = window.location.pathname.split("/").pop() || "";
    return path.toLowerCase() === "cart.html";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getConfiguredLogoFileName(configRow) {
    const rawValue = configRow?.Logo ?? configRow?.logo ?? null;
    if (!rawValue) return "";

    const items = normalizeLogoValue(rawValue);
    const firstItem = items[0];
    if (!firstItem) return "";

    if (typeof firstItem === "string") {
        return firstItem.trim();
    }

    return String(firstItem.file_name || firstItem.fileName || firstItem.name || "").trim();
}

function normalizeLogoValue(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        const raw = value.trim();
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [raw];
        }
    }

    if (typeof value === "object") {
        return [value];
    }

    return [];
}

window.addEventListener("focus", () => {
    syncHeaderCartCount();
    initializeUserInfo();
});

document.addEventListener("cart:updated", () => {
    syncHeaderCartCount();
});
