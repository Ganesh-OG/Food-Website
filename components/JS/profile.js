import { supabase } from "./config.js";
import { showAuthPrompt } from "./auth_prompt.js";

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
        showAuthPrompt({
            title: "Sign in to view profile",
            message: "Sign in or register to view your profile details.",
            redirect: "profile.html",
            preserveSourceCopy: true,
            continueRedirect: "index.html",
            closeRedirect: "index.html"
        });
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
        const departmentRow = document.getElementById("department")?.closest("p");
        if (user.user_type === "external") {
            if (departmentRow) departmentRow.style.display = "none";
        } else {
            if (departmentRow) departmentRow.style.display = "";
            document.getElementById("department").textContent =
                `Department: ${user.department || "N/A"}`;
        }

        // ================= USER ID / ROLL NUMBER =================
        document.getElementById("id").textContent =
            user.user_type === "external"
                ? `User ID: ${user.id || "N/A"}`
                : `Roll Number: ${user.id || "N/A"}`;

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
