import {
    getPostAuthRedirect,
    registerExternalUser,
    sendRegistrationOtp,
    verifyRegistrationOtp
} from "./auth_logic.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const popup = document.getElementById("errorPopup");
    const popupMsg = document.getElementById("popupMessage");
    const redirectTarget = new URLSearchParams(window.location.search).get("redirect");
    const otpSection = document.getElementById("otpSection");
    const passwordSection = document.getElementById("passwordSection");
    const otpEmailPreview = document.getElementById("otpEmailPreview");
    const otpInput = document.getElementById("otpCode");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const resendOtpBtn = document.getElementById("resendOtpBtn");
    const completeRegistrationBtn = document.getElementById("completeRegistrationBtn");

    let pendingRegistration = null;
    let emailVerified = false;

    setupPasswordToggle("password", "passwordEyeIcon");
    setupPasswordToggle("confirmPassword", "confirmPasswordEyeIcon");

    document.getElementById("closeBtn")?.addEventListener("click", () => {
        popup.style.display = "none";
    });

    function showPopup(message, type = "error") {
        popup.className = type === "success" ? "popup-success" : "popup-error";
        popupMsg.textContent = message;
        popup.style.display = "flex";
        setTimeout(() => {
            popup.style.display = "none";
        }, 2500);
    }

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const dob = document.getElementById("dob").value || null;

        pendingRegistration = {
            name,
            email,
            dob
        };
        emailVerified = false;

        try {
            const sendResult = await sendRegistrationOtp({
                name,
                email,
                dob
            });

            if (!sendResult.ok) {
                showPopup(sendResult.message);
                return;
            }

            if (otpEmailPreview) otpEmailPreview.textContent = email;
            if (otpSection) otpSection.style.display = "block";
            if (passwordSection) passwordSection.style.display = "none";
            verifyOtpBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
            showPopup("OTP sent to your email", "success");
        } catch (error) {
            console.error("Send OTP failed:", error);
            showPopup("Unable to send OTP right now");
        }
    });

    verifyOtpBtn?.addEventListener("click", async () => {
        if (!pendingRegistration) {
            showPopup("Fill the register form first");
            return;
        }

        const otp = otpInput?.value.trim();
        if (!otp) {
            showPopup("Enter the OTP sent to your email");
            return;
        }

        verifyOtpBtn.disabled = true;
        verifyOtpBtn.textContent = "Verifying...";

        try {
            const verifyResult = await verifyRegistrationOtp({
                email: pendingRegistration.email,
                token: otp
            });

            if (!verifyResult.ok) {
                showPopup(verifyResult.message);
                return;
            }

            emailVerified = true;
            if (passwordSection) passwordSection.style.display = "block";
            passwordSection?.scrollIntoView({ behavior: "smooth", block: "center" });
            showPopup("OTP verified. Set your password to complete registration.", "success");
        } catch (error) {
            console.error("OTP registration failed:", error);
            showPopup("Something went wrong while verifying OTP");
        } finally {
            verifyOtpBtn.disabled = false;
            verifyOtpBtn.textContent = "Verify OTP";
        }
    });

    resendOtpBtn?.addEventListener("click", async () => {
        if (!pendingRegistration?.email) {
            showPopup("Fill the register form first");
            return;
        }

        resendOtpBtn.disabled = true;
        resendOtpBtn.textContent = "Sending...";

        try {
            const result = await sendRegistrationOtp(pendingRegistration);
            showPopup(
                result.ok ? "A new OTP was sent to your email." : result.message,
                result.ok ? "success" : "error"
            );
        } catch (error) {
            console.error("Resend OTP failed:", error);
            showPopup("Unable to resend OTP right now");
        } finally {
            resendOtpBtn.disabled = false;
            resendOtpBtn.textContent = "Resend OTP";
        }
    });

    completeRegistrationBtn?.addEventListener("click", async () => {
        if (!pendingRegistration || !emailVerified) {
            showPopup("Verify your OTP first");
            return;
        }

        const password = document.getElementById("password").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();

        completeRegistrationBtn.disabled = true;
        completeRegistrationBtn.textContent = "Creating Account...";

        try {
            const result = await registerExternalUser({
                ...pendingRegistration,
                password,
                confirmPassword
            });

            if (!result.ok) {
                showPopup(result.message);
                return;
            }

            showPopup(`Registration successful. Your ID is ${result.generatedId}`, "success");

            setTimeout(() => {
                window.location.href = getPostAuthRedirect(redirectTarget);
            }, 1200);
        } catch (error) {
            console.error("Register failed:", error);
            showPopup("Something went wrong while creating your account");
        } finally {
            completeRegistrationBtn.disabled = false;
            completeRegistrationBtn.textContent = "Create Account";
        }
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
