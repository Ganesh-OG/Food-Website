import { getUser, isAdmin, hasPower, hasAnyPower, hasRole, hasAnyRole } from "./auth.js";

export function protectPage({
    adminOnly = false,
    requiredPower = null,
    requiredAnyPower = [],
    requiredRole = null,
    requiredAnyRole = []
} = {}) {

    const user = getUser();

    if (!user) {
        window.location.href = "../signin.html";
        return;
    }

    const type = user.user_type?.toLowerCase();

    if (type === "external") {
        window.location.href = "../index.html";
        return;
    }

    if (adminOnly && !isAdmin()) {
        window.location.href = "../index.html";
        return;
    }

    if (requiredRole && !hasRole(requiredRole)) {
        alert("Access Denied");
        window.location.href = "../index.html";
        return;
    }

    if (requiredAnyRole.length && !hasAnyRole(requiredAnyRole)) {
        alert("Access Denied");
        window.location.href = "../index.html";
        return;
    }

    if (requiredPower && !hasPower(requiredPower)) {
        alert("Access Denied");
        window.location.href = "../index.html";
        return;
    }

    if (requiredAnyPower.length && !hasAnyPower(requiredAnyPower)) {
        alert("Access Denied");
        window.location.href = "../index.html";
    }
}
