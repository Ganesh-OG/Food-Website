import { renderAdminShell, supabase, showToast, formatCurrency, escapeHtml } from "./common.js";
import { clearStoredSession } from "../../components/JS/session.js";

let currentAdmin = null;

document.addEventListener("DOMContentLoaded", initAdminProfile);

async function initAdminProfile() {
    const view = await renderAdminShell({
        title: "Admin Profile",
        subtitle: "Review your admin account details and update your password securely."
    });

    if (!view?.root) return;

    const { root, user } = view;
    currentAdmin = user;

    root.innerHTML = `
        <div class="panel-grid two admin-profile-grid">
            <section class="card admin-profile-card admin-profile-main-card">
                <div class="admin-profile-hero">
                    <div class="admin-profile-hero-icon">
                        <i class="fa-regular fa-circle-user"></i>
                    </div>
                </div>
                <div class="admin-profile-lines">
                    ${renderProfileLine("fa-user", user.name || "N/A")}
                    ${renderProfileLine("fa-envelope", `Email: ${user.email || "N/A"}`)}
                    ${renderProfileLine("fa-building", `Department: ${user.department || "N/A"}`)}
                    ${renderProfileLine("fa-id-badge", `${normalizeUserIdLabel(user)}: ${user.id || "N/A"}`)}
                    ${renderProfileLine("fa-calendar-alt", `Date of Birth: ${formatDob(user.dob)}`)}
                    ${renderProfileLine("fa-wallet", `Wallet Amount: ${formatCurrency(user.balance ?? 0)}`)}
                    ${renderProfileLine("fa-user-shield", `Role: ${user.role || "Admin"}`)}
                    ${renderProfileLine("fa-address-card", `User Type: ${user.user_type || "N/A"}`)}
                </div>
            </section>

            <section class="card admin-profile-card admin-password-card">
                <div class="users-panel-header">
                    <h3>Update Password</h3>
                    <p class="muted">Use your current password, then set a new one with at least 6 characters.</p>
                </div>
                <form id="adminPasswordForm" class="stack">
                    <label>
                        <span>Email</span>
                        <input type="email" id="adminProfileEmail" value="${escapeHtml(user.email || "")}" readonly class="readonly-field">
                    </label>
                    <label>
                        <span>Current Password</span>
                        <input type="password" id="adminCurrentPassword" autocomplete="new-password" required>
                    </label>
                    <label>
                        <span>New Password</span>
                        <input type="password" id="adminNewPassword" autocomplete="new-password" minlength="6" required>
                    </label>
                    <label>
                        <span>Confirm Password</span>
                        <input type="password" id="adminConfirmPassword" autocomplete="new-password" required>
                    </label>
                    <div class="compact-actions">
                        <button class="btn" type="submit">Update Password</button>
                        <button class="btn-ghost" type="button" id="resetAdminPasswordForm">Discard</button>
                    </div>
                </form>
            </section>
        </div>
    `;

    document.getElementById("adminPasswordForm")?.addEventListener("submit", updateAdminPassword);
    document.getElementById("resetAdminPasswordForm")?.addEventListener("click", () => {
        document.getElementById("adminPasswordForm")?.reset();
    });
}

function renderProfileLine(icon, value) {
    return `
        <div class="admin-profile-line">
            <i class="fa-solid ${escapeHtml(icon)}" aria-hidden="true"></i>
            <span>${escapeHtml(value)}</span>
        </div>
    `;
}

async function updateAdminPassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById("adminCurrentPassword")?.value || "";
    const newPassword = document.getElementById("adminNewPassword")?.value || "";
    const confirmPassword = document.getElementById("adminConfirmPassword")?.value || "";

    if (!currentAdmin?.email) {
        showToast("Unable to load admin profile data", "error");
        return;
    }

    const { data, error } = await supabase
        .from("users")
        .select("email, password")
        .ilike("email", currentAdmin.email)
        .maybeSingle();

    if (error || !data) {
        showToast(error?.message || "Unable to verify current password", "error");
        return;
    }

    if (currentPassword !== data.password) {
        showToast("Current password is incorrect", "error");
        return;
    }

    if (newPassword.length < 6) {
        showToast("New password must be at least 6 characters", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast("Passwords do not match", "error");
        return;
    }

    const { error: updateError } = await supabase
        .from("users")
        .update({
            password: newPassword,
            last_reset_by: currentAdmin.email,
            last_reset_at: new Date().toISOString()
        })
        .ilike("email", currentAdmin.email);

    if (updateError) {
        showToast(updateError.message || "Unable to update password", "error");
        return;
    }

    showToast("Password updated. Please sign in again.");
    document.getElementById("adminPasswordForm")?.reset();

    setTimeout(() => {
        clearStoredSession();
        window.location.href = "../signin.html";
    }, 1800);
}

function formatDob(value) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function normalizeUserIdLabel(user) {
    return String(user?.user_type || "").toLowerCase() === "external"
        ? "User ID"
        : "Roll Number";
}
