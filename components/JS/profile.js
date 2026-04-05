import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {

    // ================= LOAD HEADER =================
    const headerRes = await fetch("user_header.html");
    document.getElementById("headerContainer").innerHTML = await headerRes.text();

    // ================= LOAD FOOTER =================
    const footerRes = await fetch("footer.html");
    document.getElementById("footerContainer").innerHTML = await footerRes.text();

    // ================= GET USER FROM LOCAL =================
    const localUser = JSON.parse(localStorage.getItem("user"));

    if (!localUser) {
        window.location.href = "index.html";
        return;
    }

    try {
        // ================= FETCH LATEST USER DATA =================
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", localUser.email)
            .single();

        if (error) throw error;

        const user = data;

        console.log("Profile User:", user); // 🔍 Debug

        // ================= NAME =================
        document.getElementById("name").textContent = user.name || "N/A";

        // ================= EMAIL =================
        document.getElementById("email").textContent =
            `Email: ${user.email || "N/A"}`;

        // ================= DEPARTMENT / USER TYPE =================
        let displayDept = "N/A";

        if (user.user_type === "external") {
            displayDept = "External User";
        } else {
            displayDept = user.department || "N/A";
        }

        document.getElementById("department").textContent =
            `Department: ${displayDept}`;

        // ================= ROLL NUMBER =================
        document.getElementById("id").textContent =
            `Roll Number: ${user.id || "N/A"}`;

        // ================= DOB =================
        if (user.dob) {
            const date = new Date(user.dob);
            const formatted = date.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });

            document.getElementById("dob").textContent =
                `Date of Birth: ${formatted}`;
        } else {
            document.getElementById("dob").textContent =
                "Date of Birth: N/A";
        }

        // ================= WALLET =================
        document.getElementById("balance").textContent =
            `Wallet Amount: ₹${user.balance ?? 0}`;

    } catch (err) {
        console.error("Profile Error:", err);
    }

});