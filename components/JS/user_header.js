// components/JS/user_header.js

import { supabase } from "./config.js";

// 🔥 MAIN INIT (no dependency on event timing)
waitForHeader();

function waitForHeader() {
  const userName = document.getElementById("userName");

  if (userName) {
    console.log("✅ Header detected → initializing user info");
    initializeUserInfo();
  } else {
    // Retry until header is injected
    setTimeout(waitForHeader, 50);
  }
}

async function initializeUserInfo() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));

    // 🚨 If no user → redirect
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    // ✅ Set user details (safe checks)
    const userNameEl = document.getElementById("userName");
    const userEmailEl = document.getElementById("userEmail");
    const userIdEl = document.getElementById("userId");

    if (userNameEl) userNameEl.textContent = user.name || "N/A";
    if (userEmailEl) userEmailEl.textContent = user.email || "N/A";
    if (userIdEl) userIdEl.textContent = user.id || "N/A";

    // ✅ Department / External label
    const deptSpan = document.getElementById("userDept");
    if (deptSpan) {
      const deptContainer = deptSpan.parentElement;

      if (user.user_type === "external") {
        deptContainer.textContent = "External User";
      } else {
        deptSpan.textContent = user.department || "N/A";
      }
    }

    // ✅ Cart count from Supabase
    try {
      const { data, error } = await supabase
        .from("cart")
        .select("cart_items")
        .eq("user_email", user.email)
        .maybeSingle();

      if (error) throw error;

      let cartCount = 0;

      if (data?.cart_items) {
        cartCount = Object.values(data.cart_items)
          .reduce((sum, val) => sum + val, 0);
      }

      const cartCountEl = document.getElementById("cartCount");
      if (cartCountEl) {
        cartCountEl.textContent = `(${cartCount})`;
      }

    } catch (err) {
      console.error("❌ Cart error:", err);

      const cartCountEl = document.getElementById("cartCount");
      if (cartCountEl) cartCountEl.textContent = "(0)";
    }

    // ✅ Profile toggle
    const userBtn = document.getElementById("user-btn");
    const profile = document.getElementById("profileBox");

    if (userBtn && profile) {
      userBtn.addEventListener("click", () => {
        profile.classList.toggle("active");
      });
    }

    // ✅ Mobile menu toggle
    const menuBtn = document.getElementById("menu-btn");
    const navbar = document.querySelector(".navbar");

    if (menuBtn && navbar) {
      menuBtn.addEventListener("click", () => {
        navbar.classList.toggle("active");
      });
    }

    // ✅ Logout
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("user");
        window.location.href = "index.html";
      });
    }

  } catch (err) {
    console.error("❌ Initialization error:", err);
  }
}