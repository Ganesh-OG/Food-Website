export function getUser() {
    return JSON.parse(localStorage.getItem("user"));
}

export function getPowers() {
    return JSON.parse(localStorage.getItem("powers")) || [];
}

export function hasPower(power) {
    return getPowers().includes(power);
}

export function hasAnyPower(powerList) {
    return powerList.some(p => getPowers().includes(p));
}

export function isAdmin() {
    const role = getUser()?.role?.toLowerCase();

    return [
        "admin",
        "manager",
        "sales staff",
        "billing staff",
        "custom role"
    ].includes(role);
}

export function logout() {
    localStorage.clear();
    window.location.href = "../login.html";
}