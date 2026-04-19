import {
    resetUserPassword,
    sendPasswordResetOtp,
    verifyPasswordResetOtp
} from "./auth_logic.js";

document.addEventListener("DOMContentLoaded", () => {
    const forgotPasswordSection = document.getElementById("forgotPasswordSection");
    const resetOtpSection = document.getElementById("resetOtpSection");
    const resetPasswordSection = document.getElementById("resetPasswordSection");
    const resetOtpEmailPreview = document.getElementById("resetOtpEmailPreview");
    const popup = document.getElementById("errorPopup");
    const popupMsg = document.getElementById("popupMessage");

    let pendingResetEmail = "";
    let resetOtpVerified = false;

    setupPasswordToggle("resetNewPassword", "resetPasswordEyeIcon");
    setupPasswordToggle("resetConfirmPassword", "resetConfirmPasswordEyeIcon");

    function showPopup(msg, type = "error") {
        popup.className = type === "success" ? "popup-success" : "popup-error";
        popupMsg.textContent = msg;
        popup.style.display = "flex";
        setTimeout(() => popup.style.display = "none", 2500);
    }

    document.getElementById("sendResetOtpBtn")?.addEventListener("click", async () => {
        const resetEmail = document.getElementById("resetEmail")?.value?.trim().toLowerCase() || "";
        const button = document.getElementById("sendResetOtpBtn");

        button.disabled = true;
        button.textContent = "Sending...";

        const result = await sendPasswordResetOtp(resetEmail);

        if (!result.ok) {
            showPopup(result.message);
            button.disabled = false;
            button.textContent = "Send OTP";
            return;
        }

        pendingResetEmail = resetEmail;
        resetOtpVerified = false;
        resetOtpEmailPreview.textContent = resetEmail;
        resetOtpSection.style.display = "block";
        resetPasswordSection.style.display = "none";
        resetOtpSection.scrollIntoView({ behavior: "smooth", block: "center" });
        showPopup("OTP sent to your email", "success");

        button.disabled = false;
        button.textContent = "Send OTP";
    });

    document.getElementById("verifyResetOtpBtn")?.addEventListener("click", async () => {
        if (!pendingResetEmail) {
            showPopup("Send OTP first");
            return;
        }

        const otp = document.getElementById("resetOtpCode")?.value?.trim() || "";
        const button = document.getElementById("verifyResetOtpBtn");

        if (!otp) {
            showPopup("Enter the OTP sent to your email");
            return;
        }

        button.disabled = true;
        button.textContent = "Verifying...";

        const result = await verifyPasswordResetOtp({
            email: pendingResetEmail,
            token: otp
        });

        if (!result.ok) {
            showPopup(result.message);
            button.disabled = false;
            button.textContent = "Verify OTP";
            return;
        }

        resetOtpVerified = true;
        resetPasswordSection.style.display = "block";
        resetPasswordSection.scrollIntoView({ behavior: "smooth", block: "center" });
        showPopup("OTP verified. Set your new password.", "success");

        button.disabled = false;
        button.textContent = "Verify OTP";
    });

    document.getElementById("resendResetOtpBtn")?.addEventListener("click", async () => {
        if (!pendingResetEmail) {
            showPopup("Enter your registered email first");
            return;
        }

        const button = document.getElementById("resendResetOtpBtn");
        button.disabled = true;
        button.textContent = "Sending...";

        const result = await sendPasswordResetOtp(pendingResetEmail);
        showPopup(result.ok ? "A new OTP was sent to your email." : result.message, result.ok ? "success" : "error");

        button.disabled = false;
        button.textContent = "Resend OTP";
    });

    document.getElementById("completeResetBtn")?.addEventListener("click", async () => {
        if (!pendingResetEmail || !resetOtpVerified) {
            showPopup("Verify your OTP first");
            return;
        }

        const password = document.getElementById("resetNewPassword")?.value?.trim() || "";
        const confirmPassword = document.getElementById("resetConfirmPassword")?.value?.trim() || "";
        const button = document.getElementById("completeResetBtn");

        button.disabled = true;
        button.textContent = "Updating...";

        const result = await resetUserPassword({
            email: pendingResetEmail,
            password,
            confirmPassword
        });

        if (!result.ok) {
            showPopup(result.message);
            button.disabled = false;
            button.textContent = "Update Password";
            return;
        }

        showPopup("Password updated successfully. Sign in with your new password.", "success");
        button.disabled = false;
        button.textContent = "Update Password";

        setTimeout(() => {
            window.location.href = "signin.html";
        }, 1000);
    });
});

function setupPasswordToggle(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (!input || !icon) return;

    icon.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        icon.classList.toggle("fa-eye", isHidden);
        icon.classList.toggle("fa-eye-slash", !isHidden);
    });
}
