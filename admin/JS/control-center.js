import { renderAdminShell, supabase, showToast, escapeHtml, askForTextDecision } from "./common.js";
import { bindDataTable, createDataTableState, renderDataTable } from "./data-table.js";
import {
    fetchRolesAndPowers,
    normalizeKeyArray,
    normalizeRoleLabel,
    getPowerKey,
    getPowerCode,
    getPowerLabel,
    fetchPowerCategories,
    fetchAccessRequests,
    createAccessRequest,
    updateAccessRequestStatus,
    applyUserAccess,
    createAccessAuditLog,
    updateRolePowers,
    createPowerDefinition,
    createPowerCategory,
    updatePowerCategory
} from "./access_requests.js";
import { isAdminRoleName } from "../../components/JS/session.js";

const POWER_REQUEST = "req_power";
const POWER_APPROVE = "approve_or_deny_power";
const POWER_APPROVE_ALIAS = "approve_oe_deny_power";
const POWER_EDIT = "edit_roles_and_power";
const POWER_VIEW_MODULE = "control_center_view";
const POWER_EDIT_MODULE = "control_center_edit";
const POWER_APPROVE_VIEW = "approve_deny_view";
const POWER_APPROVE_EDIT = "approve_deny_edit";
const POWER_ADMIN_VIEW = "edit_admins_view";
const POWER_ADMIN_EDIT = "edit_admins_edit";
const POWER_PROMOTE_VIEW = "promote_users_view";
const POWER_PROMOTE_EDIT = "promote_users_edit";
const POWER_ROLE_POWERS_VIEW = "role_powers_view";
const POWER_ROLE_POWERS_EDIT = "role_powers_edit";
const POWER_CATEGORY_VIEW = "power_categories_view";
const POWER_CATEGORY_EDIT = "power_categories_edit";
const POWER_CREATE_VIEW = "create_power_view";
const POWER_CREATE_EDIT = "create_power_edit";
const REQUIRED_POWERS = [
    POWER_VIEW_MODULE,
    POWER_EDIT_MODULE,
    POWER_APPROVE_VIEW,
    POWER_APPROVE_EDIT,
    POWER_ADMIN_VIEW,
    POWER_ADMIN_EDIT,
    POWER_PROMOTE_VIEW,
    POWER_PROMOTE_EDIT,
    POWER_ROLE_POWERS_VIEW,
    POWER_ROLE_POWERS_EDIT,
    POWER_CATEGORY_VIEW,
    POWER_CATEGORY_EDIT,
    POWER_CREATE_VIEW,
    POWER_CREATE_EDIT,
    POWER_REQUEST,
    POWER_APPROVE,
    POWER_APPROVE_ALIAS,
    POWER_EDIT
];
let currentAdmin = null;
let activePowers = [];
let roleRows = [];
let powerRows = [];
let powerCategoryRows = [];
let userRows = [];
let accessRequests = [];
let auditRows = [];
let activeDragPowerKey = "";
const powerTableState = createDataTableState({
    column: "category",
    direction: "asc"
});
const auditTableState = createDataTableState({
    column: "created_at",
    direction: "desc"
});

const CONTROL_CENTER_USER_SELECTS = [
    "id, name, email, role, additional_Powers, removed_role_powers, user_type, department, balance, dob",
    "id, name, email, role, additional_Powers, user_type, department, balance, dob",
    "id, name, email, role, additional_Powers, removed_role_powers, user_type, department",
    "id, name, email, role, additional_Powers, user_type, department",
    "id, name, email, role, additional_Powers",
    "id, name, email, role"
];

document.addEventListener("DOMContentLoaded", initControlCenter);

async function initControlCenter() {
    const view = await renderAdminShell({
        title: "Control Center",
        subtitle: "Request, approve, promote, and edit admin access with a full audit trail.",
        requiredAnyPower: REQUIRED_POWERS
    });

    if (!view?.root) return;

    currentAdmin = view.user;
    activePowers = (view.powers || []).map(power => String(power || "").trim().toLowerCase());

    await refreshControlCenterData();
    renderControlCenter(view.root);
    bindControlCenter(view.root);
}

async function refreshControlCenterData() {
    const [{ roles, roleError, powers, powerError }, categoriesRes, usersRes, requestsRes, auditRes] = await Promise.all([
        fetchRolesAndPowers(),
        fetchControlCenterPowerCategories(),
        fetchControlCenterUsers(),
        fetchAccessRequests(),
        fetchControlCenterAudit()
    ]);

    if (roleError) showToast(roleError.message || "Unable to load roles", "error");
    if (powerError) showToast(powerError.message || "Unable to load powers", "error");
    if (categoriesRes.error) showToast(categoriesRes.error.message || "Unable to load power categories", "error");
    if (usersRes.error) showToast(usersRes.error.message || "Unable to load users", "error");
    if (requestsRes.error) showToast(requestsRes.error.message || "Unable to load requests", "error");
    if (auditRes.error) showToast(auditRes.error.message || "Unable to load audit log", "error");

    roleRows = roles || [];
    powerRows = powers || [];
    powerCategoryRows = categoriesRes.data || [];
    userRows = usersRes.data || [];
    accessRequests = requestsRes.data || [];
    auditRows = auditRes.data || [];
}

async function fetchControlCenterPowerCategories() {
    const result = await fetchPowerCategories();

    if (!result.error) {
        return {
            data: (result.data || []).map(item => ({
                name: String(item.name || "").trim(),
                description: String(item.description || "").trim(),
                created_at: item.created_at || null
            })).filter(item => item.name),
            error: null
        };
    }

    const message = String(result.error.message || "").toLowerCase();
    const code = String(result.error.code || "").trim();
    const missingRelation = code === "PGRST205"
        || message.includes("could not find the table")
        || message.includes("powers_category");

    if (missingRelation) {
        return {
            data: getFallbackPowerCategoriesFromPowers(),
            error: null
        };
    }

    return {
        data: getFallbackPowerCategoriesFromPowers(),
        error: result.error
    };
}

async function fetchControlCenterAudit() {
    const result = await supabase
        .from("access_audit_log")
        .select("*")
        .order("created_at", { ascending: false });

    if (!result.error) {
        return result;
    }

    const message = String(result.error.message || "").toLowerCase();
    const code = String(result.error.code || "").trim();
    const missingRelation = code === "PGRST205"
        || message.includes("could not find the table")
        || message.includes("access_audit_log");

    if (missingRelation) {
        return { data: [], error: null };
    }

    return result;
}

async function fetchControlCenterUsers() {
    let lastError = null;

    for (const selectClause of CONTROL_CENTER_USER_SELECTS) {
        const result = await supabase
            .from("users")
            .select(selectClause)
            .order("name");

        if (!result.error) {
            return {
                data: (result.data || []).map(user => ({
                    removed_role_powers: [],
                    additional_Powers: [],
                    user_type: "",
                    department: "",
                    ...user
                })),
                error: null
            };
        }

        lastError = result.error;
    }

    return {
        data: [],
        error: lastError
    };
}

const POWER_TABLE_COLUMNS = [
    {
        key: "category",
        label: "Category",
        value: power => resolvePowerCategory(power).label
    },
    {
        key: "power_key",
        label: "power_key",
        value: power => getPowerKey(power) || "no_key",
        render: power => `<code>${escapeHtml(getPowerKey(power) || "no_key")}</code>`,
        compare: (left, right) => comparePowerKeys(getPowerKey(left), getPowerKey(right))
    },
    {
        key: "powers",
        label: "Powers",
        value: power => getPowerLabel(power) || "Unnamed Power",
        render: power => `
            <div class="control-power-name-cell">
                <strong>${escapeHtml(getPowerLabel(power) || "Unnamed Power")}</strong>
                <small>${escapeHtml(getPowerCode(power) || "no_code")}</small>
            </div>
        `
    },
    {
        key: "description",
        label: "Description",
        value: power => String(power?.description || "").trim() || "No description added.",
        render: power => `<span class="control-power-description-cell">${escapeHtml(String(power?.description || "").trim() || "No description added.")}</span>`
    }
];

const AUDIT_TABLE_COLUMNS = [
    {
        key: "target_user",
        label: "User",
        value: row => String(row.target_user_name || row.target_user_id || "N/A").trim() || "N/A",
        render: row => `
            <div class="control-power-name-cell">
                <strong>${escapeHtml(row.target_user_name || row.target_user_id || "N/A")}</strong>
                <small>${escapeHtml(row.target_user_email || "No email")}</small>
            </div>
        `
    },
    {
        key: "action_type",
        label: "Action",
        value: row => String(row.action_type || "updated").trim() || "updated",
        render: row => `<span class="tag ${auditTagClass(row.action_type)}">${escapeHtml(row.action_type || "updated")}</span>`
    },
    {
        key: "role_change",
        label: "Role",
        value: row => String(row.new_role || row.previous_role || "N/A").trim() || "N/A",
        render: row => `
            <div class="control-power-name-cell">
                <strong>${escapeHtml(row.new_role || row.previous_role || "N/A")}</strong>
                <small>${escapeHtml(row.previous_role && row.new_role && !sameText(row.previous_role, row.new_role) ? `${row.previous_role} -> ${row.new_role}` : row.previous_role || row.new_role || "N/A")}</small>
            </div>
        `
    },
    {
        key: "note",
        label: "Note",
        value: row => String(row.note || "").trim() || "No note",
        render: row => `<span class="control-power-description-cell">${escapeHtml(String(row.note || "").trim() || "No note")}</span>`
    },
    {
        key: "performed_by",
        label: "By",
        value: row => String(row.performed_by || "N/A").trim() || "N/A"
    },
    {
        key: "created_at",
        label: "Created",
        value: row => formatDateTime(row.created_at),
        compare: (left, right) => new Date(left?.created_at || 0).getTime() - new Date(right?.created_at || 0).getTime()
    }
];

function renderControlCenter(root) {
    const canViewModule = hasPower(POWER_VIEW_MODULE) || hasPower(POWER_EDIT_MODULE);
    const canRequest = hasPower(POWER_REQUEST) || canViewModule;
    const canApprove = hasPower(POWER_APPROVE_VIEW) || hasPower(POWER_APPROVE_EDIT) || hasPower(POWER_APPROVE) || hasPower(POWER_APPROVE_ALIAS) || hasPower(POWER_EDIT_MODULE);
    const canApproveEdit = hasPower(POWER_APPROVE_EDIT) || hasPower(POWER_APPROVE) || hasPower(POWER_APPROVE_ALIAS) || hasPower(POWER_EDIT_MODULE);
    const canEditAdmins = hasPower(POWER_ADMIN_VIEW) || hasPower(POWER_ADMIN_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canEditAdminsDirect = hasPower(POWER_ADMIN_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canPromote = hasPower(POWER_PROMOTE_VIEW) || hasPower(POWER_PROMOTE_EDIT) || canRequest || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canPromoteDirect = hasPower(POWER_PROMOTE_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canRolePowers = hasPower(POWER_ROLE_POWERS_VIEW) || hasPower(POWER_ROLE_POWERS_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canRolePowersEdit = hasPower(POWER_ROLE_POWERS_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canPowerCategories = hasPower(POWER_CATEGORY_VIEW) || hasPower(POWER_CATEGORY_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canPowerCategoriesEdit = hasPower(POWER_CATEGORY_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canCreatePower = hasPower(POWER_CREATE_VIEW) || hasPower(POWER_CREATE_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const canCreatePowerEdit = hasPower(POWER_CREATE_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
    const isMasterControl = hasPower("master_control");

    const sections = [
        (canViewModule && !canRequest && !canApprove && !canEditAdmins && !canPromote && !canRolePowers && !canPowerCategories && !canCreatePower) ? ["overviewSection", "Module Access"] : null,
        (canRequest && !isMasterControl) ? ["requestSection", "Request Access"] : null,
        canApprove ? ["reviewSection", "Approve / Deny"] : null,
        canEditAdmins ? ["adminSection", "Edit Admins"] : null,
        canPromote ? ["promoteSection", "Promote Users"] : null,
        canRolePowers ? ["rolePowerSection", "Add Powers To Roles"] : null,
        canPowerCategories ? ["powerCategorySection", "Manage Power Categories"] : null,
        canCreatePower ? ["createPowerSection", "Add New Power"] : null
    ].filter(Boolean);
    const requestedSection = String(window.location.hash || "").replace("#", "").trim();
    const sectionIds = sections.map(([id]) => id);
    const activeSection = sectionIds.includes(requestedSection) ? requestedSection : (sections[0]?.[0] || "requestSection");

    root.innerHTML = `
        <div class="control-center-workspace">
            <div class="control-center-layout">
                <aside class="card control-center-menu">
                    <div class="users-menu-header">
                        <p class="eyebrow">Control Flow</p>
                        <h3>Powers Control</h3>
                        <p class="muted">Use the module that matches your current access power.</p>
                    </div>
                    <div class="users-menu-list">
                        ${sections.map(([id, label]) => `
                            <button class="users-menu-item ${id === activeSection ? "active" : ""}" type="button" data-control-target="${id}">
                                ${escapeHtml(label)}
                            </button>
                        `).join("")}
                    </div>
                </aside>

                <section class="control-center-content">
                    ${(canViewModule && !canRequest && !canApprove && !canEditAdmins && !canPromote && !canRolePowers && !canPowerCategories && !canCreatePower) ? renderOverviewSection(activeSection === "overviewSection") : ""}
                    ${(canRequest && !isMasterControl) ? renderRequestSection(activeSection === "requestSection") : ""}
                    ${canApprove ? renderReviewSection(activeSection === "reviewSection", canApproveEdit) : ""}
                    ${canEditAdmins ? renderAdminSection(activeSection === "adminSection", canEditAdminsDirect) : ""}
                    ${canPromote ? renderPromoteSection(activeSection === "promoteSection", canPromoteDirect) : ""}
                    ${canRolePowers ? renderRolePowerSection(activeSection === "rolePowerSection", canRolePowersEdit) : ""}
                    ${canPowerCategories ? renderPowerCategorySection(activeSection === "powerCategorySection", canPowerCategoriesEdit) : ""}
                    ${canCreatePower ? renderCreatePowerSection(activeSection === "createPowerSection", canCreatePowerEdit) : ""}
                </section>
            </div>
        </div>
    `;
}

function renderOverviewSection(isActive) {
    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="overviewSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Control Center View</h3>
                <p class="muted">This account can open Control Center, but no request, review, or role-edit powers are assigned yet.</p>
            </div>
            <div class="empty">Assign \`control_center_edit\` or the legacy request/review/edit powers to unlock workflows here.</div>
        </section>
    `;
}

function canApproveSection() {
    return hasPower(POWER_APPROVE_EDIT) || hasPower(POWER_APPROVE) || hasPower(POWER_APPROVE_ALIAS) || hasPower(POWER_EDIT_MODULE);
}

function canEditAdminsSection() {
    return hasPower(POWER_ADMIN_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
}

function canPromoteSectionDirectly() {
    return hasPower(POWER_PROMOTE_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
}

function canEditRolePowersSection() {
    return hasPower(POWER_ROLE_POWERS_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
}

function canEditPowerCategoriesSection() {
    return hasPower(POWER_CATEGORY_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
}

function canCreatePowerSectionDirectly() {
    return hasPower(POWER_CREATE_EDIT) || hasPower(POWER_EDIT) || hasPower(POWER_EDIT_MODULE);
}

function renderRequestSection(isActive) {
    const roleOptions = getRoleOptionsMarkup("");
    const initialRolePowerKeys = getRolePowerKeys(roleRows[0]?.role_name || "");
    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="requestSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Access Request</h3>
                <p class="muted">Search a target user by ID or email, then request a role and attach extra powers when needed.</p>
            </div>
            <form id="accessRequestForm" class="stack control-form">
                <div class="control-lookup-card">
                    <label>
                        <span>Target User ID Or Email</span>
                        <div class="control-inline-search">
                            <input id="requestLookupInput" type="text" placeholder="Enter user ID or email" required>
                            <button class="btn-secondary" type="button" id="requestLookupBtn">Find</button>
                        </div>
                    </label>
                    <div id="requestLookupResult" class="control-lookup-result muted">No user selected yet.</div>
                </div>
                <label>
                    <span>Requested Role</span>
                    <select id="requestRole" required>
                        ${roleOptions}
                    </select>
                </label>
                <div>
                    <div class="control-section-title">Additional Powers</div>
                    <p class="muted">Open a topic, tick what is needed, or use Select All for that topic.</p>
                    <div class="control-topic-list" id="requestPowerGroups">
                        ${renderPowerGroups("requestPower", initialRolePowerKeys, initialRolePowerKeys, [])}
                    </div>
                </div>
                <label>
                    <span>Request Note</span>
                    <textarea id="requestNote" rows="4" placeholder="Why is this access needed?"></textarea>
                </label>
                <div class="compact-actions">
                    <button class="btn" type="submit">Submit Request</button>
                </div>
            </form>
        </section>
    `;
}

function renderReviewSection(isActive, canEditReview) {
    const pending = accessRequests.filter(row => sameText(row.status, "pending"));

    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="reviewSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Approve Or Deny</h3>
                <p class="muted">${canEditReview ? "Reviewers can approve or deny requests and every action is logged." : "This account can view review activity but cannot approve or deny requests."}</p>
            </div>

            <div class="control-request-stack">
                ${pending.length ? pending.map(renderRequestCard).join("") : `<div class="empty">No pending requests right now.</div>`}
            </div>

            <div class="control-subsection">
                <div class="control-section-title">Decision Log</div>
                <p class="muted">Every access action is listed here. Use the column menus to sort or filter the full history.</p>
                ${renderAuditTable()}
            </div>
        </section>
    `;
}

function renderAdminSection(isActive, canEditAdmins = true) {
    const admins = getAdminUsers();
    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="adminSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Edit Admins</h3>
                <p class="muted">${canEditAdmins ? "This view defaults to existing admins only. Each card starts compact and expands only when you want full edit options." : "This account can view existing admin access, but cannot directly save changes."}</p>
            </div>

            <label class="control-search">
                <span>Find Existing Admin</span>
                <input id="adminUserSearch" type="search" placeholder="Search by name, email, ID, or role">
            </label>

            <div id="adminEditorList" class="control-editor-list">
                ${admins.length ? admins.map(user => renderDirectEditor(user, "admin", canEditAdmins)).join("") : `<div class="empty">No admin users found.</div>`}
            </div>
        </section>
    `;
}

function renderPromoteSection(isActive, canEdit) {
    const promotableUsers = getPromotableUsers();
    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="promoteSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Promote Module</h3>
                <p class="muted">${canEdit ? "Promote a student or any other non-admin user directly." : "Prepare a promotion request for review."}</p>
            </div>

            <div class="control-search-shell">
                <label class="control-search">
                    <span>Find User To Promote</span>
                    <input id="promoteUserSearch" type="search" placeholder="Search by name, email, ID, or department">
                </label>
                <div class="control-search-meta">
                    <span class="tag pending">${promotableUsers.length} eligible users</span>
                    <span class="muted">Students, staff, and all non-admin accounts appear here.</span>
                </div>
            </div>

            <div id="promoteEditorList" class="control-editor-list">
                ${promotableUsers.length ? promotableUsers.map(user => renderDirectEditor(user, "promote", canEdit)).join("") : `<div class="empty">No non-admin users are available for promotion.</div>`}
            </div>
        </section>
    `;
}

function renderRolePowerSection(isActive, canEditRolePowers = true) {
    const initialRole = roleRows[0]?.role_name || "";
    const initialRolePowerKeys = getRolePowerKeys(initialRole);

    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="rolePowerSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Add Powers To Existing Roles</h3>
                <p class="muted">${canEditRolePowers ? "Select a role, then assign or remove the powers that should belong to that role by default." : "This account can view role powers, but cannot save role-level changes."}</p>
            </div>
            <form id="rolePowerForm" class="stack control-form">
                <label>
                    <span>Choose Role</span>
                    <select id="rolePowerRole" required>
                        ${getRoleOptionsMarkup(initialRole)}
                    </select>
                </label>
                <div>
                    <div class="control-section-title">Role Powers</div>
                    <p class="muted">These selections will be saved into the role itself, not as per-user extra powers.</p>
                    <div class="control-topic-list" id="rolePowerGroups">
                        ${renderPowerGroups("rolePower", initialRolePowerKeys, [], [])}
                    </div>
                </div>
                <div class="compact-actions">
                    ${canEditRolePowers ? `<button class="btn" type="submit">Save Role Powers</button>` : ``}
                </div>
            </form>
        </section>
    `;
}

function renderCreatePowerSection(isActive, canCreatePower = true) {
    const suggestedKey = getNextPowerKey();
    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="createPowerSection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Add New Power</h3>
                <p class="muted">${canCreatePower ? "Create a new power key/code so it can be assigned to roles or users from Control Center." : "This account can view powers, but cannot create new ones."}</p>
            </div>
            <form id="createPowerForm" class="stack control-form">
                <label>
                    <span>Power Key</span>
                    <input id="createPowerKey" type="text" value="${escapeHtml(suggestedKey)}" placeholder="Example: Power039" readonly class="readonly-field" required>
                </label>
                <label>
                    <span>Power Code</span>
                    <input id="createPowerCode" type="text" placeholder="Example: category_delete" required>
                </label>
                <label>
                    <span>Category</span>
                    <select id="createPowerCategory" required>
                        ${getPowerCategoryOptionsMarkup("")}
                    </select>
                </label>
                <label>
                    <span>Description</span>
                    <textarea id="createPowerDescription" rows="4" placeholder="What this power allows"></textarea>
                </label>
                <div class="compact-actions">
                    ${canCreatePower ? `<button class="btn" type="submit">Create Power</button>` : ``}
                </div>
            </form>
            <div class="control-subsection">
                <div class="control-section-title">Existing Powers</div>
                ${powerRows.length ? renderExistingPowersTable() : `<div class="empty">No powers found.</div>`}
            </div>
        </section>
    `;
}

function renderPowerCategorySection(isActive, canEditCategories = true) {
    return `
        <section class="card users-panel ${isActive ? "active" : ""}" id="powerCategorySection" ${isActive ? "" : "hidden"}>
            <div class="users-panel-header">
                <h3>Manage Power Categories</h3>
                <p class="muted">${canEditCategories ? "Create reusable categories for powers, then edit names and descriptions from one place." : "This account can view power categories, but cannot edit them."}</p>
            </div>
            <form id="powerCategoryForm" class="stack control-form">
                <label>
                    <span>Category Name</span>
                    <input id="powerCategoryName" type="text" placeholder="Example: Site Management" required>
                </label>
                <label>
                    <span>Description</span>
                    <input id="powerCategoryDescription" type="text" placeholder="Optional description">
                </label>
                <div class="compact-actions">
                    ${canEditCategories ? `<button class="btn" type="submit">Add Category</button>` : ``}
                </div>
            </form>
            <div class="control-subsection">
                <div class="control-section-title">Existing Categories</div>
                <div class="control-audit-list">
                    ${powerCategoryRows.length ? powerCategoryRows.map(renderPowerCategoryCard).join("") : `<div class="empty">No power categories found.</div>`}
                </div>
            </div>
        </section>
    `;
}

function renderPowerCategoryCard(category) {
    const name = String(category?.name || "").trim();
    const description = String(category?.description || "").trim();
    const usageCount = powerRows.filter(power => sameText(power.category, name)).length;
    const selectedPowerKeys = getPowerKeysForCategory(name);

    return `
        <article class="list-item control-editor-card" data-category-name="${escapeHtml(name)}">
            <button class="control-editor-summary" type="button" data-editor-toggle data-category-drop-target="${escapeHtml(name)}">
                <div>
                    <strong>${escapeHtml(name)}</strong>
                </div>
                <div class="control-editor-tags">
                    <span class="tag pending">${usageCount} power(s)</span>
                    <span class="control-editor-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
            </button>

            <div class="control-editor-body" hidden>
                <div class="control-editor-grid">
                    <label>
                        <span>Category Name</span>
                        <input type="text" data-category-edit-name value="${escapeHtml(name)}">
                    </label>
                    <label>
                        <span>Description</span>
                        <input type="text" data-category-edit-description value="${escapeHtml(description)}" placeholder="Optional description">
                    </label>
                </div>
                <div class="control-section-title">Category Powers</div>
                <div class="control-topic-list" data-category-power-groups>
                    ${renderCategoryManagementPowerGroups(name, selectedPowerKeys)}
                </div>
                <div class="compact-actions control-editor-actions">
                    <span class="tag pending">${usageCount} power(s)</span>
                    <button class="btn" type="button" data-category-save="${escapeHtml(name)}">Save Category</button>
                </div>
            </div>
        </article>
    `;
}

function renderExistingPowersTable() {
    return renderDataTable({
        tableId: "control-center-powers",
        columns: POWER_TABLE_COLUMNS,
        rows: powerRows,
        state: powerTableState,
        emptyMessage: "No powers match the current filter.",
        tableClassName: "control-existing-power-table"
    });
}

function renderAuditTable() {
    return renderDataTable({
        tableId: "control-center-audit",
        columns: AUDIT_TABLE_COLUMNS,
        rows: auditRows,
        state: auditTableState,
        emptyMessage: "No reviewed requests yet.",
        tableClassName: "control-existing-power-table"
    });
}

function comparePowerKeys(leftKey, rightKey) {
    const left = String(leftKey || "").trim();
    const right = String(rightKey || "").trim();
    const leftMatch = left.match(/^([^\d]*)(\d+)$/);
    const rightMatch = right.match(/^([^\d]*)(\d+)$/);

    if (leftMatch && rightMatch) {
        const prefixCompare = compareTextValues(leftMatch[1], rightMatch[1]);
        if (prefixCompare !== 0) return prefixCompare;
        return Number(leftMatch[2]) - Number(rightMatch[2]);
    }

    return compareTextValues(left, right);
}

function compareTextValues(left, right) {
    return String(left || "").localeCompare(String(right || ""), undefined, {
        sensitivity: "base",
        numeric: true
    });
}

function renderRequestCard(row) {
    const requestedKeys = normalizeKeyArray(row.requested_power_keys);
    const targetUser = findUserById(row.user_id);
    const rolePowerKeys = getRolePowerKeys(row.requested_role_name);
    const finalExtraKeys = requestedKeys.filter(key => !rolePowerKeys.includes(key));
    const requestedLabels = finalExtraKeys.length
        ? finalExtraKeys.map(key => escapeHtml(resolvePowerLabelByKey(key))).join(", ")
        : "No extra powers";

    return `
        <article class="list-item control-request-card" data-request-id="${escapeHtml(row.id)}">
            <div class="control-request-head">
                <div>
                    <strong>${escapeHtml(row.user_name || row.user_id)}</strong>
                    <p class="muted">${escapeHtml(row.user_email || "")}</p>
                </div>
                <span class="tag pending">Pending</span>
            </div>
            <div class="control-request-grid">
                <div><span class="muted">Current Role</span><strong>${escapeHtml(row.current_role_name || targetUser?.role || "N/A")}</strong></div>
                <div><span class="muted">Requested Role</span><strong>${escapeHtml(row.requested_role_name || "N/A")}</strong></div>
                <div><span class="muted">Requested By</span><strong>${escapeHtml(row.requested_by || "N/A")}</strong></div>
                <div><span class="muted">Created</span><strong>${escapeHtml(formatDateTime(row.created_at))}</strong></div>
            </div>
            <div class="control-request-powers">
                <span class="muted">Extra powers after role dedupe</span>
                <p>${requestedLabels}</p>
            </div>
            <div class="control-request-note">
                <span class="muted">Note</span>
                <p>${escapeHtml(row.request_note || "No note added.")}</p>
            </div>
            <div class="compact-actions">
                <button class="btn" type="button" data-request-action="approve" data-request-id="${escapeHtml(row.id)}">Approve</button>
                <button class="btn-danger" type="button" data-request-action="deny" data-request-id="${escapeHtml(row.id)}">Deny</button>
            </div>
        </article>
    `;
}

function renderDirectEditor(user, mode, canEdit = true) {
    const roleMarkup = getRoleOptionsMarkup(user.role);
    const { additionalKeys, removedRoleKeys } = getStoredPowerOverrides(user.role, user.additional_Powers, user.removed_role_powers);
    const roleLabel = user.role || "N/A";
    const actionLabel = canEdit ? (mode === "promote" ? "Promote User" : "Save Access") : "Send Promotion Request";
    const initialRolePowerKeys = getRolePowerKeys(user.role);
    const effectiveSelectedKeys = getEffectivePowerKeys(user.role, additionalKeys, removedRoleKeys);

    return `
        <article class="list-item control-editor-card" data-editor-mode="${escapeHtml(mode)}" data-user-id="${escapeHtml(user.id)}" data-user-name="${escapeHtml(user.name || "")}" data-user-email="${escapeHtml(user.email || "")}" data-initial-role="${escapeHtml(user.role || "")}" data-initial-additional="${escapeHtml(JSON.stringify(additionalKeys))}" data-initial-removed-role="${escapeHtml(JSON.stringify(removedRoleKeys))}">
            <button class="control-editor-summary" type="button" data-editor-toggle>
                <div>
                    <strong>${escapeHtml(user.id)}</strong>
                    <p class="muted">${escapeHtml(user.email || "No email")}</p>
                </div>
                <span class="control-editor-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
            </button>

            <div class="control-editor-body" hidden>
                <div class="control-editor-tags">
                    <span class="tag pending">${escapeHtml(roleLabel)}</span>
                    <span class="tag disabled">${escapeHtml(user.user_type || "N/A")}</span>
                </div>
                <div class="control-editor-grid">
                    <label>
                        <span>Role</span>
                        <select data-editor-role>
                            ${roleMarkup}
                        </select>
                    </label>
                    <label>
                        <span>Department</span>
                        <input type="text" value="${escapeHtml(user.department || "")}" readonly class="readonly-field">
                    </label>
                </div>

                <div class="control-section-title">Additional Powers</div>
                <div class="control-topic-list" data-power-groups>
                    ${renderPowerGroups(`editor-${user.id}`, effectiveSelectedKeys, initialRolePowerKeys, removedRoleKeys)}
                </div>

                <div class="control-role-hint" data-role-hint>
                    ${renderRoleHint(user.role, additionalKeys)}
                </div>

                <div class="compact-actions control-editor-actions">
                    <button class="btn" type="button" data-editor-save="${escapeHtml(user.id)}" hidden>${escapeHtml(actionLabel)}</button>
                    ${canEdit && mode === "admin" ? `<button class="btn-secondary" type="button" data-editor-reset hidden>Reset</button>` : ""}
                    <button class="btn-ghost" type="button" data-editor-discard hidden>Discard</button>
                </div>
            </div>
        </article>
    `;
}

function bindControlCenter(root) {
    root.querySelectorAll("[data-control-target]").forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.controlTarget;
            if (targetId) {
                window.location.hash = targetId;
            }
            root.querySelectorAll("[data-control-target]").forEach(item => item.classList.toggle("active", item === button));
            root.querySelectorAll(".users-panel").forEach(panel => {
                const isActive = panel.id === targetId;
                panel.hidden = !isActive;
                panel.classList.toggle("active", isActive);
            });
        });
    });

    bindInteractiveScope(root);

    document.getElementById("accessRequestForm")?.addEventListener("submit", handleAccessRequestSubmit);
    document.getElementById("rolePowerForm")?.addEventListener("submit", handleRolePowerSubmit);
    document.getElementById("powerCategoryForm")?.addEventListener("submit", handlePowerCategorySubmit);
    document.getElementById("createPowerForm")?.addEventListener("submit", handleCreatePowerSubmit);
    document.getElementById("requestRole")?.addEventListener("change", event => {
        const role = event.currentTarget.value;
        const scope = document.getElementById("requestPowerGroups");
        if (!scope) return;
        const manualSelected = sanitizeAdditionalKeys(role, getCheckedPowerKeys(scope));
        scope.innerHTML = renderPowerGroups("requestPower", getEffectivePowerKeys(role, manualSelected, []), getRolePowerKeys(role), []);
        bindInteractiveScope(scope);
    });
    document.getElementById("rolePowerRole")?.addEventListener("change", event => {
        const role = event.currentTarget.value;
        const scope = document.getElementById("rolePowerGroups");
        if (!scope) return;
        scope.innerHTML = renderPowerGroups("rolePower", getRolePowerKeys(role), [], []);
        bindInteractiveScope(scope);
    });
    root.querySelectorAll("[data-category-save]").forEach(button => {
        button.addEventListener("click", () => handlePowerCategorySave(button));
    });
    bindCategoryDragAndDrop(root);
    bindDataTable(root, {
        tableId: "control-center-powers",
        columns: POWER_TABLE_COLUMNS,
        rows: powerRows,
        state: powerTableState
    }, () => rerenderControlCenterView(root, "createPowerSection"));
    bindDataTable(root, {
        tableId: "control-center-audit",
        columns: AUDIT_TABLE_COLUMNS,
        rows: auditRows,
        state: auditTableState
    }, () => rerenderControlCenterView(root, "reviewSection"));
    document.getElementById("requestLookupBtn")?.addEventListener("click", resolveRequestLookup);
    document.getElementById("requestLookupInput")?.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            resolveRequestLookup();
        }
    });
    document.getElementById("adminUserSearch")?.addEventListener("input", event => {
        filterEditorCards("adminEditorList", getAdminUsers(), event.target.value, true);
    });

    document.getElementById("promoteUserSearch")?.addEventListener("input", event => {
        filterEditorCards("promoteEditorList", getPromotableUsers(), event.target.value, false);
    });
}

function rerenderControlCenterView(root, hash = "createPowerSection") {
    const activePanel = root.querySelector(".users-panel.active");
    const activePanelId = activePanel?.id || hash;
    const panelScrollTop = activePanel?.scrollTop || 0;
    const pageScrollX = window.scrollX;
    const pageScrollY = window.scrollY;

    renderControlCenter(root);
    bindControlCenter(root);

    const nextPanel = root.querySelector(`#${activePanelId}`);
    if (nextPanel) {
        nextPanel.scrollTop = panelScrollTop;
    }

    window.scrollTo(pageScrollX, pageScrollY);

    if (hash) {
        const nextHash = `#${hash}`;
        if (window.location.hash !== nextHash) {
            history.replaceState(null, "", nextHash);
        }
    }
}

async function handleRolePowerSubmit(event) {
    event.preventDefault();

    if (!canEditRolePowersSection()) {
        showToast("You don't have power to edit role powers", "error");
        return;
    }

    const roleName = document.getElementById("rolePowerRole")?.value || "";
    if (!roleName) {
        showToast("Choose a role first", "error");
        return;
    }

    const selectedKeys = getCheckedPowerKeys(event.currentTarget);
    const payload = Array.from(new Set(selectedKeys.map(item => String(item || "").trim()).filter(Boolean)));
    const { error } = await updateRolePowers(roleName, payload);

    if (error) {
        showToast(error.message || "Unable to update role powers", "error");
        return;
    }

    await createAccessAuditLog({
        target_user_id: currentAdmin?.id || "role-management",
        target_user_name: roleName,
        target_user_email: null,
        action_type: "powers_changed",
        previous_role: roleName,
        new_role: roleName,
        added_power_keys: payload,
        removed_power_keys: [],
        final_power_keys: payload,
        performed_by: currentAdmin?.email || currentAdmin?.id || "admin",
        performed_by_user_id: currentAdmin?.id || null,
        note: `Role powers updated for ${roleName}`
    });

    showToast("Role powers updated");
    await rerenderControlCenter();
    window.location.hash = "rolePowerSection";
}

async function handleCreatePowerSubmit(event) {
    event.preventDefault();

    if (!canCreatePowerSectionDirectly()) {
        showToast("You don't have power to create powers", "error");
        return;
    }

    const keyInput = document.getElementById("createPowerKey");
    const codeInput = document.getElementById("createPowerCode");
    const categoryInput = document.getElementById("createPowerCategory");
    const descriptionInput = document.getElementById("createPowerDescription");

    const key = String(keyInput?.value || "").trim();
    const code = String(codeInput?.value || "").trim().toLowerCase().replace(/\s+/g, "_");
    const category = String(categoryInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();

    if (!key || !code || !category) {
        showToast("Power key, code, and category are required", "error");
        return;
    }

    const duplicate = powerRows.some(power =>
        sameText(getPowerKey(power), key) || sameText(getPowerCode(power), code)
    );

    if (duplicate) {
        showToast("That power key or code already exists", "error");
        return;
    }

    const { error } = await createPowerDefinition({
        key,
        code,
        category,
        description: description || null,
        created_at: new Date().toISOString()
    });

    if (error) {
        showToast(error.message || "Unable to create power", "error");
        return;
    }

    showToast("Power created");
    event.currentTarget.reset();
    await rerenderControlCenter();
    window.location.hash = "createPowerSection";
}

async function handlePowerCategorySubmit(event) {
    event.preventDefault();

    if (!canEditPowerCategoriesSection()) {
        showToast("You don't have power to create power categories", "error");
        return;
    }

    const nameInput = document.getElementById("powerCategoryName");
    const descriptionInput = document.getElementById("powerCategoryDescription");
    const name = String(nameInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();

    if (!name) {
        showToast("Category name is required", "error");
        return;
    }

    if (powerCategoryRows.some(item => sameText(item.name, name))) {
        showToast("That category already exists", "error");
        return;
    }

    const { error } = await createPowerCategory({
        name,
        description: description || null,
        created_at: new Date().toISOString()
    });

    if (error) {
        showToast(error.message || "Unable to create power category", "error");
        return;
    }

    showToast("Power category added");
    event.currentTarget.reset();
    await rerenderControlCenter();
    window.location.hash = "powerCategorySection";
}

async function handlePowerCategorySave(button) {
    if (!canEditPowerCategoriesSection()) {
        showToast("You don't have power to update power categories", "error");
        return;
    }

    const card = button.closest("[data-category-name]");
    if (!card) return;

    const originalName = String(card.dataset.categoryName || "").trim();
    const nextName = String(card.querySelector("[data-category-edit-name]")?.value || "").trim();
    const nextDescription = String(card.querySelector("[data-category-edit-description]")?.value || "").trim();
    const selectedPowerKeys = getCheckedPowerKeys(card);
    const previousCategoryPowerKeys = getPowerKeysForCategory(originalName);

    if (!originalName || !nextName) {
        showToast("Category name is required", "error");
        return;
    }

    const duplicate = powerCategoryRows.some(item =>
        !sameText(item.name, originalName) && sameText(item.name, nextName)
    );

    if (duplicate) {
        showToast("Another category already uses that name", "error");
        return;
    }

    const { error } = await updatePowerCategory(originalName, {
        name: nextName,
        description: nextDescription || null
    });

    if (error) {
        showToast(error.message || "Unable to update power category", "error");
        return;
    }

    if (!sameText(originalName, nextName)) {
        const renameResult = await supabase
            .from("powers")
            .update({ category: nextName })
            .eq("category", originalName);

        if (renameResult.error) {
            showToast(renameResult.error.message || "Category renamed but linked powers could not be updated", "error");
            return;
        }
    }

    if (selectedPowerKeys.length) {
        const assignResult = await supabase
            .from("powers")
            .update({ category: nextName })
            .in("key", selectedPowerKeys);

        if (assignResult.error) {
            showToast(assignResult.error.message || "Category updated but selected powers could not be assigned", "error");
            return;
        }
    }

    const defaultCategoryName = getDefaultPowerCategoryName(nextName);
    const removedPowerKeys = previousCategoryPowerKeys.filter(key => !selectedPowerKeys.includes(key));
    if (removedPowerKeys.length) {
        const removalPayload = defaultCategoryName ? { category: defaultCategoryName } : { category: null };
        const removeResult = await supabase
            .from("powers")
            .update(removalPayload)
            .in("key", removedPowerKeys);

        if (removeResult.error) {
            showToast(removeResult.error.message || "Category updated but removed powers could not be reassigned", "error");
            return;
        }
    }

    showToast("Power category updated");
    await rerenderControlCenter();
    window.location.hash = "powerCategorySection";
}

async function movePowerToCategory(powerKey, targetCategoryName) {
    if (!canEditPowerCategoriesSection()) {
        showToast("You don't have power to move powers between categories", "error");
        return;
    }

    const power = powerRows.find(item => sameText(getPowerKey(item), powerKey));
    if (!power || !targetCategoryName) {
        showToast("Unable to move that power", "error");
        return;
    }

    if (sameText(power.category, targetCategoryName)) {
        return;
    }

    const { error } = await supabase
        .from("powers")
        .update({ category: targetCategoryName })
        .eq("key", powerKey);

    if (error) {
        showToast(error.message || "Unable to move power to category", "error");
        return;
    }

    showToast(`${getPowerLabel(power)} moved to ${targetCategoryName}`);
    await rerenderControlCenter();
    window.location.hash = "powerCategorySection";
}

function bindInteractiveScope(scope) {
    scope.querySelectorAll(".control-editor-card").forEach(card => {
        syncEditorRoleHint(card);
        syncEditorDirtyState(card);
    });

    scope.querySelectorAll("[data-editor-toggle]").forEach(button => {
        button.addEventListener("click", () => {
            const card = button.closest(".control-editor-card");
            const body = card?.querySelector(".control-editor-body");
            if (!card || !body) return;
            const willOpen = body.hidden;
            body.hidden = !willOpen;
            card.classList.toggle("open", willOpen);
        });
    });

    scope.querySelectorAll(".control-topic-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const topic = button.closest(".control-topic");
            topic?.classList.toggle("open");
        });
    });

    scope.querySelectorAll("[data-select-all-topic]").forEach(button => {
        button.addEventListener("click", () => toggleTopicCheckboxes(button, true));
    });

    scope.querySelectorAll("[data-clear-topic]").forEach(button => {
        button.addEventListener("click", () => toggleTopicCheckboxes(button, false));
    });

    scope.querySelectorAll("[data-editor-role]").forEach(select => {
        select.addEventListener("change", () => {
            const card = select.closest(".control-editor-card");
            syncEditorPowerGroups(card);
            syncEditorRoleHint(card);
            syncEditorDirtyState(card);
        });
    });

    scope.querySelectorAll('.control-topic input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener("change", () => {
            const card = checkbox.closest(".control-editor-card");
            syncEditorRoleHint(card);
            syncEditorDirtyState(card);
        });
    });

    scope.querySelectorAll("[data-request-action]").forEach(button => {
        button.addEventListener("click", () => handleRequestDecision(button.dataset.requestAction, button.dataset.requestId));
    });

    scope.querySelectorAll("[data-editor-save]").forEach(button => {
        button.addEventListener("click", () => handleDirectEditorSave(button.closest(".control-editor-card")));
    });

    scope.querySelectorAll("[data-editor-reset]").forEach(button => {
        button.addEventListener("click", () => handleDirectEditorReset(button.closest(".control-editor-card")));
    });

    scope.querySelectorAll("[data-editor-discard]").forEach(button => {
        button.addEventListener("click", () => {
            const card = button.closest(".control-editor-card");
            if (!card) return;
            const initialRole = card.dataset.initialRole || "";
            const initialAdditional = parseStoredArray(card.dataset.initialAdditional);
            const initialRemovedRole = parseStoredArray(card.dataset.initialRemovedRole);
            const roleSelect = card.querySelector("[data-editor-role]");
            if (roleSelect) {
                roleSelect.value = initialRole;
            }
            const powerGroups = card.querySelector("[data-power-groups]");
            if (powerGroups) {
                powerGroups.innerHTML = renderPowerGroups(
                    `editor-${card.dataset.userId}`,
                    getEffectivePowerKeys(initialRole, initialAdditional, initialRemovedRole),
                    getRolePowerKeys(initialRole),
                    initialRemovedRole
                );
                bindInteractiveScope(powerGroups);
            }
            syncEditorRoleHint(card);
            syncEditorDirtyState(card);
        });
    });
}

async function handleAccessRequestSubmit(event) {
    event.preventDefault();

    const targetId = document.getElementById("accessRequestForm")?.dataset.selectedUserId || "";
    const requestedRole = document.getElementById("requestRole")?.value;
    const requestNote = String(document.getElementById("requestNote")?.value || "").trim();
    const targetUser = findUserById(targetId);
    if (!targetUser) {
        showToast("Find and select a valid target user first", "error");
        return;
    }

    const selectedKeys = getCheckedPowerKeys(event.currentTarget);
    const finalAdditionalKeys = sanitizeAdditionalKeys(requestedRole, selectedKeys);

    const { error } = await createAccessRequest({
        user_id: targetUser.id,
        user_name: targetUser.name,
        user_email: targetUser.email,
        current_role_name: targetUser.role,
        requested_role_name: requestedRole,
        requested_power_keys: finalAdditionalKeys,
        status: "pending",
        request_note: requestNote || null,
        requested_by: currentAdmin?.email || currentAdmin?.id || "admin"
    });

    if (error) {
        showToast(error.message || "Unable to submit request", "error");
        return;
    }

    await createAccessAuditLog({
        target_user_id: targetUser.id,
        target_user_name: targetUser.name,
        target_user_email: targetUser.email,
        action_type: "request_submitted",
        previous_role: targetUser.role,
        new_role: requestedRole,
        added_power_keys: finalAdditionalKeys,
        removed_power_keys: [],
        final_power_keys: finalAdditionalKeys,
        performed_by: currentAdmin?.email || currentAdmin?.id || "admin",
        performed_by_user_id: currentAdmin?.id || null,
        note: requestNote || null
    });

    showToast("Access request submitted");
    await rerenderControlCenter();
}

function resolveRequestLookup() {
    const input = document.getElementById("requestLookupInput");
    const result = document.getElementById("requestLookupResult");
    const form = document.getElementById("accessRequestForm");
    const token = String(input?.value || "").trim().toLowerCase();
    if (!result || !form) return;

    if (!token) {
        form.dataset.selectedUserId = "";
        result.className = "control-lookup-result muted";
        result.textContent = "Enter a user ID or email to continue.";
        return;
    }

    const user = userRows.find(item =>
        String(item.id || "").trim().toLowerCase() === token
        || String(item.email || "").trim().toLowerCase() === token
    );

    if (!user) {
        form.dataset.selectedUserId = "";
        result.className = "control-lookup-result error";
        result.textContent = "No user found for that ID or email.";
        return;
    }

    form.dataset.selectedUserId = user.id;
    result.className = "control-lookup-result success";
    result.innerHTML = `
        <strong>${escapeHtml(user.name || user.id)}</strong>
        <span>${escapeHtml(user.id)} • ${escapeHtml(user.email || "No email")} • ${escapeHtml(user.role || user.user_type || "user")}</span>
    `;
}

async function handleRequestDecision(action, requestId) {
    if (!canApproveSection()) {
        showToast("You don't have power to approve or deny requests", "error");
        return;
    }

    const requestRow = accessRequests.find(row => String(row.id) === String(requestId));
    if (!requestRow) {
        showToast("Request not found", "error");
        return;
    }

    const targetUser = findUserById(requestRow.user_id);
    if (!targetUser) {
        showToast("Target user no longer exists", "error");
        return;
    }

    const notePrompt = action === "approve"
        ? await askForTextDecision({
            title: "Approve Request",
            message: `Approve access request for ${targetUser.name || targetUser.id}?`,
            confirmLabel: "Approve",
            promptLabel: "Review note",
            placeholder: "Approved by master control"
        })
        : await askForTextDecision({
            title: "Deny Request",
            message: `Deny access request for ${targetUser.name || targetUser.id}?`,
            confirmLabel: "Deny",
            promptLabel: "Reason",
            placeholder: "Reason for denial",
            required: true
        });

    if (!notePrompt.confirmed) return;

    const { additionalKeys: previousAdditional } = getStoredPowerOverrides(
        targetUser.role,
        targetUser.additional_Powers,
        targetUser.removed_role_powers
    );
    const requestedAdditional = sanitizeAdditionalKeys(requestRow.requested_role_name, normalizeKeyArray(requestRow.requested_power_keys));

    if (action === "approve") {
        const updateRes = await applyUserAccess({
            userId: targetUser.id,
            role: requestRow.requested_role_name,
            additionalPowerKeys: requestedAdditional
        });

        if (updateRes.error) {
            showToast(updateRes.error.message || "Unable to approve request", "error");
            return;
        }
    }

    const status = action === "approve" ? "approved" : "denied";
    const { error } = await updateAccessRequestStatus(requestRow.id, {
        status,
        reviewed_by: currentAdmin?.email || currentAdmin?.id || "admin",
        reviewed_note: notePrompt.value || null,
        reviewed_at: new Date().toISOString()
    });

    if (error) {
        showToast(error.message || `Unable to ${action} request`, "error");
        return;
    }

    await createAccessAuditLog({
        target_user_id: targetUser.id,
        target_user_name: targetUser.name,
        target_user_email: targetUser.email,
        action_type: status,
        previous_role: targetUser.role,
        new_role: action === "approve" ? requestRow.requested_role_name : targetUser.role,
        added_power_keys: action === "approve" ? diffKeys(requestedAdditional, previousAdditional) : [],
        removed_power_keys: action === "approve" ? diffKeys(previousAdditional, requestedAdditional) : [],
        final_power_keys: action === "approve" ? requestedAdditional : previousAdditional,
        request_id: requestRow.id,
        performed_by: currentAdmin?.email || currentAdmin?.id || "admin",
        performed_by_user_id: currentAdmin?.id || null,
        note: notePrompt.value || null
    });

    showToast(`Request ${status}`);
    await rerenderControlCenter();
}

async function handleDirectEditorSave(card) {
    if (!card) return;

    const userId = card.dataset.userId;
    const mode = card.dataset.editorMode;
    const user = findUserById(userId);
    if (!user) {
        showToast("User not found", "error");
        return;
    }

    const nextRole = card.querySelector("[data-editor-role]")?.value;
    const selectedKeys = getCheckedPowerKeys(card);
    const removedRolePowerKeys = getRemovedRolePowerKeys(nextRole, card);
    const sanitizedAdditional = await resolveRoleChangeAdditionalPowers({
        user,
        nextRole,
        selectedKeys,
        removedRolePowerKeys
    });
    if (sanitizedAdditional === null) {
        return;
    }
    const {
        additionalKeys: previousAdditional,
        removedRoleKeys: previousRemovedRole
    } = getStoredPowerOverrides(user.role, user.additional_Powers, user.removed_role_powers);

    const canDirectSave = mode === "admin" ? canEditAdminsSection() : canPromoteSectionDirectly();

    if (canDirectSave) {
        const { error } = await applyUserAccess({
            userId: user.id,
            role: nextRole,
            additionalPowerKeys: sanitizedAdditional,
            removedRolePowerKeys
        });

        if (error) {
            showToast(error.message || "Unable to update access", "error");
            return;
        }

        await createAccessAuditLog({
            target_user_id: user.id,
            target_user_name: user.name,
            target_user_email: user.email,
            action_type: mode === "promote" ? "promoted" : roleOrPowerAction(user.role, nextRole, previousAdditional, sanitizedAdditional),
            previous_role: user.role,
            new_role: nextRole,
            added_power_keys: diffKeys(sanitizedAdditional, previousAdditional),
            removed_power_keys: Array.from(new Set([
                ...diffKeys(previousAdditional, sanitizedAdditional),
                ...diffKeys(removedRolePowerKeys, previousRemovedRole)
            ])),
            final_power_keys: sanitizedAdditional,
            performed_by: currentAdmin?.email || currentAdmin?.id || "admin",
            performed_by_user_id: currentAdmin?.id || null,
            note: mode === "promote" ? "Promoted from Control Center" : "Access updated from Control Center"
        });

        showToast(mode === "promote" ? "User promoted" : "Access updated");
        await rerenderControlCenter();
        return;
    }

    if (!hasPower(POWER_REQUEST)) {
        showToast("You don't have power to edit or request access changes", "error");
        return;
    }

    const note = window.prompt("Add a note for this promotion request", "Requested from Control Center") || "";
    const { error } = await createAccessRequest({
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        current_role_name: user.role,
        requested_role_name: nextRole,
        requested_power_keys: sanitizedAdditional,
        status: "pending",
        request_note: note.trim() || null,
        requested_by: currentAdmin?.email || currentAdmin?.id || "admin"
    });

    if (error) {
        showToast(error.message || "Unable to submit promotion request", "error");
        return;
    }

    await createAccessAuditLog({
        target_user_id: user.id,
        target_user_name: user.name,
        target_user_email: user.email,
        action_type: "request_submitted",
        previous_role: user.role,
        new_role: nextRole,
        added_power_keys: sanitizedAdditional,
        removed_power_keys: [],
        final_power_keys: sanitizedAdditional,
        performed_by: currentAdmin?.email || currentAdmin?.id || "admin",
        performed_by_user_id: currentAdmin?.id || null,
        note: note.trim() || null
    });

    showToast("Promotion request submitted");
    await rerenderControlCenter();
}

async function handleDirectEditorReset(card) {
    if (!card) return;

    const userId = card.dataset.userId;
    const user = findUserById(userId);
    if (!user) {
        showToast("User not found", "error");
        return;
    }

    if (!canEditAdminsSection()) {
        showToast("You don't have power to reset access", "error");
        return;
    }

    const nextRole = card.querySelector("[data-editor-role]")?.value || user.role || "";
    const {
        additionalKeys: previousAdditional,
        removedRoleKeys: previousRemovedRole
    } = getStoredPowerOverrides(user.role, user.additional_Powers, user.removed_role_powers);

    const { error } = await applyUserAccess({
        userId: user.id,
        role: nextRole,
        additionalPowerKeys: [],
        removedRolePowerKeys: []
    });

    if (error) {
        showToast(error.message || "Unable to reset role powers", "error");
        return;
    }

    await createAccessAuditLog({
        target_user_id: user.id,
        target_user_name: user.name,
        target_user_email: user.email,
        action_type: sameText(user.role, nextRole) ? "powers_reset" : "role_changed",
        previous_role: user.role,
        new_role: nextRole,
        added_power_keys: [],
        removed_power_keys: Array.from(new Set([
            ...previousAdditional,
            ...previousRemovedRole
        ])),
        final_power_keys: [],
        performed_by: currentAdmin?.email || currentAdmin?.id || "admin",
        performed_by_user_id: currentAdmin?.id || null,
        note: "Reset to role-defined powers from Control Center"
    });

    showToast("Reset to role powers");
    await rerenderControlCenter();
}

async function resolveRoleChangeAdditionalPowers({ user, nextRole, selectedKeys, removedRolePowerKeys = [] }) {
    const sanitizedSelected = sanitizeAdditionalKeys(nextRole, selectedKeys);
    const { additionalKeys: previousAdditional } = getStoredPowerOverrides(
        user.role,
        user.additional_Powers,
        user.removed_role_powers
    );
    const roleChanged = !sameText(user.role, nextRole);

    if (!roleChanged || !previousAdditional.length) {
        return sanitizedSelected;
    }

    const carryForwardCandidates = sanitizeAdditionalKeys(nextRole, previousAdditional)
        .filter(key => !removedRolePowerKeys.includes(key))
        .filter(key => sanitizedSelected.includes(key));

    if (!carryForwardCandidates.length) {
        return sanitizedSelected;
    }

    const chosenKeys = await openExcessPowersDialog({
        user,
        nextRole,
        carryForwardCandidates
    });

    if (chosenKeys === null) {
        return null;
    }

    return sanitizedSelected.filter(key => !carryForwardCandidates.includes(key)).concat(chosenKeys);
}

function openExcessPowersDialog({ user, nextRole, carryForwardCandidates = [] }) {
    return new Promise(resolve => {
        const existing = document.getElementById("controlExcessPowerModal");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "controlExcessPowerModal";
        overlay.className = "admin-modal-overlay control-power-modal";
        overlay.innerHTML = `
            <div class="admin-modal-card control-power-modal-card" role="dialog" aria-modal="true" aria-labelledby="controlExcessPowerTitle">
                <div class="admin-modal-header">
                    <h3 id="controlExcessPowerTitle">Review Excess Powers</h3>
                    <button class="admin-modal-close" type="button" aria-label="Close">
                        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
                <p class="muted">This user had extra powers under the previous role. The new role is <strong>${escapeHtml(nextRole)}</strong>. Choose which excess powers Aries should keep.</p>
                <div class="control-power-review-list">
                    ${carryForwardCandidates.map(key => `
                        <label class="control-power-review-option">
                            <span>
                                <strong>${escapeHtml(resolvePowerLabelByKey(key))}</strong>
                                <small>${escapeHtml(getPowerDescriptionByKey(key))}</small>
                            </span>
                            <input type="checkbox" value="${escapeHtml(key)}" checked>
                        </label>
                    `).join("")}
                </div>
                <div class="control-power-review-meta">
                    <span class="tag pending">${carryForwardCandidates.length} excess power(s)</span>
                    <span class="muted">${escapeHtml(user.name || user.id)} previously had these outside the new role.</span>
                </div>
                <div class="admin-modal-actions">
                    <button class="btn-ghost" type="button" data-modal-action="remove-all">Remove All</button>
                    <button class="btn-secondary" type="button" data-modal-action="cancel">Cancel</button>
                    <button class="btn" type="button" data-modal-action="confirm">Save Selection</button>
                </div>
            </div>
        `;

        const close = (value) => {
            overlay.remove();
            resolve(value);
        };

        overlay.querySelector(".admin-modal-close")?.addEventListener("click", () => close(null));
        overlay.addEventListener("click", event => {
            if (event.target === overlay) close(null);
        });
        overlay.querySelector('[data-modal-action="cancel"]')?.addEventListener("click", () => close(null));
        overlay.querySelector('[data-modal-action="remove-all"]')?.addEventListener("click", () => close([]));
        overlay.querySelector('[data-modal-action="confirm"]')?.addEventListener("click", () => {
            const chosen = Array.from(overlay.querySelectorAll('input[type="checkbox"]:checked'))
                .map(input => String(input.value || "").trim())
                .filter(Boolean);
            close(chosen);
        });

        document.body.appendChild(overlay);
    });
}

function filterEditorCards(containerId, users, query, adminOnly) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const filtered = users.filter(user => {
        const haystack = [user.id, user.name, user.email, user.role, user.department].join(" ").toLowerCase();
        return haystack.includes(String(query || "").trim().toLowerCase());
    });

    const allowDirectEdit = adminOnly ? canEditAdminsSection() : canPromoteSectionDirectly();
    container.innerHTML = filtered.length
        ? filtered.map(user => renderDirectEditor(user, adminOnly ? "admin" : "promote", allowDirectEdit)).join("")
        : `<div class="empty">No matching users found.</div>`;

    bindInteractiveScope(container);
}

async function rerenderControlCenter() {
    await refreshControlCenterData();
    const root = document.getElementById("pageContent");
    if (!root) return;
    renderControlCenter(root);
    bindControlCenter(root);
}

function renderPowerGroups(prefix, selectedKeys = [], rolePowerKeys = [], removedRolePowerKeys = []) {
    return getGroupedPowers().map(group => `
        <article class="control-topic">
            <button class="control-topic-toggle" type="button">
                <span>${escapeHtml(group.label)}</span>
                <small>${countSelectedGroupPowers(group.items, selectedKeys)} owned</small>
            </button>
            <div class="control-topic-body">
                <div class="compact-actions control-topic-actions">
                    <button class="btn-ghost users-inline-button" type="button" data-select-all-topic>Select All</button>
                    <button class="btn-ghost users-inline-button" type="button" data-clear-topic>Clear</button>
                </div>
                <div class="control-power-grid">
                    ${group.items.map(power => {
                        const key = getPowerKey(power);
                        const code = getPowerCode(power);
                        const checked = selectedKeys.includes(key) ? "checked" : "";
                        const locked = rolePowerKeys.includes(key);
                        const removed = removedRolePowerKeys.includes(key);
                        return `
                            <label class="control-power-option ${locked ? "is-role-power" : ""} ${removed ? "is-removed-role-power" : ""}">
                                <span class="control-power-copy">
                                    <strong>${escapeHtml(getPowerLabel(power))}${locked ? ` <em class="control-role-power-chip">${removed ? "Role Off" : "Role"}</em>` : ""}</strong>
                                    <small>${escapeHtml(power.description || code)}</small>
                                </span>
                                <input type="checkbox" name="${escapeHtml(prefix)}Power" value="${escapeHtml(key)}" data-power-code="${escapeHtml(code)}" data-role-power="${locked ? "true" : "false"}" ${checked}>
                            </label>
                        `;
                    }).join("")}
                </div>
            </div>
        </article>
    `).join("");
}

function getGroupedPowers() {
    const groups = new Map();

    powerRows.forEach(power => {
        const category = resolvePowerCategory(power);
        if (!groups.has(category.key)) {
            groups.set(category.key, {
                label: category.label,
                items: []
            });
        }
        groups.get(category.key).items.push(power);
    });

    return Array.from(groups.values());
}

function renderCategoryManagementPowerGroups(ownerCategoryName, selectedKeys = []) {
    return getGroupedPowers().map(group => `
        <article class="control-topic">
            <button class="control-topic-toggle" type="button">
                <span>${escapeHtml(group.label)}</span>
                <small>${countSelectedGroupPowers(group.items, selectedKeys)} owned</small>
            </button>
            <div class="control-topic-body">
                <div class="compact-actions control-topic-actions">
                    <button class="btn-ghost users-inline-button" type="button" data-select-all-topic>Select All</button>
                    <button class="btn-ghost users-inline-button" type="button" data-clear-topic>Clear</button>
                </div>
                <div class="control-power-grid">
                    ${group.items.map(power => {
                        const key = getPowerKey(power);
                        const code = getPowerCode(power);
                        const checked = selectedKeys.includes(key) ? "checked" : "";
                        const currentCategory = resolvePowerCategory(power).label;
                        return `
                            <label class="control-power-option is-draggable-power" draggable="true" data-draggable-power="${escapeHtml(key)}" data-power-current-category="${escapeHtml(currentCategory)}" data-power-label="${escapeHtml(getPowerLabel(power))}">
                                <span class="control-power-copy">
                                    <strong>${escapeHtml(getPowerLabel(power))}</strong>
                                    <small>${escapeHtml(power.description || code)}</small>
                                </span>
                                <input type="checkbox" name="category-${escapeHtml(normalizeRoleLabel(ownerCategoryName).replace(/\s+/g, "-"))}Power" value="${escapeHtml(key)}" data-power-code="${escapeHtml(code)}" ${checked}>
                            </label>
                        `;
                    }).join("")}
                </div>
            </div>
        </article>
    `).join("");
}

function getPowerCategoryOptionsMarkup(selectedCategory = "") {
    const options = powerCategoryRows.length ? powerCategoryRows : getFallbackPowerCategoriesFromPowers();
    return options.map(category => {
        const name = String(category?.name || "").trim();
        return `<option value="${escapeHtml(name)}" ${sameText(name, selectedCategory) ? "selected" : ""}>${escapeHtml(name)}</option>`;
    }).join("");
}

function getFallbackPowerCategoriesFromPowers() {
    return Array.from(new Set(
        powerRows
            .map(power => resolvePowerCategory(power).label)
            .filter(Boolean)
    )).map(name => ({
        name,
        description: ""
    }));
}

function getNextPowerKey() {
    const highestNumber = powerRows.reduce((maxValue, power) => {
        const match = String(getPowerKey(power) || "").trim().match(/^power0*(\d+)$/i);
        if (!match) return maxValue;
        return Math.max(maxValue, Number(match[1] || 0));
    }, 0);

    return `Power${String(highestNumber + 1).padStart(3, "0")}`;
}

function getPowerKeysForCategory(categoryName) {
    return powerRows
        .filter(power => sameText(power.category, categoryName))
        .map(power => getPowerKey(power))
        .filter(Boolean);
}

function getDefaultPowerCategoryName(excludedName = "") {
    const generalCategory = powerCategoryRows.find(item => sameText(item.name, "General"));
    if (generalCategory && !sameText(generalCategory.name, excludedName)) {
        return generalCategory.name;
    }

    const fallback = powerCategoryRows.find(item => !sameText(item.name, excludedName));
    return String(fallback?.name || "").trim();
}

function countSelectedGroupPowers(items = [], selectedKeys = []) {
    const selectedSet = new Set((selectedKeys || []).map(item => String(item || "").trim()));
    return (items || []).reduce((count, power) => (
        selectedSet.has(getPowerKey(power)) ? count + 1 : count
    ), 0);
}

function getEffectivePowerKeys(roleName, additionalKeys = [], removedRolePowerKeys = []) {
    return Array.from(new Set([
        ...getRolePowerKeys(roleName).filter(key => !removedRolePowerKeys.includes(key)),
        ...normalizeKeyArray(additionalKeys)
    ]));
}

function parseStoredArray(value) {
    try {
        return JSON.parse(String(value || "[]"));
    } catch {
        return [];
    }
}

function syncEditorPowerGroups(card) {
    if (!card) return;
    const role = card.querySelector("[data-editor-role]")?.value || "";
    const manualSelected = sanitizeAdditionalKeys(role, getCheckedPowerKeys(card));
    const removedRolePowerKeys = getRemovedRolePowerKeys(role, card);
    const powerGroups = card.querySelector("[data-power-groups]");
    if (!powerGroups) return;
    powerGroups.innerHTML = renderPowerGroups(
        `editor-${card.dataset.userId}`,
        getEffectivePowerKeys(role, manualSelected, removedRolePowerKeys),
        getRolePowerKeys(role),
        removedRolePowerKeys
    );
    bindInteractiveScope(powerGroups);
}

function syncEditorDirtyState(card) {
    if (!card) return;
    const initialRole = card.dataset.initialRole || "";
    const initialAdditional = parseStoredArray(card.dataset.initialAdditional);
    const initialRemovedRole = parseStoredArray(card.dataset.initialRemovedRole);
    const currentRole = card.querySelector("[data-editor-role]")?.value || "";
    const currentAdditional = sanitizeAdditionalKeys(currentRole, getCheckedPowerKeys(card));
    const currentRemovedRole = getRemovedRolePowerKeys(currentRole, card);
    const isDirty = !sameText(initialRole, currentRole)
        || JSON.stringify([...initialAdditional].sort()) !== JSON.stringify([...currentAdditional].sort())
        || JSON.stringify([...initialRemovedRole].sort()) !== JSON.stringify([...currentRemovedRole].sort());

    const saveButton = card.querySelector("[data-editor-save]");
    const resetButton = card.querySelector("[data-editor-reset]");
    const discardButton = card.querySelector("[data-editor-discard]");
    const canReset = currentAdditional.length > 0 || currentRemovedRole.length > 0;
    if (saveButton) saveButton.hidden = !isDirty;
    if (resetButton) resetButton.hidden = !canReset;
    if (discardButton) discardButton.hidden = !isDirty;
}

function getRemovedRolePowerKeys(roleName, scope) {
    const roleKeys = getRolePowerKeys(roleName);
    const checkedSet = new Set(
        Array.from(scope?.querySelectorAll('input[type="checkbox"]:checked') || [])
            .map(input => String(input.value || "").trim())
    );

    return roleKeys.filter(key => !checkedSet.has(key));
}

function resolvePowerCategory(power) {
    const explicitCategory = String(power?.category || "").trim();
    if (explicitCategory) {
        return {
            key: normalizeRoleLabel(explicitCategory).replace(/\s+/g, "-"),
            label: explicitCategory
        };
    }

    return getPowerTopic(getPowerCode(power));
}

function getPowerTopic(code) {
    const normalized = String(code || "").toLowerCase();
    if (normalized.startsWith("product_")) return { key: "products", label: "Products" };
    if (normalized.startsWith("wallet_")) return { key: "wallet", label: "Wallet" };
    if (normalized.startsWith("message_")) return { key: "messages", label: "Messages" };
    if (normalized.startsWith("user_") || normalized.includes("password")) return { key: "users", label: "Users And Passwords" };
    if (normalized.startsWith("order_") || normalized.startsWith("orders_") || normalized.startsWith("dashboard_") || normalized === "sales_dashboard") return { key: "orders", label: "Orders And Sales" };
    if (normalized.startsWith("update_")) return { key: "site", label: "Site Management" };
    if (["site_control", "about_edit", "slider_manage", "footer_manage", "category_manage", "loader_manage", "site_logo_manage"].includes(normalized)) {
        return { key: "site", label: "Site Management" };
    }
    if (normalized.startsWith("control_center_")) return { key: "access", label: "Access Control" };
    if (["master_control", "master_controll", "req_power", "approve_or_deny_power", "approve_oe_deny_power", "edit_roles_and_power"].includes(normalized)) {
        return { key: "access", label: "Access Control" };
    }
    return { key: "general", label: "General" };
}

function getRoleOptionsMarkup(selectedRole) {
    return roleRows.map(role => {
        const roleName = String(role.role_name || "").trim();
        return `<option value="${escapeHtml(roleName)}" ${sameText(roleName, selectedRole) ? "selected" : ""}>${escapeHtml(role.display_name || roleName)}</option>`;
    }).join("");
}

function getAdminUsers() {
    return userRows.filter(user => isAdminRoleName(user.role));
}

function getPromotableUsers() {
    return userRows.filter(user => !getAdminUsers().some(admin => admin.id === user.id));
}

function findUserById(userId) {
    return userRows.find(user => String(user.id) === String(userId)) || null;
}

function getRolePowerKeys(roleName) {
    const roleRow = roleRows.find(role => sameText(role.role_name, roleName));
    return normalizeKeyArray(roleRow?.role_powers);
}

function sanitizeAdditionalKeys(roleName, selectedKeys = []) {
    const roleKeys = getRolePowerKeys(roleName);
    return Array.from(new Set(
        selectedKeys
            .map(item => String(item || "").trim())
            .filter(Boolean)
            .filter(key => !isLegacyRemovedPowerMarker(key))
            .filter(key => !roleKeys.includes(key))
    ));
}

function isLegacyRemovedPowerMarker(value) {
    return /^rm_power_/i.test(String(value || "").trim());
}

function markerTokenToCandidates(marker) {
    const rawToken = String(marker || "")
        .trim()
        .replace(/^rm_power_/i, "")
        .trim();

    if (!rawToken) return [];

    const normalized = rawToken.toLowerCase();
    const candidates = new Set([rawToken, normalized]);

    if (/^\d+$/.test(rawToken)) {
        candidates.add(`Power${rawToken.padStart(3, "0")}`);
        candidates.add(`power${rawToken.padStart(3, "0")}`);
    }

    const powerMatch = normalized.match(/^power0*(\d+)$/i);
    if (powerMatch) {
        candidates.add(`Power${powerMatch[1].padStart(3, "0")}`);
        candidates.add(`power${powerMatch[1].padStart(3, "0")}`);
    }

    return Array.from(candidates);
}

function resolveLegacyRemovedPowerKey(marker, roleName = "") {
    const roleKeySet = new Set(getRolePowerKeys(roleName));
    const powerByKey = new Map(
        powerRows.map(item => [String(getPowerKey(item)).trim().toLowerCase(), String(getPowerKey(item)).trim()])
    );
    const powerByCode = new Map(
        powerRows.map(item => [String(getPowerCode(item)).trim().toLowerCase(), String(getPowerKey(item)).trim()])
    );

    return markerTokenToCandidates(marker)
        .map(candidate => powerByKey.get(String(candidate || "").trim().toLowerCase())
            || powerByCode.get(String(candidate || "").trim().toLowerCase()))
        .filter(Boolean)
        .find(key => !roleKeySet.size || roleKeySet.has(key)) || null;
}

function getStoredPowerOverrides(roleName, additionalValue, removedRoleValue) {
    const additionalKeys = [];
    const removedRoleKeys = normalizeKeyArray(removedRoleValue);

    normalizeKeyArray(additionalValue).forEach(entry => {
        const rawEntry = String(entry || "").trim();
        if (!rawEntry) return;

        if (!isLegacyRemovedPowerMarker(rawEntry)) {
            additionalKeys.push(rawEntry);
            return;
        }

        const resolvedKey = resolveLegacyRemovedPowerKey(rawEntry, roleName);
        if (resolvedKey) {
            removedRoleKeys.push(resolvedKey);
        }
    });

    return {
        additionalKeys: Array.from(new Set(additionalKeys)),
        removedRoleKeys: Array.from(new Set(removedRoleKeys))
    };
}

function resolvePowerLabelByKey(key) {
    const power = powerRows.find(item => String(getPowerKey(item)) === String(key));
    return power ? getPowerLabel(power) : key;
}

function getPowerDescriptionByKey(key) {
    const power = powerRows.find(item => String(getPowerKey(item)) === String(key));
    return String(power?.description || getPowerCode(power) || key);
}

function getCheckedPowerKeys(scope) {
    return Array.from(scope.querySelectorAll('input[type="checkbox"]:checked'))
        .map(input => String(input.value || "").trim())
        .filter(Boolean);
}

function toggleTopicCheckboxes(button, nextState) {
    const topic = button.closest(".control-topic");
    if (!topic) return;
    topic.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(input => {
        input.checked = nextState;
    });
    const card = button.closest(".control-editor-card");
    syncEditorRoleHint(card);
    syncEditorDirtyState(card);
}

function bindCategoryDragAndDrop(scope) {
    scope.querySelectorAll("[data-draggable-power]").forEach(item => {
        item.addEventListener("dragstart", event => {
            const powerKey = String(item.dataset.draggablePower || "").trim();
            activeDragPowerKey = powerKey;
            item.classList.add("is-dragging-power");
            event.dataTransfer?.setData("text/plain", powerKey);
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
            }
        });

        item.addEventListener("dragend", () => {
            activeDragPowerKey = "";
            item.classList.remove("is-dragging-power");
            document.querySelectorAll(".is-power-drop-target").forEach(target => {
                target.classList.remove("is-power-drop-target");
            });
        });
    });

    scope.querySelectorAll("[data-category-drop-target]").forEach(target => {
        target.addEventListener("dragover", event => {
            if (!activeDragPowerKey) return;
            event.preventDefault();
            target.classList.add("is-power-drop-target");
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = "move";
            }
        });

        target.addEventListener("dragleave", () => {
            target.classList.remove("is-power-drop-target");
        });

        target.addEventListener("drop", async event => {
            event.preventDefault();
            target.classList.remove("is-power-drop-target");
            const powerKey = String(event.dataTransfer?.getData("text/plain") || activeDragPowerKey || "").trim();
            const targetCategoryName = String(target.dataset.categoryDropTarget || "").trim();
            if (!powerKey || !targetCategoryName) return;
            await movePowerToCategory(powerKey, targetCategoryName);
        });
    });
}

function syncEditorRoleHint(card) {
    if (!card) return;
    const hint = card.querySelector("[data-role-hint]");
    const role = card.querySelector("[data-editor-role]")?.value;
    const selected = getCheckedPowerKeys(card);
    if (!hint) return;
    hint.innerHTML = renderRoleHint(role, selected);
}

function renderRoleHint(roleName, selectedKeys) {
    const rolePowerKeys = getRolePowerKeys(roleName);
    const duplicates = selectedKeys.filter(key => rolePowerKeys.includes(key));
    const finalKeys = sanitizeAdditionalKeys(roleName, selectedKeys);
    const normalizedRole = normalizeRoleLabel(roleName);

    if (["student", "staff"].includes(normalizedRole) && finalKeys.length) {
        return `<span class="control-hint warning">Student or staff role is selected. Extra powers will be saved only if you keep them checked.</span>`;
    }

    if (duplicates.length) {
        return `<span class="control-hint">Duplicate powers already included in the role will be skipped automatically: ${escapeHtml(duplicates.map(resolvePowerLabelByKey).join(", "))}.</span>`;
    }

    if (!finalKeys.length) {
        return `<span class="control-hint">No extra powers beyond the selected role.</span>`;
    }

    return `<span class="control-hint success">${finalKeys.length} extra power(s) will stay outside the base role.</span>`;
}

function diffKeys(source, base) {
    return Array.from(new Set(source.filter(item => !base.includes(item))));
}

function roleOrPowerAction(previousRole, nextRole, previousKeys, nextKeys) {
    if (!sameText(previousRole, nextRole)) return "role_changed";
    if (JSON.stringify(previousKeys) !== JSON.stringify(nextKeys)) return "powers_changed";
    return "powers_changed";
}

function hasPower(code) {
    const normalized = String(code || "").trim().toLowerCase();
    const aliases = normalized === POWER_APPROVE ? [POWER_APPROVE, POWER_APPROVE_ALIAS] : [normalized];
    return activePowers.includes("master_control")
        || activePowers.includes("master_controll")
        || aliases.some(alias => activePowers.includes(alias));
}

function sameText(first, second) {
    return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function formatDateTime(value) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IN");
}

function auditTagClass(actionType) {
    const normalized = String(actionType || "").trim().toLowerCase();
    if (normalized.includes("approved") || normalized.includes("promoted")) return "enabled";
    if (normalized.includes("denied")) return "cancelled";
    if (normalized.includes("request")) return "pending";
    return "complete";
}
