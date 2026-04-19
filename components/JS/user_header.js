// components/JS/user_header.js

import { supabase } from "./config.js";
import { getCurrentUser, getCartCount, loadStoredCart } from "./cart_store.js";

let headerPoller = null;

startHeaderInit();

function startHeaderInit() {
  const init = () => {
    if (headerPoller) {
      clearInterval(headerPoller);
      headerPoller = null;
    }

    headerPoller = setInterval(() => {
      const userName = document.getElementById("userName");
      const cartCount = document.getElementById("cartCount");

      if (!userName || !cartCount) return;

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
  } catch (err) {
    console.error("❌ Header cart sync error:", err);
    cartCountEl.textContent = "(0)";
  }
}

async function initializeUserInfo() {
  try {
    const user = getCurrentUser();
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

    if (!user) {
      await syncHeaderCartCount();

      if (profile) {
        profile.innerHTML = `
          <p class="name">Guest User</p>
          <p>Browse everything freely and sign in when you're ready to checkout.</p>
          <div class="flex">
            <a href="signin.html" class="btn">sign in</a>
            <a href="register.html" class="delete-btn">register</a>
          </div>
        `;
      }

      return;
    }

    const userNameEl = document.getElementById("userName");
    const userEmailEl = document.getElementById("userEmail");
    const userIdEl = document.getElementById("userId");

    if (userNameEl) userNameEl.textContent = user.name || "N/A";
    if (userEmailEl) userEmailEl.textContent = user.email || "N/A";
    if (userIdEl) userIdEl.textContent = user.id || "N/A";

    const deptSpan = document.getElementById("userDept");
    if (deptSpan) {
      const deptContainer = deptSpan.parentElement;

      if (user.user_type === "external") {
        deptContainer.textContent = "External User";
      } else {
        deptSpan.textContent = user.department || "N/A";
      }
    }

    await syncHeaderCartCount();

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "true";
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("user");
        localStorage.removeItem("powers");
        window.location.href = "index.html";
      });
    }
  } catch (err) {
    console.error("❌ Initialization error:", err);
  }
}

window.addEventListener("focus", () => {
  syncHeaderCartCount();
});

document.addEventListener("cart:updated", () => {
  syncHeaderCartCount();
});
