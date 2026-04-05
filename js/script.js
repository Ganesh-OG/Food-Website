import { supabase } from "../components/JS/config.js";

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 DOM loaded → Initializing loader...");
    setupLoader();
});


// ================= LOADER SETUP =================
async function setupLoader() {
    let loaderEl = document.querySelector(".loader");

    // ✅ Create loader if not present
    if (!loaderEl) {
        console.log("🧱 Loader element not found → creating dynamically");
        loaderEl = document.createElement("div");
        loaderEl.className = "loader";
        document.body.appendChild(loaderEl);
    } else {
        console.log("✅ Loader element already exists");
    }

    // ✅ Apply clean styles
    Object.assign(loaderEl.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "9999"
    });

    // ✅ Default fallback UI
    loaderEl.innerHTML = `
    <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:20px;
    ">
        <div style="
            width:220px;
            height:220px;
            display:flex;
            align-items:center;
            justify-content:center;
        ">
            <img src="images/loader.gif" style="
                width:100%;
                height:100%;
                object-fit:contain;
            ">
        </div>

        <p style="
            font-size:16px;
            color:#444;
            font-weight:500;
        ">
        </p>
    </div>
`;

    try {
        console.log("📡 Fetching loader config from DB...");

        const { data, error } = await supabase
            .from("loader")
            .select("*")
            .limit(1); // ✅ FIXED (removed .single())

        if (error) {
            console.error("❌ Supabase error:", error);
            throw error;
        }

        console.log("✅ Loader DB data:", data);

        const row = data?.[0];

        if (row && row.Header) {
            const fileName = row.Header.replace(/\n/g, "").trim();
            console.log("📂 Clean file name:", fileName);

            const filePath = `Loader/${fileName}`;
            console.log("📁 Storage path:", filePath);

            const { data: file } = supabase
                .storage
                .from("Food-Website-Storage")
                .getPublicUrl(filePath);

            const url = file.publicUrl;
            console.log("🌐 Public URL:", url);

            // ================= FILE TYPE =================
            if (fileName.match(/\.(mp4|webm|ogg)$/i)) {
                console.log("🎥 VIDEO loader detected");

                loaderEl.innerHTML = `
                    <video autoplay muted loop playsinline style="width:120px">
                        <source src="${url}">
                    </video>
                `;
            } else {
                console.log("🖼️ IMAGE/GIF loader detected");

                loaderEl.innerHTML = `
                    <img src="${url}" style="width:90px;">
                `;
            }
        } else {
            console.warn("⚠️ No loader data → fallback used");
        }

    } catch (err) {
        console.error("🔥 Loader setup failed → fallback continues:", err);
    }

    // ================= AUTO HIDE (IMPORTANT FIX) =================

    // ✅ Hide when page fully loaded
    window.addEventListener("load", () => {
        console.log("🌍 Window loaded → hiding loader");
        hideLoader(loaderEl);
    });

    // ✅ Safety fallback (prevents infinite loading)
    setTimeout(() => {
        console.log("⏱️ Max wait reached → forcing loader hide");
        hideLoader(loaderEl);
    }, 2500);
}


// ================= HIDE LOADER =================
function hideLoader(loaderEl) {
    if (!loaderEl) return;

    console.log("🎬 Hiding loader...");

    loaderEl.style.transition = "opacity 0.5s ease";
    loaderEl.style.opacity = "0";

    setTimeout(() => {
        loaderEl.style.display = "none";
        console.log("✅ Loader hidden");
    }, 500);
}


// ================= INPUT LIMIT =================
document.querySelectorAll('input[type="number"]').forEach(numberInput => {
    numberInput.oninput = () => {
        if (numberInput.value.length > numberInput.maxLength) {
            console.log("✂️ Input truncated:", numberInput.value);
            numberInput.value = numberInput.value.slice(0, numberInput.maxLength);
        }
    };
});


// ================= PAYMENT DROPDOWN =================
document.addEventListener('DOMContentLoaded', function () {

    console.log("💳 Initializing payment dropdown...");

    const paymentOptions = document.querySelectorAll('.dropdown-content .payment-option');
    const dropdownButton = document.querySelector('.dropdown-button');

    if (!paymentOptions.length || !dropdownButton) {
        console.warn("⚠️ Payment dropdown not found (normal if not on page)");
        return;
    }

    paymentOptions.forEach(option => {

        option.addEventListener('click', function () {

            console.log("💰 Selected payment:", option.innerText.trim());

            paymentOptions.forEach(opt => opt.classList.remove('active'));

            option.classList.add('active');

            dropdownButton.innerHTML =
                '<i class="fas fa-caret-down"></i> ' + option.innerHTML;

        });

    });

});