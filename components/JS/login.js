import { authenticateUser, getPostAuthRedirect } from "./auth_logic.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const passwordField = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");

    const popup = document.getElementById("errorPopup");
    const popupMsg = document.getElementById("popupMessage");
    const redirectTarget = new URLSearchParams(window.location.search).get("redirect");

    function showPopup(msg, type = "error") {
        popup.className = type === "success" ? "popup-success" : "popup-error";
        popupMsg.textContent = msg;
        popup.style.display = "flex";
        setTimeout(() => popup.style.display = "none", 2000);
    }

    eyeIcon.onclick = () => {
        const isHidden = passwordField.type === "password";
        passwordField.type = isHidden ? "text" : "password";
        eyeIcon.classList.toggle("fa-eye", isHidden);
        eyeIcon.classList.toggle("fa-eye-slash", !isHidden);
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const input = document.getElementById("loginInput").value.trim();
        const password = passwordField.value.trim();

        try {
            const result = await authenticateUser({ input, password });

            if (!result.ok) return showPopup(result.message);

            const { user } = result;

            showPopup("Login Successful", "success");

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
                    window.location.href = getPostAuthRedirect(redirectTarget);
                } else if (adminRoles.includes(role)) {
                    window.location.href = "admin/select-mode.html";
                } else {
                    window.location.href = getPostAuthRedirect(redirectTarget);
                }
            }, 1000);
        } catch (err) {
            console.error(err);
            showPopup("Error occurred");
        }
    });
});
