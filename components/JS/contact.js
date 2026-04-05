import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
    await loadContact();
    subscribeToRealtimeUpdates();
    setupForm();
});

// ================= IMAGE =================
function getImageUrl(fileName) {
    if (!fileName) return null;
    return `https://plojfgqvvojpushcatsn.supabase.co/storage/v1/object/public/Food-Website-Storage/Contact/${fileName}`;
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
        const { data, error } = await supabase
            .from("about_content")
            .select("*");

        if (error || !data || data.length === 0) {
            return renderFallback();
        }

        const requiredSections = ["contact"];

        const anyDisabled = requiredSections.some(section => {
            const item = data.find(d =>
                (d.section || "").toLowerCase() === section.toLowerCase()
            );
            return !item || (item.Status || "").toLowerCase() !== "enabled";
        });

        if (anyDisabled) return renderFallback();

        renderDbContent(data);

    } catch (err) {
        renderFallback();
    }
}

// ================= RENDER =================
function renderDbContent(data) {
    const contact = data.find(d =>
        (d.section || "").toLowerCase() === "contact"
    );

    document.getElementById("contactTitle").textContent = contact.title;

    document.getElementById("contactImage").src =
        getImageUrl(contact.image_path) || FALLBACK.contact.image;
}

// ================= FALLBACK =================
function renderFallback() {
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
            { event: "*", schema: "public", table: "about_content" },
            () => loadContact()
        )
        .subscribe();
}