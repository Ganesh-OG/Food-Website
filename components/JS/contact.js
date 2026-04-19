import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("[contact.js] DOMContentLoaded");
    await loadContact();
    subscribeToRealtimeUpdates();
    setupForm();
});

// ================= IMAGE =================
function getImageUrl(fileName) {
    if (!fileName) return null;
    const cleanFileName = String(fileName).trim();
    if (!cleanFileName) return null;

    const { data } = supabase
        .storage
        .from("Food-Website-Storage")
        .getPublicUrl(`Contact/${cleanFileName}`);

    console.log("[contact.js] Storage image path:", `Contact/${cleanFileName}`);
    console.log("[contact.js] Storage public URL:", data?.publicUrl || null);
    return data?.publicUrl || null;
}

// ================= FALLBACK =================
const FALLBACK = {
    contact: {
        title: "Tell Us Something!",
        image: "images/contact-img.svg"
    }
};

// ================= LOAD =================
async function loadContact() {
    try {
        console.log("[contact.js] Loading contact_config...");
        const { data, error } = await supabase
            .from("contact_config")
            .select("*");

        console.log("[contact.js] contact_config response:", { data, error });

        if (error || !data || data.length === 0) {
            console.warn("[contact.js] No usable contact_config rows. Falling back.");
            return renderFallback();
        }

        const contact = pickContactConfig(data);
        console.log("[contact.js] Selected contact row:", contact);
        if (!contact) {
            console.warn("[contact.js] No enabled Primary/Secondary row found. Falling back.");
            return renderFallback();
        }

        renderDbContent(contact);

    } catch (err) {
        console.error("[contact.js] loadContact failed:", err);
        renderFallback();
    }
}

// ================= RENDER =================
function renderDbContent(contact) {
    if (!contact) {
        return renderFallback();
    }

    const imageUrl = getImageUrl(contact.image_path) || FALLBACK.contact.image;
    console.log("[contact.js] Rendering DB content:", {
        title: contact.title,
        image_path: contact.image_path,
        imageUrl
    });

    document.getElementById("contactTitle").textContent = contact.title || FALLBACK.contact.title;

    document.getElementById("contactImage").src = imageUrl;
}

// ================= FALLBACK =================
function renderFallback() {
    console.warn("[contact.js] Rendering fallback content:", FALLBACK.contact);
    document.getElementById("contactTitle").textContent = FALLBACK.contact.title;
    document.getElementById("contactImage").src = FALLBACK.contact.image;
}

// ================= FORM =================
function setupForm() {

    const form = document.getElementById("contactForm");

    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const messageInput = document.getElementById("message");
    const charCount = document.getElementById("charCount");

    // Load user
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
        emailInput.value = user.email || "";
        nameInput.value = user.name || "";
    }

    // ===== PHONE: block non-numeric =====
    phoneInput.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/\D/g, "");
    });

    // ===== CHAR COUNTER =====
    messageInput.addEventListener("input", () => {
        charCount.textContent = `${messageInput.value.length}/300`;
    });

    // ===== SUBMIT =====
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const message = messageInput.value.trim();

        // ===== VALIDATIONS =====
        if (!name || !email || !phone || !message) {
            showModal("⚠️ All fields are required");
            return;
        }

        if (!/^\d{10}$/.test(phone)) {
            showModal("⚠️ Enter a valid 10-digit mobile number");
            return;
        }

        if (message.length < 5) {
            showModal("⚠️ Message too short");
            return;
        }

        // ===== ID =====
        const customId = generateContactId();

        try {

            const { error } = await supabase
                .from("contacts")
                .insert([
                    {
                        id: customId,
                        name,
                        email,
                        phone,
                        message,
                        Status: "Pending" // ✅ NEW FIELD
                    }
                ]);

            if (error) {
                console.error(error);
                showModal("❌ Error sending message");
                return;
            }

            showModal(
                `✅ Message Sent!\n\nID: ${customId}\n\nPlease take a screenshot if contacted for any issue.`,
                true
            );

            // Reset
            phoneInput.value = "";
            messageInput.value = "";
            charCount.textContent = "0/300";

        } catch (err) {
            console.error(err);
            showModal("❌ Something went wrong");
        }

    });
}

// ================= ID =================
function generateContactId() {
    const prefix = "CNT";
    const now = new Date();

    const date =
        now.getFullYear().toString().slice(-2) +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");

    const time =
        String(now.getHours()).padStart(2, "0") +
        String(now.getMinutes()).padStart(2, "0") +
        String(now.getSeconds()).padStart(2, "0");

    const rand = Math.floor(100 + Math.random() * 900);

    return `${prefix}-${date}-${time}-${rand}`;
}

// ================= MODAL =================
function showModal(message, success = false) {

    const old = document.getElementById("customModal");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "customModal";
    overlay.className = success ? "modal success" : "modal";

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-message">
                <span>${message}</span>
                <span class="modal-close" id="modalClose">✖</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    document.getElementById("modalClose").onclick = () => {
        overlay.remove();
        document.body.style.overflow = "auto";
    };
}

// ================= REALTIME =================
function subscribeToRealtimeUpdates() {
    supabase
        .channel("contact-updates")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "contact_config" },
            () => loadContact()
        )
        .subscribe();
}

function pickContactConfig(rows) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    console.log("[contact.js] Evaluating rows for Primary/Secondary:", normalizedRows);

    const primary = normalizedRows.find(row =>
        getContactStage(row) === "primary"
    );
    console.log("[contact.js] Primary row:", primary);

    if (isEnabledContactConfig(primary)) {
        console.log("[contact.js] Using Primary row");
        return primary;
    }

    const secondary = normalizedRows.find(row =>
        getContactStage(row) === "secondary"
    );
    console.log("[contact.js] Secondary row:", secondary);

    if (isEnabledContactConfig(secondary)) {
        console.log("[contact.js] Using Secondary row");
        return secondary;
    }

    console.warn("[contact.js] Neither Primary nor Secondary is enabled");
    return null;
}

function isEnabledContactConfig(row) {
    return Boolean(row) && getContactStatus(row) === "enabled";
}

function getContactStage(row) {
    return String(row?.Stage ?? row?.stage ?? "")
        .trim()
        .toLowerCase();
}

function getContactStatus(row) {
    return String(row?.status ?? row?.Status ?? "")
        .trim()
        .toLowerCase();
}
