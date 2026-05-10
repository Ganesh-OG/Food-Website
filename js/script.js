import {
    buildOrbitLoaderMarkup,
    ensureOrbitLoaderStyles,
    normalizeLoaderConfig,
    setLoaderBaseConfig
} from "../components/JS/loader_config.js";

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 DOM loaded → Initializing loader...");
    setupLoader();
});


// ================= LOADER SETUP =================
async function setupLoader() {
    let loaderEl = document.querySelector(".loader");
    const activeTheme = document.body?.dataset.theme || document.documentElement?.dataset.theme || "light";
    const loaderBackdrop = activeTheme === "dark" ? "#111111" : "#ffffff";
    const pageReadyPromise = waitForCriticalPageReadiness();
    const windowLoadedPromise = waitForWindowLoad();
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
    const minimumLoaderTimePromise = waitMinimumLoaderLoop(loaderConfig);

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
        background: loaderBackdrop,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "9999"
    });

    ensureOrbitLoaderStyles();
    renderOrbitLoader(loaderEl, loaderConfig);

    // Hide only after one full loader loop and critical page readiness.
    Promise.all([windowLoadedPromise, pageReadyPromise, minimumLoaderTimePromise]).then(() => {
        console.log("🌍 Page ready → hiding loader");
        hideLoader(loaderEl);
    });

    // Safety fallback only for unexpected stalls.
    setTimeout(() => {
        if (loaderEl.style.display !== "none") {
            console.log("⏱️ Emergency fallback reached → forcing loader hide");
            hideLoader(loaderEl);
        }
    }, 15000);
}

function renderOrbitLoader(loaderEl, config) {
    loaderEl.innerHTML = buildOrbitLoaderMarkup(config, { assetBasePath: "" });
}

function waitMinimumLoaderLoop(config) {
    const cycleSeconds = Number(config?.cycleSeconds);
    const orbitSeconds = Number(config?.orbitSeconds);
    const minSeconds = Math.max(
        Number.isFinite(cycleSeconds) ? cycleSeconds : 0,
        Number.isFinite(orbitSeconds) ? orbitSeconds : 0,
        1.5
    );

    return new Promise(resolve => {
        window.setTimeout(resolve, Math.ceil(minSeconds * 1000));
    });
}

function waitForWindowLoad() {
    if (document.readyState === "complete") {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        window.addEventListener("load", resolve, { once: true });
    });
}

function waitForCriticalPageReadiness() {
    const requiredEvents = [];

    if (document.getElementById("headerContainer")) {
        requiredEvents.push("header:ready");
    }

    if (document.getElementById("footerContainer")) {
        requiredEvents.push("footer:ready");
    }

    if (document.getElementById("aboutContent") || document.getElementById("stepsContainer")) {
        requiredEvents.push("about:ready");
    }

    if (!requiredEvents.length) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        const pending = new Set(requiredEvents);
        const cleanup = [];

        const finish = () => {
            cleanup.forEach(([eventName, handler]) => {
                document.removeEventListener(eventName, handler);
            });
            resolve();
        };

        pending.forEach(eventName => {
            const handler = () => {
                pending.delete(eventName);
                if (!pending.size) {
                    finish();
                }
            };

            cleanup.push([eventName, handler]);
            document.addEventListener(eventName, handler, { once: true });
        });

        setTimeout(finish, 12000);
    });
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
