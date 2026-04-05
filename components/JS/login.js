// components/JS/login.js
import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");
    const passwordField = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");

    const popup = document.getElementById("errorPopup");
    const popupMsg = document.getElementById("popupMessage");

    function showPopup(msg, type = "error") {
        popup.className = type === "success" ? "popup-success" : "popup-error";
        popupMsg.textContent = msg;
        popup.style.display = "flex";
        setTimeout(() => popup.style.display = "none", 2000);
    }

    eyeIcon.onclick = () => {
        passwordField.type =
            passwordField.type === "password" ? "text" : "password";
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const input = document.getElementById("loginInput").value.trim();
        const password = passwordField.value.trim();

        try {
            let user = null;

            // Email login
            let res = await supabase
                .from("users")
                .select("*")
                .ilike("email", input)
                .eq("password", password)
                .maybeSingle();

            user = res.data;

            // ID login
            if (!user) {
                res = await supabase
                    .from("users")
                    .select("*")
                    .ilike("id", input)
                    .eq("password", password)
                    .maybeSingle();

                user = res.data;
            }

            if (!user) return showPopup("Invalid login");

            // ================= RBAC =================
            const { data: roleData } = await supabase
                .from("roles")
                .select("role_powers")
                .eq("role_name", user.role)
                .single();

            const rolePowers = roleData?.role_powers || [];
            const userPowers = user.additional_powers || [];

            let finalPowers;

            if (user.role === "Custom Role") {
                finalPowers = userPowers;
            } else {
                finalPowers = [...new Set([...rolePowers, ...userPowers])];
            }

            // Store
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.setItem("powers", JSON.stringify(finalPowers));

            showPopup("Login Successful", "success");

            // ================= ROUTING =================
            setTimeout(() => {
                const role = user.role?.toLowerCase();
                const type = user.user_type?.toLowerCase();

                const adminRoles = [
                    "admin",
                    "manager",
                    "sales staff",
                    "billing staff",
                    "custom role"
                ];

                if (type === "external" || role === "student") {
                    window.location.href = "home.html";
                } else if (adminRoles.includes(role)) {
                    window.location.href = "admin/select-mode.html";;
                } else {
                    window.location.href = "home.html";
                }

            }, 1000);

        } catch (err) {
            console.error(err);
            showPopup("Error occurred");
        }
    });
});