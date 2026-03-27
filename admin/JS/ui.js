import { hasPower } from "./auth.js";

export function applyUIRules() {

    const elements = document.querySelectorAll("[data-power]");

    elements.forEach(el => {
        const power = el.getAttribute("data-power");

        if (!hasPower(power)) {
            el.style.display = "none";
        }
    });
}