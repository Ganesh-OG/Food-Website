import { renderAdminShell, supabase, showToast, formatCurrency, escapeHtml } from "./common.js";

let users = [];
let selectedUserId = "";
let canViewWallet = false;
let canAddWalletAmount = false;

document.addEventListener("DOMContentLoaded", initWallet);

async function initWallet() {
    const view = await renderAdminShell({
        title: "Wallet",
        subtitle: "Find a user, review the current balance, and apply a positive or negative adjustment.",
        requiredAnyPower: ["wallet_view", "wallet_edit", "wallet_add_money"]
    });

    if (!view?.root) return;

    const { root, hasPower } = view;
    canViewWallet = hasPower("wallet_view");
    canAddWalletAmount = hasPower("wallet_edit") || hasPower("wallet_add_money");
    const hasUpdateOnlyAccess = !canViewWallet && canAddWalletAmount;

    root.innerHTML = hasUpdateOnlyAccess
        ? `
            <div class="card">
                <h3>Wallet View Required</h3>
                <p class="muted">This account can update wallet balances but cannot search users because wallet view access is missing.</p>
            </div>
        `
        : `
            <div class="split wallet-split">
                <div class="card wallet-users-card">
                    <h3>Find User</h3>
                    <div class="toolbar">
                        <input id="walletSearch" type="search" placeholder="Search by ID, name, or email">
                        <button class="btn-ghost" id="refreshUsers" type="button">Refresh</button>
                    </div>
                    <div class="list" id="usersList">
                        <div class="empty">Loading users...</div>
                    </div>
                </div>
                <div class="card wallet-adjust-card" ${canAddWalletAmount ? "" : "hidden"}>
                    <h3>Adjust Balance</h3>
                    <p class="muted">Enter a positive amount to add money or a negative amount to deduct.</p>
                    <form id="walletForm" class="form-grid">
                        <input id="walletUserId" type="text" placeholder="User ID" readonly>
                        <input id="walletUserEmail" type="text" placeholder="Email" readonly>
                        <input id="walletCurrentBalance" type="text" placeholder="Current balance" readonly>
                        <input id="walletAmount" type="number" placeholder="Amount (+/-)" step="0.01" required>
                        <div class="full list-item" id="walletPreviewCard">
                            <strong>New balance preview</strong>
                            <div class="muted" id="walletPreviewValue">Select a user and enter an amount</div>
                        </div>
                        <button class="btn full" type="submit">Apply Balance Update</button>
                    </form>
                </div>
            </div>
        `;

    document.getElementById("walletSearch")?.addEventListener("input", renderUsers);
    document.getElementById("refreshUsers")?.addEventListener("click", loadUsers);
    document.getElementById("walletForm")?.addEventListener("submit", submitWalletUpdate);
    document.getElementById("walletAmount")?.addEventListener("input", renderBalancePreview);

    await loadUsers();
}

async function loadUsers() {
    if (!canViewWallet) return;

    const mount = document.getElementById("usersList");
    if (mount) {
        mount.innerHTML = `<div class="empty">Loading users...</div>`;
    }

    const { data, error } = await supabase
        .from("users")
        .select("id, name, email, balance, role, user_type")
        .order("name");

    if (error) {
        showToast(error.message || "Unable to load users", "error");
        if (mount) {
            mount.innerHTML = `<div class="empty">Unable to load users right now.</div>`;
        }
        return;
    }

    users = data || [];
    renderUsers();
    if (selectedUserId) {
        selectUser(selectedUserId);
    }
}

function renderUsers() {
    const mount = document.getElementById("usersList");
    if (!mount) return;

    const search = String(document.getElementById("walletSearch")?.value || "").trim().toLowerCase();
    const filtered = users.filter(user => {
        const haystack = `${user.id || ""} ${user.name || ""} ${user.email || ""}`.toLowerCase();
        return !search || haystack.includes(search);
    });

    if (!filtered.length) {
        mount.innerHTML = `<div class="empty">No users found.</div>`;
        return;
    }

    mount.innerHTML = filtered.slice(0, 80).map(user => `
        <div class="list-item">
            <strong>${escapeHtml(user.name || "Unnamed user")}</strong>
            <div class="muted">${escapeHtml(user.email || "")}</div>
            <div class="muted code">${escapeHtml(user.id || "")}</div>
            <div>${formatCurrency(user.balance)} • ${escapeHtml(user.role || user.user_type || "user")}</div>
            <div class="compact-actions">
                <button class="btn-secondary" type="button" data-pick="${escapeHtml(user.id)}">Select</button>
            </div>
        </div>
    `).join("");

    mount.querySelectorAll("[data-pick]").forEach(button => {
        button.addEventListener("click", () => selectUser(button.dataset.pick));
    });
}

function selectUser(id) {
    const user = users.find(item => String(item.id) === String(id));
    if (!user) return;

    selectedUserId = String(id);

    const idField = document.getElementById("walletUserId");
    const emailField = document.getElementById("walletUserEmail");
    const balanceField = document.getElementById("walletCurrentBalance");

    if (idField) idField.value = user.id || "";
    if (emailField) emailField.value = user.email || "";
    if (balanceField) balanceField.value = formatCurrency(user.balance);

    renderBalancePreview();
}

function renderBalancePreview() {
    const preview = document.getElementById("walletPreviewValue");
    if (!preview) return;

    const amount = Number(document.getElementById("walletAmount")?.value || 0);
    const user = users.find(item => String(item.id) === String(selectedUserId));

    if (!user || !Number.isFinite(amount)) {
        preview.textContent = "Select a user and enter an amount";
        return;
    }

    const nextBalance = Number(user.balance || 0) + amount;
    preview.textContent = `${formatCurrency(user.balance)} -> ${formatCurrency(nextBalance)}`;
}

async function submitWalletUpdate(event) {
    event.preventDefault();

    if (!canAddWalletAmount) {
        showToast("You don't have permission to update wallet balances", "error");
        return;
    }

    const userId = document.getElementById("walletUserId")?.value;
    const amount = Number(document.getElementById("walletAmount")?.value);

    if (!userId) {
        showToast("Select a user first", "error");
        return;
    }

    if (!Number.isFinite(amount) || amount === 0) {
        showToast("Enter a non-zero amount", "error");
        return;
    }

    const user = users.find(item => String(item.id) === String(userId));
    if (!user) {
        showToast("Selected user no longer exists", "error");
        return;
    }

    const newBalance = Number(user.balance || 0) + amount;

    const { error } = await supabase
        .from("users")
        .update({ balance: newBalance })
        .eq("id", userId);

    if (error) {
        showToast(error.message || "Unable to update balance", "error");
        return;
    }

    showToast("Balance updated");
    document.getElementById("walletAmount").value = "";
    await loadUsers();
    selectUser(userId);
}
