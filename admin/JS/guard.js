import { getUser, isAdmin, hasPower } from "./auth.js";

export function protectPage({ adminOnly = false, requiredPower = null }) {

    const user = getUser();

    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    const type = user.user_type?.toLowerCase();

    if (type === "external") {
        window.location.href = "../home.html";
        return;
    }

    if (adminOnly && !isAdmin()) {
        window.location.href = "../home.html";
        return;
    }

    if (requiredPower && !hasPower(requiredPower)) {
        alert("Access Denied");
        window.location.href = "../home.html";
    }
}