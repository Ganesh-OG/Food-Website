export function getUser() {
    return JSON.parse(localStorage.getItem("user"));
}

export function getPowers() {
    return JSON.parse(localStorage.getItem("powers")) || [];
}

export function hasPower(power) {
    const normalizedPowers = getPowers().map(item => String(item || "").trim().toLowerCase());
    return ["master_control", "master_controll"].some(code => normalizedPowers.includes(code))
        || normalizedPowers.includes(String(power || "").trim().toLowerCase());
}

export function hasAnyPower(powerList) {
    const normalizedPowers = getPowers().map(item => String(item || "").trim().toLowerCase());
    return ["master_control", "master_controll"].some(code => normalizedPowers.includes(code))
        || powerList.some(p => normalizedPowers.includes(String(p || "").trim().toLowerCase()));
}

export function isAdmin() {
    const role = getUser()?.role?.toLowerCase();

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
