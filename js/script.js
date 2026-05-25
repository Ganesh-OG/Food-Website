import {
    buildOrbitLoaderMarkup,
    ensureOrbitLoaderStyles,
    normalizeLoaderConfig,
    setLoaderBaseConfig
} from "../components/JS/loader_config.js";

setupLoader();


// ================= LOADER SETUP =================
async function setupLoader() {
    let loaderEl = document.querySelector(".loader");
    const activeTheme = document.body?.dataset.theme || document.documentElement?.dataset.theme || "light";
    const loaderBackdrop = activeTheme === "dark" ? "#111111" : "#ffffff";
    let loaderConfig = normalizeLoaderConfig(null);

    try {
        const baseConfigResponse = await fetch("./components/config/loader-config.json", { cache: "no-store" });
        if (baseConfigResponse.ok) {
            setLoaderBaseConfig(await baseConfigResponse.json());
        }
    } catch (error) {
        console.warn("⚠️ Could not load loader-config.json, using emergency fallback", error);
    }

    loaderConfig = normalizeLoaderConfig(null);

    if (!loaderEl) {
        loaderEl = document.createElement("div");
        loaderEl.className = "loader";
        (document.body || document.documentElement).appendChild(loaderEl);
    }

    Object.assign(loaderEl.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        background: loaderBackdrop,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "9999"
    });

    ensureOrbitLoaderStyles();
    renderOrbitLoader(loaderEl, loaderConfig);

    waitForWindowLoad().then(() => {
        hideLoader(loaderEl);
    });

    setTimeout(() => {
        if (loaderEl.style.display !== "none") {
            hideLoader(loaderEl);
        }
    }, 15000);
}

function renderOrbitLoader(loaderEl, config) {
    loaderEl.innerHTML = buildOrbitLoaderMarkup(config, { assetBasePath: "" });
}

function waitForWindowLoad() {
    if (document.readyState === "complete") {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        window.addEventListener("load", resolve, { once: true });
    });
}


// ================= HIDE LOADER =================
function hideLoader(loaderEl) {
    if (!loaderEl) return;

    loaderEl.style.transition = "opacity 0.5s ease";
    loaderEl.style.opacity = "0";

    setTimeout(() => {
        loaderEl.style.display = "none";
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
