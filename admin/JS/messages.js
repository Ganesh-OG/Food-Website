import { renderAdminShell, supabase, showToast, createStatusTag, escapeHtml, getStoragePublicUrl } from "./common.js";
import { EMAILJS_CONFIG } from "../../components/JS/config.js";

let messages = [];
let currentAdmin = null;
let canReply = false;
let canMarkStatus = false;
let canDelete = false;
let activeReplyId = null;
const REPLY_EMAIL_LOGO_URL = getStoragePublicUrl("Food-Website-Storage", "Email Header Image/Dr NGP Logo.png");

document.addEventListener("DOMContentLoaded", initMessages);

async function initMessages() {
    const view = await renderAdminShell({
        title: "Messages",
        subtitle: "Review support requests, reply to users, and keep the inbox status updated.",
        requiredAnyPower: ["message_view", "message_reply", "message_delete", "message_mark_answered"]
    });

    if (!view?.root) return;

    const { root, hasPower, user } = view;
    currentAdmin = user;
    canReply = hasPower("message_reply");
    canMarkStatus = hasPower("message_mark_answered") || hasPower("message_reply");
    canDelete = hasPower("message_delete");

    root.innerHTML = `
        <div class="panel-grid">
            <div class="card">
                <div class="toolbar">
                    <select id="messageStatus">
                        <option value="">All statuses</option>
                        <option value="Pending">Pending</option>
                        <option value="Read">Read</option>
                        <option value="Replied">Replied</option>
                    </select>
                    <input id="messageSearch" type="search" placeholder="Search by name, email, phone, message, or ID">
                    <button class="btn-ghost" id="refreshMessages" type="button">Refresh</button>
                </div>
                <div id="messagesSummary" class="toolbar"></div>
                <div class="messages-list" id="messagesList">
                    <div class="empty">Loading messages...</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("messageStatus")?.addEventListener("change", renderMessages);
    document.getElementById("messageSearch")?.addEventListener("input", renderMessages);
    document.getElementById("refreshMessages")?.addEventListener("click", loadMessages);

    await loadMessages();
}

async function loadMessages() {
    const mount = document.getElementById("messagesList");
    if (mount) {
        mount.innerHTML = `<div class="empty">Loading messages...</div>`;
    }

    const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone, message, Status");

    if (error) {
        showToast(error.message || "Unable to load messages", "error");
        if (mount) {
            mount.innerHTML = `<div class="empty">Unable to load messages right now.</div>`;
        }
        return;
    }

    messages = (data || []).map(item => ({
        ...item,
        Status: normalizeMessageStatus(item.Status)
    })).sort((first, second) => String(second.id || "").localeCompare(String(first.id || "")));
    renderMessages();
}

function renderMessages() {
    const mount = document.getElementById("messagesList");
    const summary = document.getElementById("messagesSummary");
    if (!mount || !summary) return;

    const status = document.getElementById("messageStatus")?.value || "";
    const search = String(document.getElementById("messageSearch")?.value || "").trim().toLowerCase();

    const filtered = messages.filter(item => {
        const byStatus = !status || normalizeMessageStatus(item.Status) === status;
        const haystack = `${item.id || ""} ${item.name || ""} ${item.email || ""} ${item.phone || ""} ${item.message || ""}`.toLowerCase();
        const bySearch = !search || haystack.includes(search);
        return byStatus && bySearch;
    });

    const pendingCount = messages.filter(item => normalizeMessageStatus(item.Status) === "Pending").length;
    const readCount = messages.filter(item => normalizeMessageStatus(item.Status) === "Read").length;
    const repliedCount = messages.filter(item => normalizeMessageStatus(item.Status) === "Replied").length;

    summary.innerHTML = `
        <button class="tag pending messages-filter-chip ${status === "Pending" ? "active" : ""}" type="button" data-filter-status="Pending">${pendingCount} pending</button>
        <button class="tag complete messages-filter-chip ${status === "Read" ? "active" : ""}" type="button" data-filter-status="Read">${readCount} read</button>
        <button class="tag enabled messages-filter-chip ${status === "Replied" ? "active" : ""}" type="button" data-filter-status="Replied">${repliedCount} replied</button>
        <span class="muted">${filtered.length} shown</span>
    `;

    summary.querySelectorAll("[data-filter-status]").forEach(button => {
        button.addEventListener("click", () => {
            const statusFilter = document.getElementById("messageStatus");
            if (!statusFilter) return;
            statusFilter.value = status === button.dataset.filterStatus ? "" : button.dataset.filterStatus;
            renderMessages();
        });
    });

    if (!filtered.length) {
        mount.innerHTML = `<div class="empty">No messages match the current filter.</div>`;
        return;
    }

    mount.innerHTML = filtered.map(item => `
        <article class="list-item messages-card">
            <div class="messages-card-head">
                <div class="messages-meta">
                    <strong>${escapeHtml(item.name || "Unknown sender")}</strong>
                    <div class="muted">${escapeHtml(item.email || "No email")}</div>
                    <div class="muted">${escapeHtml(item.phone || "No phone")}</div>
                    <div class="muted code">${escapeHtml(item.id || "")}</div>
                    <div class="muted">${formatMessageDate(item.created_at)}</div>
                </div>
                <div>${createStatusTag(item.Status)}</div>
            </div>
            <div class="messages-body">
                <div class="messages-body-label">User message</div>
                <div class="messages-body-copy">${escapeHtml(item.message || "No message content").replace(/\n/g, "<br>")}</div>
            </div>
            ${canReply && activeReplyId === item.id ? `
                <form class="messages-reply-form" data-reply-form="${escapeHtml(item.id)}">
                    <label>
                        <span>Reply message</span>
                        <textarea name="replyMessage" rows="5" placeholder="Write your reply to the user here..."></textarea>
                    </label>
                    <div class="messages-template-note">
                        Email subject preview: Re: your query to our support team
                    </div>
                    <div class="compact-actions">
                        <button class="btn" type="submit">Send Reply</button>
                        <button class="btn-ghost" type="button" data-cancel-reply="${escapeHtml(item.id)}">Cancel</button>
                    </div>
                </form>
            ` : ""}
            ${(canReply || canMarkStatus || canDelete) ? `
                <div class="compact-actions">
                    ${canReply ? `<button class="btn-secondary" type="button" data-reply="${escapeHtml(item.id)}">${activeReplyId === item.id ? "Reply Open" : "Reply"}</button>` : ""}
                    ${canMarkStatus && item.Status !== "Read" ? `<button class="btn-ghost" type="button" data-status="${escapeHtml(item.id)}" data-value="Read">Mark as Read</button>` : ""}
                    ${canMarkStatus && item.Status !== "Replied" ? `<button class="btn" type="button" data-status="${escapeHtml(item.id)}" data-value="Replied">Mark as Replied</button>` : ""}
                    ${canDelete ? `<button class="btn-danger" type="button" data-delete="${escapeHtml(item.id)}">Delete</button>` : ""}
                </div>
            ` : ""}
        </article>
    `).join("");

    mount.querySelectorAll("[data-reply]").forEach(button => {
        button.addEventListener("click", () => {
            activeReplyId = activeReplyId === button.dataset.reply ? null : button.dataset.reply;
            renderMessages();
        });
    });

    mount.querySelectorAll("[data-cancel-reply]").forEach(button => {
        button.addEventListener("click", () => {
            activeReplyId = null;
            renderMessages();
        });
    });

    mount.querySelectorAll("[data-reply-form]").forEach(form => {
        form.addEventListener("submit", sendReplyToMessage);
    });

    mount.querySelectorAll("[data-status]").forEach(button => {
        button.addEventListener("click", () => updateMessageStatus(button.dataset.status, button.dataset.value));
    });

    mount.querySelectorAll("[data-delete]").forEach(button => {
        button.addEventListener("click", () => deleteMessage(button.dataset.delete));
    });
}

async function sendReplyToMessage(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const id = form.dataset.replyForm;
    const message = messages.find(item => String(item.id) === String(id));
    if (!message) return;

    const replyMessage = String(form.elements.replyMessage.value || "").trim();
    if (!replyMessage) {
        showToast("Write a reply before sending", "error");
        return;
    }

    if (!message.email) {
        showToast("This message does not have an email address", "error");
        return;
    }

    const sendResult = await sendReplyEmail({
        toName: message.name || "User",
        toEmail: message.email,
        phone: message.phone || "",
        messageId: message.id || "",
        originalMessage: message.message || "",
        replyMessage,
        adminName: currentAdmin?.name || currentAdmin?.email || "Support Team"
    });

    if (!sendResult.ok) {
        showToast(sendResult.message, "error");
        return;
    }

    const statusResult = await updateMessageStatus(id, "Replied", { silent: true });
    if (!statusResult.ok) {
        showToast(statusResult.message, "error");
        return;
    }

    activeReplyId = null;
    showToast("Reply sent to the user");
    await loadMessages();
}

async function sendReplyEmail({ toName, toEmail, phone, messageId, originalMessage, replyMessage, adminName }) {
    const { publicKey, serviceId, replyTemplateId } = EMAILJS_CONFIG;

    if (
        !publicKey ||
        !serviceId ||
        !replyTemplateId ||
        publicKey.includes("YOUR_") ||
        serviceId.includes("YOUR_") ||
        replyTemplateId.includes("YOUR_")
    ) {
        return {
            ok: false,
            message: "Configure EMAILJS replyTemplateId in components/JS/config.js"
        };
    }

    try {
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                service_id: serviceId,
                template_id: replyTemplateId,
                user_id: publicKey,
                template_params: {
                    to_name: toName,
                    to_email: toEmail,
                    from_name: adminName,
                    logo_url: REPLY_EMAIL_LOGO_URL,
                    app_name: "NGP Food Website Support",
                    phone,
                    message_id: messageId,
                    original_message: originalMessage,
                    reply_message: replyMessage,
                    subject: "Re: your query to our support team"
                }
            })
        });

        const rawText = await response.text();
        if (!response.ok) {
            console.error("EmailJS reply send failed:", rawText);
            return {
                ok: false,
                message: "Unable to send the reply email right now"
            };
        }

        return {
            ok: true,
            message: rawText || "Reply email sent"
        };
    } catch (error) {
        console.error("EmailJS reply request failed:", error);
        return {
            ok: false,
            message: "Unable to send the reply email right now"
        };
    }
}

async function updateMessageStatus(id, status, options = {}) {
    const { error } = await supabase
        .from("contacts")
        .update({ Status: status })
        .eq("id", id);

    if (error) {
        return {
            ok: false,
            message: error.message || "Unable to update message status"
        };
    }

    if (!options.silent) {
        showToast("Message status updated");
        await loadMessages();
    }

    return { ok: true };
}

async function deleteMessage(id) {
    const confirmed = window.confirm(`Delete message ${id}?`);
    if (!confirmed) return;

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

function normalizeMessageStatus(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "read" || normalized === "reviewed" || normalized === "seen" || normalized === "opened" || normalized === "viewed") return "Read";
    if (normalized === "replied" || normalized === "resolved" || normalized === "answered" || normalized === "reply sent") return "Replied";
    return "Pending";
}

function formatMessageDate(value) {
    if (!value) return "No timestamp";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
}
