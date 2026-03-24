// components/JS/footer.js

import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
    waitForFooter();
});

// 🔥 Wait until footer HTML is injected
function waitForFooter() {
    const check = setInterval(() => {
        if (document.getElementById("footerEmail")) {
            clearInterval(check);
            loadFooter();
        }
    }, 100);
}

async function loadFooter() {
    try {
        const { data, error } = await supabase
            .from("app_config")
            .select("*")
            .single();

        if (error) throw error;

        console.log("Footer Data:", data);

        // ================= EMAILS =================
        if (Array.isArray(data.emails) && data.emails.length > 0) {
            document.getElementById("footerEmail").innerHTML =
                data.emails.map(email =>
                    `<a href="mailto:${email}">${email}</a>`
                ).join("<br>");
        }

        // ================= HOURS =================
        document.getElementById("footerHours").textContent =
            data.opening_hours || "N/A";

        // ================= ADDRESS =================
        const addressEl = document.getElementById("footerAddress");
        addressEl.textContent = data.address || "N/A";
        addressEl.href = data.map_link || "#";
        addressEl.target = "_blank";

        // ================= PHONES =================
        if (Array.isArray(data.phones) && data.phones.length > 0) {
            document.getElementById("footerPhone").innerHTML =
                data.phones.map(phone =>
                    `<a href="tel:${phone}">${phone}</a>`
                ).join("<br>");
        }

        // ================= YEAR =================
        setYear();

    } catch (err) {
        console.error("Footer error:", err);
    }
}

// 🔥 YEAR FUNCTION
function setYear() {
    const yearEl = document.getElementById("year");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}