import { renderAdminShell, supabase, showToast, createStatusTag, escapeHtml } from "./common.js";

let messages = [];

document.addEventListener("DOMContentLoaded", initMessages);

async function initMessages() {
    const root = renderAdminShell({
        title: "Messages",
        subtitle: "Website contact messages moved from Firebase contact data to the Supabase contacts table."
    });

    if (!root) return;

    root.innerHTML = `
        <div class="card">
            <div class="toolbar">
                <select id="messageStatus">
                    <option value="">All statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Reviewed">Reviewed</option>
                    <option value="Resolved">Resolved</option>
                </select>
                <input id="messageSearch" type="search" placeholder="Search by name, email, ID">
                <button class="btn-ghost" id="refreshMessages">Refresh</button>
            </div>
            <div class="list" id="messagesList"></div>
        </div>
    `;

    document.getElementById("messageStatus").addEventListener("change", renderMessages);
    document.getElementById("messageSearch").addEventListener("input", renderMessages);
    document.getElementById("refreshMessages").addEventListener("click", loadMessages);

    await loadMessages();
}

async function loadMessages() {
    const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        showToast(error.message || "Unable to load messages", "error");
        return;
    }

    messages = data || [];
    renderMessages();
}

function renderMessages() {
    const mount = document.getElementById("messagesList");
    if (!mount) return;

    const status = document.getElementById("messageStatus").value;
    const search = document.getElementById("messageSearch").value.trim().toLowerCase();

    const filtered = messages.filter(item => {
        const byStatus = !status || item.Status === status;
        const haystack = `${item.id || ""} ${item.name || ""} ${item.email || ""} ${item.phone || ""}`.toLowerCase();
        const bySearch = !search || haystack.includes(search);
        return byStatus && bySearch;
    });

    if (!filtered.length) {
        mount.innerHTML = `<div class="empty">No messages found.</div>`;
        return;
    }

    mount.innerHTML = filtered.map(item => `
        <div class="list-item">
            <div class="compact-actions" style="justify-content:space-between; align-items:flex-start;">
                <div>
                    <strong>${escapeHtml(item.name || "Unknown")}</strong>
                    <div class="muted">${escapeHtml(item.email || "")} • ${escapeHtml(item.phone || "")}</div>
                    <div class="muted code">${escapeHtml(item.id || "")}</div>
                </div>
                <div>${createStatusTag(item.Status || "Pending")}</div>
            </div>
            <p>${escapeHtml(item.message || "")}</p>
            <div class="compact-actions">
                <button class="btn-secondary" data-status="${escapeHtml(item.id)}" data-value="Reviewed">Mark Reviewed</button>
                <button class="btn" data-status="${escapeHtml(item.id)}" data-value="Resolved">Mark Resolved</button>
                <button class="btn-danger" data-delete="${escapeHtml(item.id)}">Delete</button>
            </div>
        </div>
    `).join("");

    mount.querySelectorAll("[data-status]").forEach(button => {
        button.addEventListener("click", () => updateMessageStatus(button.dataset.status, button.dataset.value));
    });

    mount.querySelectorAll("[data-delete]").forEach(button => {
        button.addEventListener("click", () => deleteMessage(button.dataset.delete));
    });
}

async function updateMessageStatus(id, status) {
    const { error } = await supabase
        .from("contacts")
        .update({ Status: status })
        .eq("id", id);

    if (error) {
        showToast(error.message || "Unable to update message status", "error");
        return;
    }

    showToast("Message status updated");
    await loadMessages();
}

async function deleteMessage(id) {
    const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);

    if (error) {
        showToast(error.message || "Unable to delete message", "error");
        return;
    }

    showToast("Message deleted");
    await loadMessages();
}
