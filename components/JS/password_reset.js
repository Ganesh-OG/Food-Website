import { supabase } from "./config.js";

let userData;

// ===== POPUP =====
function showPopup(msg, success = false) {

    const popup = document.getElementById("popup");
    const text = document.getElementById("popupMessage");

    text.textContent = msg;

    popup.classList.remove("success");
    if (success) popup.classList.add("success");

    popup.style.display = "block";
}

// CLOSE POPUP
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("popupClose").onclick = () => {
        document.getElementById("popup").style.display = "none";
    };
});

// ===== LOAD =====
document.addEventListener("DOMContentLoaded", async () => {

    const localUser = JSON.parse(localStorage.getItem("user"));

    if (!localUser) {
        showPopup("Please login first");
        setTimeout(() => window.location.href = "index.html", 2000);
        return;
    }

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", localUser.email)
        .single();

    if (error) {
        showPopup("Error loading user");
        return;
    }

    userData = data;

    document.getElementById("email").value = userData.email;

    // 🔥 INIT: Hide all password fields by default
    const fields = [
        { inputId: "current_password", iconId: "current_passwordEyeIcon" },
        { inputId: "new_password", iconId: "new_passwordEyeIcon" },
        { inputId: "confirm_password", iconId: "confirm_passwordEyeIcon" }
    ];
    fields.forEach(field => {
        const input = document.getElementById(field.inputId);
        const icon = document.getElementById(field.iconId);
        if (input && icon) {
            input.type = "password";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    });

    setupValidation();
    setupToggle();
    setupSubmit();
});



// ===== VALIDATION =====
function setupValidation() {

    const current = document.getElementById("current_password");
    const newP = document.getElementById("new_password");
    const confirm = document.getElementById("confirm_password");

    const currentTick = document.getElementById("currentPasswordTick");
    const confirmTick = document.getElementById("confirmPasswordTick");

    // CURRENT PASSWORD
    current.addEventListener("input", () => {

        if (!current.value) {
            currentTick.innerHTML = "";
            current.type = "password";
            document.getElementById("current_passwordEyeIcon").classList.remove("fa-eye");
            document.getElementById("current_passwordEyeIcon").classList.add("fa-eye-slash");
            return;
        }

        currentTick.innerHTML =
            current.value === userData.password
                ? `<i class="fa-solid fa-circle-check" style="color:green"></i>`
                : `<i class="fa-solid fa-circle-xmark" style="color:red"></i>`;
    });


    // NEW PASSWORD
    newP.addEventListener("input", () => {

        if (!newP.value) {
            newP.style.borderColor = "#ddd";
            newP.type = "password";
            document.getElementById("new_passwordEyeIcon").classList.remove("fa-eye");
            document.getElementById("new_passwordEyeIcon").classList.add("fa-eye-slash");
            return;
        }

        newP.style.borderColor =
            newP.value.length >= 6 ? "green" : "red";
    });


    // CONFIRM PASSWORD
    confirm.addEventListener("input", () => {

        if (!confirm.value) {
            confirmTick.innerHTML = "";
            confirm.type = "password";
            document.getElementById("confirm_passwordEyeIcon").classList.remove("fa-eye");
            document.getElementById("confirm_passwordEyeIcon").classList.add("fa-eye-slash");
            return;
        }

        confirmTick.innerHTML =
            newP.value === confirm.value
                ? `<i class="fa-solid fa-circle-check" style="color:green"></i>`
                : `<i class="fa-solid fa-circle-xmark" style="color:red"></i>`;
    });

}


// ===== TOGGLE FIXED - INDEPENDENT PER FIELD =====
function setupToggle() {

    const fields = [
        { inputId: "current_password", iconId: "current_passwordEyeIcon" },
        { inputId: "new_password", iconId: "new_passwordEyeIcon" },
        { inputId: "confirm_password", iconId: "confirm_passwordEyeIcon" }
    ];

    fields.forEach(field => {

        const input = document.getElementById(field.inputId);
        const icon = document.getElementById(field.iconId);

        if (!input || !icon) return;

        icon.addEventListener("click", () => {

            // Toggle ONLY this field - independent!
            const isHidden = input.type === "password";

            if (isHidden) {
                // Show text
                input.type = "text";
                icon.classList.remove("fa-eye-slash");
                icon.classList.add("fa-eye");
            } else {
                // Hide as password
                input.type = "password";
                icon.classList.remove("fa-eye");
                icon.classList.add("fa-eye-slash");
            }

            input.blur();
            input.focus();
        });
    });
}



// ===== SUBMIT =====
function setupSubmit() {

    document.getElementById("updateForm").addEventListener("submit", async (e) => {

        e.preventDefault();

        const current = document.getElementById("current_password").value;
        const newPass = document.getElementById("new_password").value;
        const confirm = document.getElementById("confirm_password").value;

        if (current !== userData.password) {
            showPopup("Current password incorrect");
            return;
        }

        if (newPass.length < 6) {
            showPopup("Password must be at least 6 characters");
            return;
        }

        if (newPass !== confirm) {
            showPopup("Passwords do not match");
            return;
        }

        const { error } = await supabase
            .from("users")
            .update({
                password: newPass,
                last_reset_by: userData.email,
                last_reset_at: new Date().toISOString()
            })
            .eq("email", userData.email);

        if (error) {
            showPopup("Error updating password");
            return;
        }

        let count = 5;

        const interval = setInterval(() => {
            showPopup(`Password updated! Logging out in ${count}...`, true);
            count--;

            if (count < 0) {
                clearInterval(interval);
                localStorage.removeItem("user");
                window.location.href = "index.html";
            }
        }, 1000);
    });
}