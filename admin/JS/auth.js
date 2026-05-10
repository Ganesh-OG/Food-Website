export function getUser() {
    return JSON.parse(localStorage.getItem("user"));
}

export function getPowers() {
    return JSON.parse(localStorage.getItem("powers")) || [];
}

export function hasPower(power) {
    const normalizedPowers = getNormalizedPowers();
    return ["master_control", "master_controll"].some(code => normalizedPowers.includes(code))
        || normalizedPowers.includes(String(power || "").trim().toLowerCase());
}

export function hasAnyPower(powerList) {
    const normalizedPowers = getNormalizedPowers();
    return ["master_control", "master_controll"].some(code => normalizedPowers.includes(code))
        || powerList.some(p => normalizedPowers.includes(String(p || "").trim().toLowerCase()));
}

export function hasRole(role) {
    const currentRole = normalizeRole(getUser()?.role);
    return currentRole && currentRole === normalizeRole(role);
}

export function hasAnyRole(roles = []) {
    const currentRole = normalizeRole(getUser()?.role);
    return Boolean(currentRole) && roles.some(role => currentRole === normalizeRole(role));
}

export function isAdmin() {
    const role = normalizeRole(getUser()?.role);

    return [
        "admin",
        "manager",
        "sales staff",
        "billing staff",
        "custom role"
    ].includes(role) || hasPower("master_control");
}

export function logout() {
    localStorage.clear();
    window.location.href = "../signin.html";
}

function getNormalizedPowers() {
    return getPowers().map(item => String(item || "").trim().toLowerCase());
}

function normalizeRole(role) {
    return String(role || "").trim().toLowerCase();
}
