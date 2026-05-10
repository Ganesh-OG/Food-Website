import { hasPower, hasAnyPower, hasRole, hasAnyRole } from "./auth.js";

export function applyUIRules() {

    const elements = document.querySelectorAll("[data-power]");

    elements.forEach(el => {
        const power = el.getAttribute("data-power");

        if (!hasPower(power)) {
            el.style.display = "none";
        }
    });

    document.querySelectorAll("[data-any-power]").forEach(el => {
        const powers = String(el.getAttribute("data-any-power") || "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);

        if (powers.length && !hasAnyPower(powers)) {
            el.style.display = "none";
        }
    });

    document.querySelectorAll("[data-role]").forEach(el => {
        const role = el.getAttribute("data-role");
        if (role && !hasRole(role)) {
            el.style.display = "none";
        }
    });

    document.querySelectorAll("[data-any-role]").forEach(el => {
        const roles = String(el.getAttribute("data-any-role") || "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);

        if (roles.length && !hasAnyRole(roles)) {
            el.style.display = "none";
        }
    });
}
