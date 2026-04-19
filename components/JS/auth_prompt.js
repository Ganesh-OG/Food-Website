import { loadAuthBoxMarkup, preloadAuthBoxMarkup } from "./auth_markup.js";
import {
    authenticateUser,
    getPostAuthRedirect,
    registerExternalUser,
    resetUserPassword,
    sendRegistrationOtp,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    verifyRegistrationOtp
} from "./auth_logic.js";

let authPromptStylesAdded = false;
let promptPendingRegistration = null;
let promptEmailVerified = false;
let promptPendingPasswordResetEmail = null;
let promptPasswordResetVerified = false;
let authMarkupPreloaded = false;

function ensureStyles() {
    if (authPromptStylesAdded) return;

    const style = document.createElement("style");
    style.textContent = `
        .auth-prompt-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            z-index: 10000;
        }

        .auth-prompt-shell {
            width: min(560px, 100%);
            max-height: calc(100vh - 3rem);
            overflow: auto;
            position: relative;
        }

        .auth-prompt-shell,
        .auth-prompt-shell *,
        .auth-prompt-shell .register-grid,
        .auth-prompt-shell .register-grid * {
            box-sizing: border-box;
        }

        .auth-prompt-close {
            position: absolute;
            top: 1.2rem;
            right: 1.2rem;
            width: 4.2rem;
            height: 4.2rem;
            min-width: 4.2rem;
            min-height: 4.2rem;
            border: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.92);
            color: #333;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            padding: 0;
            font-size: 2.4rem;
            z-index: 2;
        }

        .auth-prompt-shell .login-container {
            min-height: auto;
            background: transparent;
            padding: 0;
        }

        .auth-prompt-shell .login-box {
            max-width: none;
            width: 100%;
            margin: 0;
            background: rgba(255, 255, 255, 0.74);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            padding: 2.2rem;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.55);
            box-shadow: 0 24px 60px rgba(15, 15, 16, 0.22);
            text-align: center;
        }

        .auth-prompt-shell .login-logo {
            display: block;
            width: 8rem;
            height: 8rem;
            max-width: 8rem;
            max-height: 8rem;
            object-fit: contain;
            margin: 0 auto 1rem;
        }

        .auth-prompt-shell .login-box h2 {
            color: #101112;
            margin-bottom: 1.2rem;
            font-size: 2.2rem;
        }

        .auth-prompt-shell .login-subtitle {
            color: rgba(17, 17, 17, 0.72);
            margin-bottom: 1.5rem;
            font-size: 1.45rem;
            line-height: 1.5;
        }

        .auth-prompt-shell .form-group {
            margin-bottom: 1.2rem;
            position: relative;
        }

        .auth-prompt-shell .form-group input {
            width: 100%;
            display: block;
            padding: 12px 45px 12px 15px;
            border: 1px solid rgba(17, 17, 17, 0.12);
            border-radius: 14px;
            font-size: 1.5rem;
            background: rgba(255, 255, 255, 0.86);
            color: #111;
        }

        .auth-prompt-shell .form-group input:focus {
            outline: none;
            border-color: rgba(17, 17, 17, 0.34);
            box-shadow: 0 0 0 4px rgba(17, 17, 17, 0.07);
        }

        .auth-prompt-shell #eyeIcon,
        .auth-prompt-shell #passwordEyeIcon,
        .auth-prompt-shell #confirmPasswordEyeIcon,
        .auth-prompt-shell #resetPasswordEyeIcon,
        .auth-prompt-shell #resetConfirmPasswordEyeIcon {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            color: #666;
            font-size: 2.2rem;
            width: 2.4rem;
            height: 2.4rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }

        .auth-prompt-shell .btn-login {
            background: #111214;
            color: #fff;
            padding: 12px 30px;
            border: none;
            border-radius: 14px;
            font-size: 1.6rem;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 1rem;
        }

        .auth-prompt-shell .btn-login:hover {
            background: #2b2d31;
            box-shadow: 0 12px 28px rgba(17, 18, 20, 0.2);
        }

        .auth-prompt-shell .btn-login[disabled] {
            opacity: 0.7;
            cursor: wait;
        }

        .auth-prompt-shell .register-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.2rem;
        }

        .auth-prompt-shell .register-grid .full-width {
            grid-column: 1 / -1;
        }

        .auth-prompt-shell .field-note,
        .auth-prompt-shell .helper-text {
            color: rgba(17, 17, 17, 0.68);
        }

        .auth-prompt-shell .field-note {
            display: block;
            margin-top: 0.6rem;
            font-size: 1.2rem;
            text-align: left;
        }

        .auth-prompt-shell .helper-text {
            margin-top: 1rem;
            font-size: 1.3rem;
            line-height: 1.5;
            text-align: center;
        }

        .auth-prompt-status {
            display: none;
            margin: 0 0 1.2rem;
            padding: 1rem 1.1rem;
            border-radius: 10px;
            text-align: center;
            font-size: 1.35rem;
            line-height: 1.5;
        }

        .auth-prompt-status.show {
            display: block;
        }

        .auth-prompt-status.error {
            background: #f8d7da;
            color: #721c24;
            border-left: 5px solid #dc3545;
        }

        .auth-prompt-status.success {
            background: #d4edda;
            color: #155724;
            border-left: 5px solid #28a745;
        }

        .auth-prompt-continue {
            border: 1px solid #d0d5dd;
        }

        .auth-prompt-shell .guest-links-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 1.5rem;
        }

        .auth-prompt-shell .guest-link-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 0;
            width: auto;
            padding: 1rem 1.6rem;
            border-radius: 8px;
            font-size: 1.45rem;
            font-weight: 600;
            text-decoration: none;
        }

        .auth-prompt-shell .guest-links-actions {
            align-items: stretch;
        }

        .auth-prompt-shell .guest-links-actions .guest-link-btn {
            flex: 1 1 0;
            width: 100%;
            max-width: none;
        }

        .auth-prompt-shell .guest-link-btn.primary {
            background: #111214;
            color: #fff;
            border: 1px solid #111214;
        }

        .auth-prompt-shell .guest-link-btn.primary:hover {
            background: #2b2d31;
            border-color: #2b2d31;
        }

        .auth-prompt-shell .guest-link-btn.secondary {
            background: rgba(255, 255, 255, 0.65);
            color: #222;
            border: 1px solid #d0d5dd;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }

        .auth-prompt-shell .guest-link-btn.secondary:hover {
            background: rgba(255, 255, 255, 0.82);
        }

        @media (max-width: 640px) {
            .auth-prompt-shell .login-box {
                padding: 1.6rem;
            }

            .auth-prompt-shell .register-grid {
                grid-template-columns: 1fr;
            }

            .auth-prompt-shell .guest-link-btn {
                width: 100%;
                min-width: 0;
            }
        }
    `;

    document.head.appendChild(style);
    authPromptStylesAdded = true;
}

function getRedirectTarget() {
    return `${window.location.pathname.split("/").pop() || "index.html"}${window.location.search}`;
}

function showStatus(message, type = "error") {
    const statusEl = document.getElementById("authPromptStatus");
    if (!statusEl) return;

    statusEl.className = `auth-prompt-status show ${type}`;
    statusEl.textContent = message;
}

function clearStatus() {
    const statusEl = document.getElementById("authPromptStatus");
    if (!statusEl) return;

    statusEl.className = "auth-prompt-status";
    statusEl.textContent = "";
}

function placeStatusAtTop() {
    const statusEl = document.getElementById("authPromptStatus");
    const box = document.querySelector("#authPromptContent .login-box");
    if (!statusEl || !box) return;

    const heading = box.querySelector("h2");
    if (heading) {
        heading.insertAdjacentElement("afterend", statusEl);
        return;
    }

    box.prepend(statusEl);
}

function closePrompt() {
    document.getElementById("authPromptOverlay")?.remove();
}

function swapMode(mode, options) {
    renderPrompt(options, mode);
}

function normalizeLoginMarkup(markup, options) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = markup;

    const box = wrapper.querySelector(".login-box");
    if (!box) return markup;

    const subtitle = box.querySelector(".login-subtitle");
    if (subtitle && !options.preserveSourceCopy) {
        subtitle.textContent = options.message;
    }

    const existingStatus = box.querySelector("#authPromptStatus");
    if (!existingStatus) {
        const guestLabel = box.querySelector(".guest-links-label");
        if (guestLabel) {
            guestLabel.insertAdjacentHTML("beforebegin", `<p id="authPromptStatus" class="auth-prompt-status"></p>`);
        } else {
            box.insertAdjacentHTML("beforeend", `<p id="authPromptStatus" class="auth-prompt-status"></p>`);
        }
    }

    const guestLinks = box.querySelector(".guest-links");
    const guestLabel = box.querySelector(".guest-links-label");
    if (guestLabel) {
        guestLabel.textContent = "External or new user?";
    }

    if (guestLinks) {
        guestLinks.classList.add("guest-links-actions", "auth-prompt-login-actions");

        const [primaryLink, secondaryLink, tertiaryLink] = guestLinks.querySelectorAll(".guest-link-btn");

        if (primaryLink) {
            primaryLink.id = "authPromptSwitchRegister";
            primaryLink.setAttribute("href", "#");
            primaryLink.textContent = "Register";
        }

        if (secondaryLink) {
            const forgotButton = document.createElement("button");
            forgotButton.type = "button";
            forgotButton.id = "authPromptForgotPassword";
            forgotButton.className = secondaryLink.className;
            forgotButton.textContent = "Forgot Password";
            secondaryLink.replaceWith(forgotButton);
        }

        if (tertiaryLink) {
            const continueButton = document.createElement("button");
            continueButton.type = "button";
            continueButton.id = "authPromptContinue";
            continueButton.className = tertiaryLink.className;
            continueButton.classList.add("auth-prompt-continue");
            continueButton.textContent = "Continue Shopping";
            tertiaryLink.replaceWith(continueButton);
        }
    }

    return box.outerHTML;
}

function normalizeRegisterMarkup(markup, options) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = markup;

    const box = wrapper.querySelector(".login-box");
    if (!box) return markup;

    const subtitle = box.querySelector(".login-subtitle");
    if (subtitle && !options.preserveSourceCopy) {
        subtitle.textContent = options.message;
    }

    const departmentField = box.querySelector("#department")?.closest(".form-group");
    if (departmentField) {
        departmentField.remove();
    }

    const existingStatus = box.querySelector("#authPromptStatus");
    if (!existingStatus) {
        const guestLabel = box.querySelector(".guest-links-label");
        if (guestLabel) {
            guestLabel.insertAdjacentHTML("beforebegin", `<p id="authPromptStatus" class="auth-prompt-status"></p>`);
        } else {
            box.insertAdjacentHTML("beforeend", `<p id="authPromptStatus" class="auth-prompt-status"></p>`);
        }
    }

    const guestLinks = box.querySelector(".guest-links");
    const guestLabel = box.querySelector(".guest-links-label");
    if (guestLabel) {
        guestLabel.textContent = "Already registered?";
    }

    if (guestLinks) {
        guestLinks.classList.add("guest-links-actions", "auth-prompt-register-actions");

        const [primaryLink, secondaryLink] = guestLinks.querySelectorAll(".guest-link-btn");

        if (primaryLink) {
            primaryLink.id = "authPromptSwitchLogin";
            primaryLink.setAttribute("href", "#");
            primaryLink.textContent = "Login";
        }

        if (secondaryLink) {
            const continueButton = document.createElement("button");
            continueButton.type = "button";
            continueButton.id = "authPromptContinue";
            continueButton.className = secondaryLink.className;
            continueButton.classList.add("auth-prompt-continue");
            continueButton.textContent = "Continue Shopping";
            secondaryLink.replaceWith(continueButton);
        }
    }

    return box.outerHTML;
}

function normalizeForgotMarkup(markup, options) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = markup;

    const box = wrapper.querySelector(".login-box");
    if (!box) return markup;

    const subtitle = box.querySelector(".login-subtitle");
    if (subtitle && !options.preserveSourceCopy) {
        subtitle.textContent = options.message || subtitle.textContent;
    }

    const existingStatus = box.querySelector("#authPromptStatus");
    if (!existingStatus) {
        const guestLabel = box.querySelector(".guest-links-label");
        if (guestLabel) {
            guestLabel.insertAdjacentHTML("beforebegin", `<p id="authPromptStatus" class="auth-prompt-status"></p>`);
        } else {
            box.insertAdjacentHTML("beforeend", `<p id="authPromptStatus" class="auth-prompt-status"></p>`);
        }
    }

    const guestLinks = box.querySelector(".guest-links");
    const guestLabel = box.querySelector(".guest-links-label");
    if (guestLabel) {
        guestLabel.textContent = "External or new user?";
    }

    if (guestLinks) {
        guestLinks.classList.add("guest-links-actions", "auth-prompt-forgot-actions");

        const [primaryLink, secondaryLink, tertiaryLink] = guestLinks.querySelectorAll(".guest-link-btn");

        if (primaryLink) {
            primaryLink.id = "authPromptSwitchLogin";
            primaryLink.setAttribute("href", "#");
            primaryLink.textContent = "Login";
        }

        if (secondaryLink) {
            secondaryLink.id = "authPromptSwitchRegister";
            secondaryLink.setAttribute("href", "#");
            secondaryLink.textContent = "Register";
        }

        if (tertiaryLink) {
            const continueButton = document.createElement("button");
            continueButton.type = "button";
            continueButton.id = "authPromptContinue";
            continueButton.className = tertiaryLink.className;
            continueButton.classList.add("auth-prompt-continue");
            continueButton.textContent = "Continue Shopping";
            tertiaryLink.replaceWith(continueButton);
        }
    }

    return box.outerHTML;
}

async function handleLoginSubmit(redirect) {
    const input = document.getElementById("loginInput")?.value || "";
    const password = document.getElementById("password")?.value || "";
    const button = document.querySelector("#loginForm .btn-login");

    if (button) {
        button.disabled = true;
        button.textContent = "Signing In...";
    }

    const result = await authenticateUser({ input, password });

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Login";
        }
        return;
    }

    showStatus("Login successful. Refreshing...", "success");

    setTimeout(() => {
        window.location.href = getPostAuthRedirect(redirect, getRedirectTarget());
    }, 800);
}

async function handleRegisterSubmit(redirect) {
    const name = document.getElementById("name")?.value || "";
    const email = document.getElementById("email")?.value || "";
    const dob = document.getElementById("dob")?.value || null;
    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";
    const button = document.querySelector("#registerForm .btn-login");

    if (button) {
        button.disabled = true;
        button.textContent = "Registering...";
    }

    const result = await registerExternalUser({
        name,
        email,
        dob,
        password,
        confirmPassword
    });

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Register";
        }
        return;
    }

    showStatus(`Registration successful. Your ID is ${result.generatedId}`, "success");

    setTimeout(() => {
        window.location.href = getPostAuthRedirect(redirect, getRedirectTarget());
    }, 1000);
}

async function handleRegisterOtpSend() {
    const form = document.getElementById("registerForm");
    const name = document.getElementById("name")?.value?.trim() || "";
    const email = document.getElementById("email")?.value?.trim().toLowerCase() || "";
    const dob = document.getElementById("dob")?.value || null;
    const button = document.querySelector("#registerForm .btn-login");

    if (form && !form.reportValidity()) {
        return;
    }

    promptPendingRegistration = {
        name,
        email,
        dob
    };
    promptEmailVerified = false;

    if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
    }

    const result = await sendRegistrationOtp({
        name,
        email,
        dob
    });

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Send OTP";
        }
        return;
    }

    document.getElementById("otpEmailPreview").textContent = email;
    document.getElementById("otpSection").style.display = "block";
    document.getElementById("passwordSection").style.display = "none";
    document.getElementById("verifyOtpBtn")?.scrollIntoView({ behavior: "smooth", block: "center" });
    showStatus("OTP sent to your email", "success");

    if (button) {
        button.disabled = false;
        button.textContent = "Send OTP";
    }
}

async function handleRegisterOtpVerify() {
    if (!promptPendingRegistration) {
        showStatus("Fill the register form first");
        return;
    }

    const otpInput = document.getElementById("otpCode");
    const otp = otpInput?.value?.trim() || "";
    const verifyButton = document.getElementById("verifyOtpBtn");

    if (!otp) {
        showStatus("Enter the OTP sent to your email");
        return;
    }

    if (verifyButton) {
        verifyButton.disabled = true;
        verifyButton.textContent = "Verifying...";
    }

    const result = await verifyRegistrationOtp({
        email: promptPendingRegistration.email,
        token: otp
    });

    if (!result.ok) {
        showStatus(result.message);
        if (verifyButton) {
            verifyButton.disabled = false;
            verifyButton.textContent = "Verify OTP";
        }
        return;
    }

    promptEmailVerified = true;
    document.getElementById("passwordSection").style.display = "block";
    document.getElementById("passwordSection")?.scrollIntoView({ behavior: "smooth", block: "center" });
    showStatus("OTP verified. Set your password to complete registration.", "success");

    if (verifyButton) {
        verifyButton.disabled = false;
        verifyButton.textContent = "Verify OTP";
    }
}

async function handleRegisterOtpResend() {
    if (!promptPendingRegistration?.email) {
        showStatus("Fill the register form first");
        return;
    }

    const resendButton = document.getElementById("resendOtpBtn");
    if (resendButton) {
        resendButton.disabled = true;
        resendButton.textContent = "Sending...";
    }

    const result = await sendRegistrationOtp(promptPendingRegistration);
    showStatus(
        result.ok ? "A new OTP was sent to your email." : result.message,
        result.ok ? "success" : "error"
    );

    if (resendButton) {
        resendButton.disabled = false;
        resendButton.textContent = "Resend OTP";
    }
}

async function handleRegisterComplete(redirect) {
    if (!promptPendingRegistration || !promptEmailVerified) {
        showStatus("Verify your OTP first");
        return;
    }

    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";
    const button = document.getElementById("completeRegistrationBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Creating Account...";
    }

    const result = await registerExternalUser({
        ...promptPendingRegistration,
        password,
        confirmPassword
    });

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Create Account";
        }
        return;
    }

    showStatus(`Registration successful. Your ID is ${result.generatedId}`, "success");

    setTimeout(() => {
        window.location.href = getPostAuthRedirect(redirect, getRedirectTarget());
    }, 1000);
}

async function handleForgotPasswordOtpSend() {
    const resetEmailField = document.getElementById("resetEmail");
    const email = resetEmailField?.value?.trim().toLowerCase() || "";
    const button = document.getElementById("sendResetOtpBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
    }

    const result = await sendPasswordResetOtp(email);

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Send OTP";
        }
        return;
    }

    promptPendingPasswordResetEmail = email;
    promptPasswordResetVerified = false;
    document.getElementById("resetOtpEmailPreview").textContent = email;
    document.getElementById("forgotPasswordSection").style.display = "block";
    document.getElementById("resetOtpSection").style.display = "block";
    document.getElementById("resetPasswordSection").style.display = "none";
    showStatus("OTP sent to your email", "success");

    if (button) {
        button.disabled = false;
        button.textContent = "Send OTP";
    }
}

async function handleForgotPasswordOtpVerify() {
    if (!promptPendingPasswordResetEmail) {
        showStatus("Send OTP first");
        return;
    }

    const otp = document.getElementById("resetOtpCode")?.value?.trim() || "";
    const button = document.getElementById("verifyResetOtpBtn");

    if (!otp) {
        showStatus("Enter the OTP sent to your email");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Verifying...";
    }

    const result = await verifyPasswordResetOtp({
        email: promptPendingPasswordResetEmail,
        token: otp
    });

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Verify OTP";
        }
        return;
    }

    promptPasswordResetVerified = true;
    document.getElementById("resetPasswordSection").style.display = "block";
    showStatus("OTP verified. Set your new password.", "success");

    if (button) {
        button.disabled = false;
        button.textContent = "Verify OTP";
    }
}

async function handleForgotPasswordOtpResend() {
    if (!promptPendingPasswordResetEmail) {
        showStatus("Enter your registered email first");
        return;
    }

    const button = document.getElementById("resendResetOtpBtn");
    if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
    }

    const result = await sendPasswordResetOtp(promptPendingPasswordResetEmail);
    showStatus(
        result.ok ? "A new OTP was sent to your email." : result.message,
        result.ok ? "success" : "error"
    );

    if (button) {
        button.disabled = false;
        button.textContent = "Resend OTP";
    }
}

async function handleForgotPasswordComplete() {
    if (!promptPendingPasswordResetEmail || !promptPasswordResetVerified) {
        showStatus("Verify your OTP first");
        return;
    }

    const password = document.getElementById("resetNewPassword")?.value || "";
    const confirmPassword = document.getElementById("resetConfirmPassword")?.value || "";
    const button = document.getElementById("completeResetBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Updating...";
    }

    const result = await resetUserPassword({
        email: promptPendingPasswordResetEmail,
        password,
        confirmPassword
    });

    if (!result.ok) {
        showStatus(result.message);
        if (button) {
            button.disabled = false;
            button.textContent = "Update Password";
        }
        return;
    }

    promptPendingPasswordResetEmail = null;
    promptPasswordResetVerified = false;
    let countdown = 5;
    if (button) {
        button.disabled = true;
        button.textContent = `Closing in ${countdown}s`;
    }

    showStatus(`Password updated successfully. Closing in ${countdown} seconds...`, "success");
    placeStatusAtTop();

    const countdownTimer = setInterval(() => {
        countdown -= 1;

        if (countdown <= 0) {
            clearInterval(countdownTimer);
            closePrompt();
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = `Closing in ${countdown}s`;
        }

        showStatus(`Password updated successfully. Closing in ${countdown} seconds...`, "success");
        placeStatusAtTop();
    }, 1000);
}

function bindCommonEvents(options, mode) {
    placeStatusAtTop();

    document.getElementById("authPromptClose")?.addEventListener("click", () => {
        closePrompt();
        if (options.closeRedirect) {
            window.location.href = options.closeRedirect;
        }
    });

    document.getElementById("authPromptOverlay")?.addEventListener("click", (event) => {
        if (event.target.id === "authPromptOverlay") {
            closePrompt();
            if (options.closeRedirect) {
                window.location.href = options.closeRedirect;
            }
        }
    });

    document.getElementById("authPromptContinue")?.addEventListener("click", () => {
        closePrompt();
        if (options.continueRedirect) {
            window.location.href = options.continueRedirect;
        }
    });

    if (mode === "login") {
        document.getElementById("authPromptSwitchRegister")?.addEventListener("click", (event) => {
            event.preventDefault();
            swapMode("register", options);
        });

        document.getElementById("authPromptForgotPassword")?.addEventListener("click", (event) => {
            event.preventDefault();
            swapMode("forgot", options);
        });

        document.getElementById("eyeIcon")?.addEventListener("click", () => {
            const input = document.getElementById("password");
            const icon = document.getElementById("eyeIcon");
            if (!input) return;
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            if (icon) {
                icon.classList.toggle("fa-eye", isHidden);
                icon.classList.toggle("fa-eye-slash", !isHidden);
            }
        });
        document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearStatus();
            await handleLoginSubmit(options.redirect);
        });
        return;
    }

    if (mode === "forgot") {
        document.getElementById("authPromptSwitchLogin")?.addEventListener("click", (event) => {
            event.preventDefault();
            swapMode("login", options);
        });

        document.getElementById("authPromptSwitchRegister")?.addEventListener("click", (event) => {
            event.preventDefault();
            swapMode("register", options);
        });

        document.getElementById("resetPasswordEyeIcon")?.addEventListener("click", () => {
            const input = document.getElementById("resetNewPassword");
            const icon = document.getElementById("resetPasswordEyeIcon");
            if (!input) return;
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            if (icon) {
                icon.classList.toggle("fa-eye", isHidden);
                icon.classList.toggle("fa-eye-slash", !isHidden);
            }
        });

        document.getElementById("resetConfirmPasswordEyeIcon")?.addEventListener("click", () => {
            const input = document.getElementById("resetConfirmPassword");
            const icon = document.getElementById("resetConfirmPasswordEyeIcon");
            if (!input) return;
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            if (icon) {
                icon.classList.toggle("fa-eye", isHidden);
                icon.classList.toggle("fa-eye-slash", !isHidden);
            }
        });

        document.getElementById("sendResetOtpBtn")?.addEventListener("click", async () => {
            clearStatus();
            await handleForgotPasswordOtpSend();
        });

        document.getElementById("verifyResetOtpBtn")?.addEventListener("click", async () => {
            clearStatus();
            await handleForgotPasswordOtpVerify();
        });

        document.getElementById("resendResetOtpBtn")?.addEventListener("click", async () => {
            clearStatus();
            await handleForgotPasswordOtpResend();
        });

        document.getElementById("completeResetBtn")?.addEventListener("click", async () => {
            clearStatus();
            await handleForgotPasswordComplete();
        });
        return;
    }

    document.getElementById("authPromptSwitchLogin")?.addEventListener("click", (event) => {
        event.preventDefault();
        swapMode("login", options);
    });

    document.getElementById("passwordEyeIcon")?.addEventListener("click", () => {
        const input = document.getElementById("password");
        const icon = document.getElementById("passwordEyeIcon");
        if (!input) return;
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        if (icon) {
            icon.classList.toggle("fa-eye", isHidden);
            icon.classList.toggle("fa-eye-slash", !isHidden);
        }
    });

    document.getElementById("confirmPasswordEyeIcon")?.addEventListener("click", () => {
        const input = document.getElementById("confirmPassword");
        const icon = document.getElementById("confirmPasswordEyeIcon");
        if (!input) return;
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        if (icon) {
            icon.classList.toggle("fa-eye", isHidden);
            icon.classList.toggle("fa-eye-slash", !isHidden);
        }
    });

    document.getElementById("registerForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearStatus();
        await handleRegisterOtpSend();
    });

    document.getElementById("verifyOtpBtn")?.addEventListener("click", async () => {
        clearStatus();
        await handleRegisterOtpVerify();
    });

    document.getElementById("resendOtpBtn")?.addEventListener("click", async () => {
        clearStatus();
        await handleRegisterOtpResend();
    });

    document.getElementById("completeRegistrationBtn")?.addEventListener("click", async () => {
        clearStatus();
        await handleRegisterComplete(options.redirect);
    });
}

async function renderPrompt(options, mode = "login") {
    ensureStyles();
    promptPendingRegistration = null;
    promptEmailVerified = false;
    promptPendingPasswordResetEmail = null;
    promptPasswordResetVerified = false;

    if (!authMarkupPreloaded) {
        await preloadAuthBoxMarkup(["signin.html", "register.html", "forgot_password.html"]);
        authMarkupPreloaded = true;
    }

    const overlay = document.getElementById("authPromptOverlay");
    const contentHost = document.getElementById("authPromptContent");

    const loginMarkup = await loadAuthBoxMarkup("signin.html");
    const registerMarkup = await loadAuthBoxMarkup("register.html");
    const forgotMarkup = await loadAuthBoxMarkup("forgot_password.html");
    const activeMarkup = mode === "login"
        ? normalizeLoginMarkup(loginMarkup, options)
        : mode === "forgot"
            ? normalizeForgotMarkup(forgotMarkup, options)
            : normalizeRegisterMarkup(registerMarkup, options);

    if (!overlay || !contentHost) {
        const newOverlay = document.createElement("div");
        newOverlay.id = "authPromptOverlay";
        newOverlay.className = "auth-prompt-overlay";
        newOverlay.innerHTML = `
            <div class="auth-prompt-shell">
                <button class="auth-prompt-close" type="button" id="authPromptClose">x</button>
                <div id="authPromptContent">${activeMarkup}</div>
            </div>
        `;
        document.body.appendChild(newOverlay);
    } else {
        contentHost.innerHTML = activeMarkup;
    }

    bindCommonEvents(options, mode);
}

export function showAuthPrompt(options = {}) {
    const config = {
        title: options.title || "Sign in to continue",
        message: options.message || "You can browse freely. Sign in or register only when you want to continue with checkout.",
        redirect: options.redirect || getRedirectTarget(),
        preserveSourceCopy: options.preserveSourceCopy === true,
        continueRedirect: options.continueRedirect || "",
        closeRedirect: options.closeRedirect || ""
    };

    renderPrompt(config, "login");
}
