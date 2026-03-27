// admin/js/admin.js

// ✅ LOCAL IMPORTS
import { protectPage } from "./guard.js";
import { applyUIRules } from "./ui.js";
import { logout, getUser } from "./auth.js";
import { loadPowers } from "./rbac.js";

// ✅ CONFIG (OUTSIDE FOLDER)
import { supabase } from "../../components/JS/config.js";


// 🔐 Page protection
protectPage({ adminOnly: true });

// 🚫 Prevent back navigation after logout
window.history.pushState(null, "", window.location.href);
window.onpopstate = function () {
    window.location.href = "../index.html";
};

document.addEventListener("DOMContentLoaded", async () => {

    try {

        // ===============================
        // 1️⃣ LOAD RBAC
        // ===============================
        await loadPowers();

        // ===============================
        // 2️⃣ APPLY UI
        // ===============================
        applyUIRules();

        // ===============================
        // 3️⃣ USER INFO
        // ===============================
        const storedUser = getUser();

        if (!storedUser?.id) {
            window.location.href = "../index.html"; // ✅ FIXED
            return;
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("name, email")
            .eq("id", storedUser.id)
            .single();

        if (error) {
            console.error("User fetch error:", error);
            return;
        }

        if (user) {
            const nameEl = document.getElementById("userName");
            const emailEl = document.getElementById("userEmail");

            if (nameEl) nameEl.textContent = user.name || "";
            if (emailEl) emailEl.textContent = user.email || "";
        }

    } catch (err) {
        console.error("Admin init error:", err);
    }

});


// ===============================
// 🌐 GLOBAL FUNCTIONS
// ===============================
window.logout = logout;

window.addProduct = function () {
    alert("Product Added");
};