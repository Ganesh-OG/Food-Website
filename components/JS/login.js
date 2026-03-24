// components/JS/login.js

import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");
    const passwordField = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");
    const formBox = document.getElementById("formBox");

    const popup = document.getElementById("errorPopup");
    const popupMsg = document.getElementById("popupMessage");
    const closeBtn = document.getElementById("closeBtn");

    // ================= POPUP =================
    function showPopup(message, type = "error") {
        popup.classList.remove("popup-error", "popup-success");

        if (type === "success") {
            popup.classList.add("popup-success");
        } else {
            popup.classList.add("popup-error");
        }

        popupMsg.textContent = message;
        popup.style.display = "flex";

        // prevent overlap issues
        clearTimeout(popup.hideTimer);

        popup.hideTimer = setTimeout(() => {
            popup.style.display = "none";
        }, 2000);
    }

    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
    });

    // ================= EYE TOGGLE =================
    eyeIcon.addEventListener("click", () => {
        if (passwordField.type === "password") {
            passwordField.type = "text";
            eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
        } else {
            passwordField.type = "password";
            eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
        }
    });

    // ================= LOGIN =================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const input = document.getElementById("loginInput").value.trim();
        const password = passwordField.value.trim();

        try {
            let user = null;

            let { data, error } = await supabase
                .from("users")
                .select("*")
                .ilike("email", input)
                .eq("password", password)
                .maybeSingle();

            if (error) throw error;
            user = data;

            if (!user) {
                const res = await supabase
                    .from("users")
                    .select("*")
                    .ilike("id", input)
                    .eq("password", password)
                    .maybeSingle();

                if (res.error) throw res.error;
                user = res.data;
            }

            if (!user) {
                showPopup("Invalid Username or Password");

                formBox.classList.add("shake");
                setTimeout(() => formBox.classList.remove("shake"), 300);
                return;
            }

            localStorage.setItem("user", JSON.stringify(user));

            showPopup("Login Successful", "success");

            setTimeout(() => {
                if (user.role === "student") {
                    window.location.href = "home.html";
                } else if (user.role === "admin") {
                    window.location.href = "admin/orders.html";
                }
            }, 1200);

        } catch (err) {
            console.error(err);
            showPopup("Something went wrong!");
        }
    });

});