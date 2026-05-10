const THEME_STORAGE_KEY = "food-website-theme";
const DEFAULT_THEME = "light";

export function getStoredTheme() {
    const stored = String(localStorage.getItem(THEME_STORAGE_KEY) || "").trim().toLowerCase();
    return stored === "dark" ? "dark" : DEFAULT_THEME;
}

export function applyTheme(theme = getStoredTheme()) {
    const resolved = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", resolved);
    document.body?.setAttribute("data-theme", resolved);
    localStorage.setItem(THEME_STORAGE_KEY, resolved);
    syncThemeToggles(resolved);
    return resolved;
}

export function toggleTheme() {
    return applyTheme(getStoredTheme() === "dark" ? "light" : "dark");
}

export function initThemeToggle(selector = "[data-theme-toggle]") {
    const buttons = Array.from(document.querySelectorAll(selector));
    buttons.forEach(button => {
        if (button.dataset.themeBound === "true") return;
        button.dataset.themeBound = "true";
        button.addEventListener("click", () => {
            const nextTheme = toggleTheme();
            syncThemeToggles(nextTheme);
        });
    });

    const currentTheme = document.body?.dataset.theme || document.documentElement.dataset.theme || getStoredTheme();
    syncThemeToggles(currentTheme);
}

export function bootTheme() {
    applyTheme(getStoredTheme());
}

function syncThemeToggles(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
        const isDark = theme === "dark";
        const nextModeLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
        button.setAttribute("aria-pressed", String(isDark));
        button.setAttribute("title", nextModeLabel);
        button.setAttribute("aria-label", nextModeLabel);
        button.innerHTML = `
            <span class="theme-toggle-icon" aria-hidden="true">${isDark ? "☀" : "☾"}</span>
        `;
        button.classList.toggle("is-dark", isDark);
    });
}

bootTheme();
