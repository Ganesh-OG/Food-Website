import { renderAdminShell, supabase, showToast, formatCurrency, escapeHtml } from "./common.js";

let users = [];

document.addEventListener("DOMContentLoaded", initWallet);

async function initWallet() {
    const view = await renderAdminShell({
        title: "Wallet",
        subtitle: "Wallet access is limited to roles with the wallet permission.",
        requiredPower: "wallet_access"
    });

    if (!view?.root) return;

    const { root } = view;

    root.innerHTML = `
        <div class="split">
            <div class="card">
                <h3>Find User</h3>
                <div class="toolbar">
                    <input id="walletSearch" type="search" placeholder="Search by ID, name, or email">
                    <button class="btn-ghost" id="refreshUsers">Refresh</button>
                </div>
                <div class="list" id="usersList"></div>
            </div>
            <div class="card">
                <h3>Update Balance</h3>
                <form id="walletForm" class="form-grid">
                    <input id="walletUserId" type="text" placeholder="User ID" readonly>
                    <input id="walletUserEmail" type="text" placeholder="Email" readonly>
                    <input id="walletCurrentBalance" type="text" placeholder="Current balance" readonly>
                    <input id="walletAmount" type="number" placeholder="Amount" step="0.01" required>
                    <select id="walletMode" class="full">
                        <option value="add">Add amount</option>
                        <option value="set">Set exact amount</option>
                    </select>
                    <button class="btn full" type="submit">Apply Balance Update</button>
                </form>
            </div>
        </div>
    `;

    document.getElementById("walletSearch").addEventListener("input", renderUsers);
    document.getElementById("refreshUsers").addEventListener("click", loadUsers);
    document.getElementById("walletForm").addEventListener("submit", submitWalletUpdate);

    await loadUsers();
}

async function loadUsers() {
    const { data, error } = await supabase
        .from("users")
        .select("id, name, email, balance, role, user_type")
        .order("name");

    if (error) {
        showToast(error.message || "Unable to load users", "error");
        return;
    }

    users = data || [];
    renderUsers();
}

function renderUsers() {
    const mount = document.getElementById("usersList");
    if (!mount) return;

    const search = document.getElementById("walletSearch").value.trim().toLowerCase();
    const filtered = users.filter(user => {
        const haystack = `${user.id || ""} ${user.name || ""} ${user.email || ""}`.toLowerCase();
        return !search || haystack.includes(search);
    });

    if (!filtered.length) {
        mount.innerHTML = `<div class="empty">No users found.</div>`;
        return;
    }

    mount.innerHTML = filtered.slice(0, 50).map(user => `
        <div class="list-item">
            <strong>${escapeHtml(user.name || "Unnamed user")}</strong>
            <div class="muted">${escapeHtml(user.email || "")}</div>
            <div class="muted code">${escapeHtml(user.id || "")}</div>
            <div>${formatCurrency(user.balance)} • ${escapeHtml(user.role || user.user_type || "")}</div>
            <div class="compact-actions">
                <button class="btn-secondary" data-pick="${escapeHtml(user.id)}">Select</button>
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

    document.getElementById("walletUserId").value = user.id || "";
    document.getElementById("walletUserEmail").value = user.email || "";
    document.getElementById("walletCurrentBalance").value = formatCurrency(user.balance);
}

async function submitWalletUpdate(event) {
    event.preventDefault();

    const userId = document.getElementById("walletUserId").value;
    const amount = Number(document.getElementById("walletAmount").value);
    const mode = document.getElementById("walletMode").value;

    if (!userId) {
        showToast("Select a user first", "error");
        return;
    }

    const user = users.find(item => String(item.id) === String(userId));
    if (!user) {
        showToast("Selected user no longer exists", "error");
        return;
    }

    const newBalance = mode === "set"
        ? amount
        : Number(user.balance || 0) + amount;

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
