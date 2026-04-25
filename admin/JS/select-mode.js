import { canAccessAdmin, getStoredPowers, getStoredUser } from "../../components/JS/session.js";

const subtitle = document.getElementById("modeSubtitle");
const actions = document.getElementById("modeActions");
const user = getStoredUser();
const powers = getStoredPowers();

if (!user) {
    window.location.href = "../signin.html";
} else {
    const canUseAdmin = canAccessAdmin(user, powers);

    subtitle.textContent = canUseAdmin
        ? `Signed in as ${user.name || user.id}. Choose your working side.`
        : `Signed in as ${user.name || user.id}. Your account currently has user-side access only.`;

    actions.innerHTML = `
        <a class="primary-link" href="../index.html">User View</a>
        ${canUseAdmin ? `<a class="secondary-link" href="./admin.html">Admin Dashboard</a>` : ""}
    `;
}
