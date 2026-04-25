import { renderAdminShell, supabase, showToast, escapeHtml, initAdminFilePickers } from "./common.js";

const USER_COLUMNS = ["id", "name", "email", "dob", "balance", "department", "user_type", "role"];
const POWER_USER_ADD = "user_add";
const POWER_USER_BULK = "user_bulk_additon";
const POWER_USER_BULK_ALIAS = "user_bulk_add";
const POWER_USER_EDIT = "password_assist";
const POWER_DEFAULT_PASSWORD = "default_password";
const ROLE_SCOPED_ADD_POWERS = {
    admin: "user_add_admin",
    "billing staff": "user_add_billing_staff",
    "custom role": "user_add_custom_role",
    manager: "user_add_manager",
    "sales staff": "user_add_sales_staff"
};
const USER_ACCESS_POWERS = [
    POWER_USER_ADD,
    POWER_USER_BULK,
    POWER_USER_BULK_ALIAS,
    ...Object.values(ROLE_SCOPED_ADD_POWERS),
    POWER_USER_EDIT,
    POWER_DEFAULT_PASSWORD
];

let currentAdmin = null;
let activePowers = [];
let roleOptions = [];
let defaultPasswordRows = [];
let bulkAddRows = [];
let userEditResult = null;
let bulkEditableUsers = [];
let bulkEditLookupRows = [];
let sheetModulePromise = null;

let canAddSingleUser = false;
let canBulkAddUsers = false;
let canEditUsers = false;
let canManageDefaultPasswords = false;

document.addEventListener("DOMContentLoaded", initUsersModule);

async function initUsersModule() {
    const view = await renderAdminShell({
        title: "Users",
        subtitle: "Create users, edit existing accounts, handle batch changes, and manage role default passwords.",
        requiredAnyPower: USER_ACCESS_POWERS
    });

    if (!view?.root) return;

    const { root, hasPower, user } = view;
    currentAdmin = user;
    activePowers = (view.powers || []).map(power => String(power || "").trim().toLowerCase());

    canAddSingleUser = hasPower(POWER_USER_ADD) || hasAnyRoleScopedAddPower();
    canBulkAddUsers = hasPower(POWER_USER_BULK) || hasPower(POWER_USER_BULK_ALIAS) || hasAnyRoleScopedAddPower();
    canEditUsers = hasPower(POWER_USER_EDIT);
    canManageDefaultPasswords = hasPower(POWER_DEFAULT_PASSWORD);

    await loadRolesAndDefaultPasswords();

    const activeSection = canAddSingleUser
        ? "singleUserSection"
        : canBulkAddUsers
            ? "bulkUserSection"
            : canEditUsers
                ? "userEditSection"
                : "defaultPasswordSection";

    root.innerHTML = `
        <div class="users-workspace">
            <aside class="card users-menu">
                <div class="users-menu-header">
                    <p class="eyebrow">Controls</p>
                    <h3>User Access</h3>
                    <p class="muted">Open the workflow you need and work from one place.</p>
                </div>
                <div class="users-menu-list">
                    <button class="users-menu-item ${activeSection === "singleUserSection" ? "active" : ""}" type="button" data-user-target="singleUserSection" ${canAddSingleUser ? "" : "hidden"}>Single User Add</button>
                    <button class="users-menu-item ${activeSection === "bulkUserSection" ? "active" : ""}" type="button" data-user-target="bulkUserSection" ${canBulkAddUsers ? "" : "hidden"}>Bulk Upload</button>
                    <button class="users-menu-item ${activeSection === "userEditSection" ? "active" : ""}" type="button" data-user-target="userEditSection" ${canEditUsers ? "" : "hidden"}>User Edit</button>
                    <button class="users-menu-item ${activeSection === "bulkEditSection" ? "active" : ""}" type="button" data-user-target="bulkEditSection" ${canEditUsers ? "" : "hidden"}>Bulk User Edit</button>
                    <button class="users-menu-item ${activeSection === "defaultPasswordSection" ? "active" : ""}" type="button" data-user-target="defaultPasswordSection" ${canManageDefaultPasswords ? "" : "hidden"}>Default Passwords</button>
                </div>
            </aside>

            <section class="users-content">
                <div class="card users-panel ${activeSection === "singleUserSection" ? "active" : ""}" id="singleUserSection" ${activeSection === "singleUserSection" ? "" : "hidden"}>
                    <div class="users-panel-header">
                        <h3>Single User Add</h3>
                        <p class="muted">Create one account at a time. The default password is set from DOB.</p>
                    </div>
                    <form id="singleUserForm" class="form-grid">
                        ${renderUserFields("single")}
                        <div class="full compact-actions">
                            <button class="btn" type="submit">Create User</button>
                            <button class="btn-ghost" type="button" id="resetSingleUserForm">Discard</button>
                        </div>
                    </form>
                </div>

                <div class="card users-panel ${activeSection === "bulkUserSection" ? "active" : ""}" id="bulkUserSection" ${activeSection === "bulkUserSection" ? "" : "hidden"}>
                    <div class="users-panel-header">
                        <h3>Bulk Upload</h3>
                        <p class="muted">Upload CSV or XLSX with columns: ${USER_COLUMNS.join(", ")}.</p>
                    </div>
                    <div class="stack">
                        <input id="bulkUserFile" type="file" accept=".csv,.xlsx,.xls">
                        <div class="compact-actions">
                            <button class="btn-ghost" type="button" id="downloadUserTemplateBtn">Download CSV Template</button>
                            <button class="btn" type="button" id="confirmBulkUsersBtn" disabled>Confirm Import</button>
                            <button class="btn-ghost" type="button" id="discardBulkUsersBtn">Discard Preview</button>
                        </div>
                    </div>
                    <div id="bulkPreviewShell" class="bulk-preview-shell"></div>
                </div>

                <div class="card users-panel ${activeSection === "userEditSection" ? "active" : ""}" id="userEditSection" ${activeSection === "userEditSection" ? "" : "hidden"}>
                    <div class="users-panel-header">
                        <h3>User Edit</h3>
                        <p class="muted">Find a user by ID or email, update fields, reset the default password, or delete the account.</p>
                    </div>
                    <form id="userEditSearchForm" class="stack">
                        <input id="userEditQuery" type="text" placeholder="Enter user ID or email">
                        <div class="compact-actions">
                            <button class="btn" type="submit">Find User</button>
                            <button class="btn-ghost" type="button" id="clearUserEditBtn">Clear</button>
                        </div>
                    </form>
                    <div id="userEditResult" class="list"></div>
                </div>

                <div class="card users-panel ${activeSection === "bulkEditSection" ? "active" : ""}" id="bulkEditSection" ${activeSection === "bulkEditSection" ? "" : "hidden"}>
                    <div class="users-panel-header">
                        <h3>Bulk User Edit</h3>
                        <p class="muted">Load users by pasting IDs or emails, or upload a file with an Email or ID column.</p>
                    </div>
                    <form id="bulkEditLookupForm" class="stack">
                        <textarea id="bulkEditLookup" rows="4" placeholder="Paste user IDs or emails"></textarea>
                        <input id="bulkEditFile" type="file" accept=".csv,.xlsx,.xls,.txt">
                        <div class="compact-actions">
                            <button class="btn-ghost" type="button" id="downloadBulkEditTemplateBtn">Download Template</button>
                            <button class="btn" type="submit">Load Users</button>
                            <button class="btn-ghost" type="button" id="clearBulkEditBtn">Clear</button>
                            <button class="btn-secondary" type="button" id="saveBulkEditBtn" disabled>Save All Changes</button>
                        </div>
                    </form>
                    <div id="bulkEditResult" class="table-wrap"></div>
                </div>

                <div class="card users-panel ${activeSection === "defaultPasswordSection" ? "active" : ""}" id="defaultPasswordSection" ${activeSection === "defaultPasswordSection" ? "" : "hidden"}>
                    <div class="users-panel-header">
                        <h3>Default Passwords</h3>
                        <p class="muted">Available roles and their current default passwords are shown here. Edit any row and save or discard the change.</p>
                    </div>
                    <div id="defaultPasswordList" class="list"></div>
                </div>
            </section>
        </div>
    `;

    bindUsersPanelMenu();
    bindSingleUserForm();
    bindBulkUpload();
    bindUserEdit();
    bindBulkEdit();
    renderBulkPreview();
    renderUserEdit();
    renderBulkEditResults();
    renderDefaultPasswords();
    initAdminFilePickers(root);
}

function renderUserFields(prefix) {
    const assignableRoles = getAssignableRoleOptions();
    return `
        <label>
            <span>ID</span>
            <input type="text" id="${prefix}UserId" placeholder="Enter user ID" required>
        </label>
        <label>
            <span>Name</span>
            <input type="text" id="${prefix}UserName" placeholder="Enter name" required>
        </label>
        <label>
            <span>Email</span>
            <input type="email" id="${prefix}UserEmail" placeholder="Enter email" required>
        </label>
        <label>
            <span>DOB</span>
            <input type="text" id="${prefix}UserDob" placeholder="DD/MM/YYYY or any date format" required>
        </label>
        <label>
            <span>Balance</span>
            <input type="number" id="${prefix}UserBalance" placeholder="0" step="0.01" min="0" value="0" required>
        </label>
        <label>
            <span>Department</span>
            <input type="text" id="${prefix}UserDepartment" placeholder="Enter department (optional)">
        </label>
        <label>
            <span>User Type</span>
            <select id="${prefix}UserType" required>
                <option value="internal">internal</option>
                <option value="external">external</option>
            </select>
        </label>
        <label>
            <span>Role</span>
            <select id="${prefix}UserRole" required>
                ${assignableRoles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("")}
            </select>
        </label>
    `;
}

async function loadRolesAndDefaultPasswords() {
    const [rolesRes, defaultsRes] = await Promise.all([
        supabase.from("roles").select("role_name").order("role_name"),
        supabase.from("Default_Password").select("role_name, Default_Password, Last_Updated, Updated_By").order("role_name")
    ]);

    if (rolesRes.error) {
        showToast(rolesRes.error.message || "Unable to load roles", "error");
    }

    if (defaultsRes.error) {
        showToast(defaultsRes.error.message || "Unable to load default passwords", "error");
    }

    roleOptions = (rolesRes.data || [])
        .map(item => String(item.role_name || "").trim())
        .filter(Boolean);

    defaultPasswordRows = defaultsRes.data || [];
}

function bindUsersPanelMenu() {
    const buttons = Array.from(document.querySelectorAll("[data-user-target]"));
    const panels = Array.from(document.querySelectorAll(".users-panel"));

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.userTarget;
            buttons.forEach(item => item.classList.toggle("active", item === button));
            panels.forEach(panel => {
                const isActive = panel.id === targetId;
                panel.classList.toggle("active", isActive);
                panel.hidden = !isActive;
            });
        });
    });
}

function bindSingleUserForm() {
    const form = document.getElementById("singleUserForm");
    const resetButton = document.getElementById("resetSingleUserForm");
    if (!form || !resetButton) return;

    form.addEventListener("submit", submitSingleUser);
    resetButton.addEventListener("click", () => form.reset());
}

async function submitSingleUser(event) {
    event.preventDefault();

    const candidate = getUserFormValues("single");
    const prepared = await prepareCandidate(candidate, { mode: "single" });
    if (!prepared.ok) {
        showToast(prepared.reason, "error");
        return;
    }

    const created = await insertUserRecord(prepared.payload);
    if (!created.ok) {
        showToast(created.reason, "error");
        return;
    }

    showToast(`User ${prepared.payload.id} created`);
    event.currentTarget.reset();
}

function bindBulkUpload() {
    document.getElementById("bulkUserFile")?.addEventListener("change", handleBulkFileSelection);
    document.getElementById("downloadUserTemplateBtn")?.addEventListener("click", downloadUserTemplate);
    document.getElementById("confirmBulkUsersBtn")?.addEventListener("click", confirmBulkImport);
    document.getElementById("discardBulkUsersBtn")?.addEventListener("click", discardBulkPreview);
}

async function handleBulkFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) {
        bulkAddRows = [];
        renderBulkPreview();
        return;
    }

    try {
        const parsedRows = await parseUploadFile(file);
        bulkAddRows = [];

        for (const [index, row] of parsedRows.entries()) {
            const prepared = await prepareCandidate(mapRecordToCandidate(row), { mode: "bulk", skipExistingCheck: false });
            bulkAddRows.push({
                rowNumber: index + 2,
                values: mapRecordToCandidate(row),
                payload: prepared.ok ? prepared.payload : null,
                status: prepared.ok ? "Ready" : "Will Fail",
                reason: prepared.ok ? "Ready to create" : prepared.reason
            });
        }

        renderBulkPreview();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to read the uploaded file", "error");
    }
}

async function parseUploadFile(file) {
    const extension = getFileExtension(file.name);

    if (extension === "csv") {
        return parseCsvText(await file.text());
    }

    const XLSX = await loadSheetModule();
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

async function loadSheetModule() {
    if (!sheetModulePromise) {
        sheetModulePromise = import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
    }
    return sheetModulePromise;
}

function parseCsvText(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (char === "\"") {
            if (inQuotes && next === "\"") {
                current += "\"";
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            row.push(current);
            current = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") {
                index += 1;
            }
            row.push(current);
            current = "";
            if (row.some(value => String(value).trim() !== "")) {
                rows.push(row);
            }
            row = [];
            continue;
        }

        current += char;
    }

    if (current !== "" || row.length) {
        row.push(current);
        if (row.some(value => String(value).trim() !== "")) {
            rows.push(row);
        }
    }

    if (!rows.length) return [];

    const headers = rows[0].map(value => String(value || "").trim());
    return rows.slice(1).map(values => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = values[index] ?? "";
        });
        return record;
    });
}

function renderBulkPreview() {
    const mount = document.getElementById("bulkPreviewShell");
    const confirmButton = document.getElementById("confirmBulkUsersBtn");
    if (!mount || !confirmButton) return;

    if (!bulkAddRows.length) {
        mount.innerHTML = `<div class="empty users-empty-box">Upload a file to preview the rows before import.</div>`;
        confirmButton.disabled = true;
        return;
    }

    const readyRows = bulkAddRows.filter(row => row.status === "Ready");
    confirmButton.disabled = !readyRows.length;

    mount.innerHTML = `
        <div class="users-preview-summary">
            <span class="tag enabled">${readyRows.length} ready</span>
            <span class="tag disabled">${bulkAddRows.length - readyRows.length} issues</span>
            <span class="muted">${bulkAddRows.length} total rows</span>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Row</th>
                        ${USER_COLUMNS.map(column => `<th>${escapeHtml(column)}</th>`).join("")}
                        <th>Status</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${bulkAddRows.map(row => `
                        <tr>
                            <td>${row.rowNumber}</td>
                            ${USER_COLUMNS.map(column => `<td>${escapeHtml(row.values[column] ?? "")}</td>`).join("")}
                            <td>${escapeHtml(row.status)}</td>
                            <td>${escapeHtml(row.reason || "")}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function confirmBulkImport() {
    const readyRows = bulkAddRows.filter(row => row.status === "Ready" && row.payload);
    if (!readyRows.length) {
        showToast("No valid rows are ready for import", "error");
        return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const row of readyRows) {
        const result = await insertUserRecord(row.payload);
        if (result.ok) {
            row.status = "Created";
            row.reason = "Account created successfully";
            successCount += 1;
        } else {
            row.status = "Failed";
            row.reason = result.reason;
            failureCount += 1;
        }
    }

    renderBulkPreview();
    showToast(`Bulk import finished: ${successCount} created, ${failureCount} failed`);
}

function discardBulkPreview() {
    bulkAddRows = [];
    const fileInput = document.getElementById("bulkUserFile");
    if (fileInput) {
        fileInput.value = "";
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    renderBulkPreview();
}

function downloadUserTemplate() {
    const headers = USER_COLUMNS.join(",");
    const example = [
        "U1001",
        "Sample User",
        "sample@example.com",
        "25/04/2000",
        "0",
        "BCA",
        "internal",
        "user"
    ].join(",");

    const blob = new Blob([`${headers}\n${example}\n`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "user-upload-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
}

function downloadBulkEditTemplate() {
    const headers = ["ID", "Email"].join(",");
    const rows = [
        ["U1001", ""].join(","),
        ["", "sample@example.com"].join(","),
        ["U1002", "another@example.com"].join(",")
    ].join("\n");

    const blob = new Blob([`${headers}\n${rows}\n`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bulk-user-edit-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
}

function bindUserEdit() {
    document.getElementById("userEditSearchForm")?.addEventListener("submit", handleUserEditSearch);
    document.getElementById("clearUserEditBtn")?.addEventListener("click", () => {
        userEditResult = null;
        const query = document.getElementById("userEditQuery");
        if (query) query.value = "";
        renderUserEdit();
    });
}

async function handleUserEditSearch(event) {
    event.preventDefault();
    const query = String(document.getElementById("userEditQuery")?.value || "").trim();
    if (!query) {
        showToast("Enter a user ID or email", "error");
        return;
    }

    userEditResult = await fetchUserByIdOrEmail(query);
    if (!userEditResult) {
        showToast("No user found for that ID or email", "error");
    }
    renderUserEdit();
}

function renderUserEdit() {
    const mount = document.getElementById("userEditResult");
    if (!mount) return;

    if (!userEditResult) {
        mount.innerHTML = `<div class="empty">Search for a user to edit the account here.</div>`;
        return;
    }

    const roleChoices = getAssignableRoleOptions()
        .concat(userEditResult.role && !getAssignableRoleOptions().some(role => sameText(role, userEditResult.role)) ? [userEditResult.role] : [])
        .filter((value, index, array) => array.findIndex(item => sameText(item, value)) === index);

    mount.innerHTML = `
        <form id="userEditForm" class="list-item form-grid">
            <label><span>ID</span><input name="id" type="text" value="${escapeHtml(userEditResult.id || "")}" readonly></label>
            <label><span>Name</span><input name="name" type="text" value="${escapeHtml(userEditResult.name || "")}" required></label>
            <label><span>Email</span><input name="email" type="email" value="${escapeHtml(userEditResult.email || "")}" required></label>
            <label><span>DOB</span><input name="dob" type="text" value="${escapeHtml(userEditResult.dob || "")}" required></label>
            <label><span>Balance</span><input name="balance" type="number" step="0.01" value="${escapeHtml(userEditResult.balance ?? 0)}" required></label>
            <label><span>Department</span><input name="department" type="text" value="${escapeHtml(userEditResult.department || "")}" placeholder="Optional"></label>
            <label>
                <span>User Type</span>
                <select name="user_type">
                    <option value="internal" ${normalizeUserType(userEditResult.user_type) === "internal" ? "selected" : ""}>internal</option>
                    <option value="external" ${normalizeUserType(userEditResult.user_type) === "external" ? "selected" : ""}>external</option>
                </select>
            </label>
            <label>
                <span>Role</span>
                <select name="role">
                    ${roleChoices.map(role => `<option value="${escapeHtml(role)}" ${sameText(role, userEditResult.role) ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}
                </select>
            </label>
            <div class="full compact-actions">
                <button class="btn" type="submit">Save Changes</button>
                <button class="btn-secondary" type="button" id="setUserDefaultPasswordBtn">Set Default Password</button>
                <button class="btn-danger" type="button" id="deleteUserBtn">Delete User</button>
            </div>
        </form>
    `;

    document.getElementById("userEditForm")?.addEventListener("submit", saveUserEdit);
    document.getElementById("setUserDefaultPasswordBtn")?.addEventListener("click", () => setUserDefaultPassword(userEditResult));
    document.getElementById("deleteUserBtn")?.addEventListener("click", () => deleteUserAccount(userEditResult));
}

async function saveUserEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
        id: form.elements.id.value,
        name: form.elements.name.value,
        email: form.elements.email.value,
        dob: form.elements.dob.value,
        balance: form.elements.balance.value,
        department: form.elements.department.value,
        user_type: form.elements.user_type.value,
        role: form.elements.role.value
    };

    const prepared = await prepareCandidate(payload, { mode: "edit", skipExistingCheck: true, includePassword: false });
    if (!prepared.ok) {
        showToast(prepared.reason, "error");
        return;
    }

    const duplicateCheck = await checkUserExistsForUpdate(userEditResult.id, prepared.payload.email);
    if (!duplicateCheck.ok) {
        showToast(duplicateCheck.reason, "error");
        return;
    }

    const { error } = await supabase
        .from("users")
        .update(prepared.payload)
        .eq("id", userEditResult.id);

    if (error) {
        showToast(error.message || "Unable to update user", "error");
        return;
    }

    userEditResult = await fetchUserByIdOrEmail(userEditResult.id);
    showToast("User updated");
    renderUserEdit();
}

function bindBulkEdit() {
    document.getElementById("bulkEditLookupForm")?.addEventListener("submit", handleBulkEditLookup);
    document.getElementById("downloadBulkEditTemplateBtn")?.addEventListener("click", downloadBulkEditTemplate);
    document.getElementById("clearBulkEditBtn")?.addEventListener("click", () => {
        bulkEditableUsers = [];
        bulkEditLookupRows = [];
        const input = document.getElementById("bulkEditLookup");
        const fileInput = document.getElementById("bulkEditFile");
        if (input) input.value = "";
        if (fileInput) {
            fileInput.value = "";
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        renderBulkEditResults();
    });
    document.getElementById("saveBulkEditBtn")?.addEventListener("click", saveBulkEditedUsers);
}

async function handleBulkEditLookup(event) {
    event.preventDefault();
    const raw = String(document.getElementById("bulkEditLookup")?.value || "");
    const file = document.getElementById("bulkEditFile")?.files?.[0];
    const typedTokens = parseBulkEditTokenText(raw);
    const fileTokens = file ? await extractBulkEditTokensFromFile(file) : [];
    const tokens = Array.from(new Set([...typedTokens, ...fileTokens]));

    if (!tokens.length) {
        showToast("Enter at least one user ID or email, or choose a file", "error");
        return;
    }

    const lookupRows = await Promise.all(tokens.map(async token => {
        const user = await fetchUserByIdOrEmail(token);
        return {
            token,
            kind: token.includes("@") ? "Email" : "ID",
            status: user ? "Loaded" : "Not Found",
            reason: user ? `Matched ${user.id}` : "No user found for this entry",
            user
        };
    }));

    const deduped = [];
    lookupRows.forEach(row => {
        if (!row.user) return;
        if (!deduped.some(item => String(item.lookup_id) === String(row.user.id))) {
            deduped.push({
                ...row.user,
                lookup_id: row.user.id
            });
        }
    });

    bulkEditLookupRows = lookupRows;
    bulkEditableUsers = deduped;
    renderBulkEditResults();

    if (!deduped.length) {
        showToast("No users found for the given IDs or emails", "error");
        return;
    }

    const unresolvedCount = lookupRows.filter(row => !row.user).length;
    showToast(unresolvedCount
        ? `${deduped.length} users loaded, ${unresolvedCount} entries not found`
        : `${deduped.length} users loaded`);
}

async function extractBulkEditTokensFromFile(file) {
    const extension = getFileExtension(file.name);

    if (extension === "txt") {
        return parseBulkEditTokenText(await file.text());
    }

    const records = await parseUploadFile(file);
    return extractBulkEditTokensFromRecords(records);
}

function extractBulkEditTokensFromRecords(records) {
    return Array.from(new Set(
        (records || []).flatMap(record => {
            const normalized = {};

            Object.entries(record || {}).forEach(([key, value]) => {
                normalized[normalizeHeader(key)] = String(value ?? "").trim();
            });

            const email = normalizeEmail(
                normalized.email
                || normalized.mail
                || normalized.emailaddress
            );
            const id = String(
                normalized.id
                || normalized.userid
                || normalized.useridnumber
                || normalized.usercode
                || normalized.employeeid
                || normalized.rollno
                || ""
            ).trim();

            return [email, id].filter(Boolean);
        })
    ));
}

function parseBulkEditTokenText(text) {
    return Array.from(new Set(
        String(text || "")
            .split(/[\s,]+/)
            .map(item => item.trim())
            .filter(Boolean)
    ));
}

function renderBulkEditResults() {
    const mount = document.getElementById("bulkEditResult");
    const saveButton = document.getElementById("saveBulkEditBtn");
    if (!mount || !saveButton) return;

    saveButton.disabled = !bulkEditableUsers.length;

    if (!bulkEditableUsers.length && !bulkEditLookupRows.length) {
        mount.innerHTML = `<div class="empty">Load users here to edit them in bulk.</div>`;
        return;
    }

    const assignableRoles = getAssignableRoleOptions();
    const loadedCount = bulkEditLookupRows.filter(row => row.user).length;
    const issueCount = bulkEditLookupRows.length - loadedCount;

    mount.innerHTML = `
        <div class="users-preview-summary">
            <span class="tag enabled">${loadedCount} loaded</span>
            <span class="tag disabled">${issueCount} issues</span>
            <span class="muted">${bulkEditLookupRows.length} total entries</span>
        </div>

        <div class="users-preview-table-wrap ${bulkEditLookupRows.length > 6 ? "scrollable" : ""}">
            <table class="users-preview-table">
                <thead>
                    <tr>
                        <th>Entry</th>
                        <th>Type</th>
                        <th>Matched User</th>
                        <th>Status</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${bulkEditLookupRows.map(row => `
                        <tr>
                            <td>${escapeHtml(row.token)}</td>
                            <td>${escapeHtml(row.kind)}</td>
                            <td>${escapeHtml(row.user ? `${row.user.id} • ${row.user.email || row.user.name || ""}` : "-")}</td>
                            <td>${escapeHtml(row.status)}</td>
                            <td>${escapeHtml(row.reason)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>

        ${bulkEditableUsers.length ? `
            <div class="users-preview-summary">
                <span class="muted">Edit the loaded users below. You can change the user ID too.</span>
            </div>
            <div class="users-preview-table-wrap scrollable">
                <table class="users-preview-table">
                    <thead>
                        <tr>
                            <th>Current ID</th>
                            <th>New ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>DOB</th>
                            <th>Balance</th>
                            <th>Department</th>
                            <th>User Type</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bulkEditableUsers.map(user => {
                            const roleChoices = assignableRoles
                                .concat(user.role && !assignableRoles.some(role => sameText(role, user.role)) ? [user.role] : [])
                                .filter((value, index, array) => array.findIndex(item => sameText(item, value)) === index);
                            return `
                                <tr data-bulk-user-id="${escapeHtml(user.lookup_id)}">
                                    <td>${escapeHtml(user.lookup_id)}</td>
                                    <td><input class="users-grid-input" data-column="id" data-field="id" type="text" value="${escapeHtml(user.id || "")}"></td>
                                    <td><input class="users-grid-input" data-column="name" data-field="name" type="text" value="${escapeHtml(user.name || "")}"></td>
                                    <td><input class="users-grid-input" data-column="email" data-field="email" type="email" value="${escapeHtml(user.email || "")}"></td>
                                    <td><input class="users-grid-input" data-column="dob" data-field="dob" type="text" value="${escapeHtml(user.dob || "")}"></td>
                                    <td><input class="users-grid-input" data-column="balance" data-field="balance" type="number" step="0.01" value="${escapeHtml(user.balance ?? 0)}"></td>
                                    <td><input class="users-grid-input" data-column="department" data-field="department" type="text" value="${escapeHtml(user.department || "")}"></td>
                                    <td>
                                        <select class="users-grid-input" data-column="user_type" data-field="user_type">
                                            <option value="internal" ${normalizeUserType(user.user_type) === "internal" ? "selected" : ""}>internal</option>
                                            <option value="external" ${normalizeUserType(user.user_type) === "external" ? "selected" : ""}>external</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select class="users-grid-input" data-column="role" data-field="role">
                                            ${roleChoices.map(role => `<option value="${escapeHtml(role)}" ${sameText(role, user.role) ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}
                                        </select>
                                    </td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        ` : ""}
    `;
}

async function saveBulkEditedUsers() {
    const rows = Array.from(document.querySelectorAll("[data-bulk-user-id]"));
    if (!rows.length) {
        showToast("Load users before saving", "error");
        return;
    }

    const savedUsers = [];

    for (const row of rows) {
        const originalId = row.dataset.bulkUserId;
        const candidate = {
            id: row.querySelector('[data-field="id"]').value,
            name: row.querySelector('[data-field="name"]').value,
            email: row.querySelector('[data-field="email"]').value,
            dob: row.querySelector('[data-field="dob"]').value,
            balance: row.querySelector('[data-field="balance"]').value,
            department: row.querySelector('[data-field="department"]').value,
            user_type: row.querySelector('[data-field="user_type"]').value,
            role: row.querySelector('[data-field="role"]').value
        };

        const prepared = await prepareCandidate(candidate, { mode: "edit", skipExistingCheck: true, includePassword: false });
        if (!prepared.ok) {
            showToast(`${originalId}: ${prepared.reason}`, "error");
            return;
        }

        const duplicateCheck = await checkUserExistsForUpdate(originalId, prepared.payload.email);
        if (!duplicateCheck.ok) {
            showToast(`${originalId}: ${duplicateCheck.reason}`, "error");
            return;
        }

        const idCheck = await checkUserIdExistsForUpdate(originalId, prepared.payload.id);
        if (!idCheck.ok) {
            showToast(`${originalId}: ${idCheck.reason}`, "error");
            return;
        }

        const { error } = await supabase
            .from("users")
            .update(prepared.payload)
            .eq("id", originalId);

        if (error) {
            showToast(`${originalId}: ${error.message || "Unable to save user"}`, "error");
            return;
        }

        savedUsers.push({
            ...prepared.payload,
            lookup_id: prepared.payload.id
        });
    }

    bulkEditableUsers = savedUsers;
    bulkEditLookupRows = bulkEditLookupRows.map(row => {
        if (!row.user) return row;
        const updatedUser = savedUsers.find(user => sameText(user.lookup_id, row.user.id));
        if (!updatedUser) return row;
        return {
            ...row,
            user: updatedUser,
            reason: `Matched ${updatedUser.id}`
        };
    });

    renderBulkEditResults();
    showToast("Bulk user edit saved");
}

async function checkUserIdExistsForUpdate(originalId, nextId) {
    const normalizedNextId = String(nextId || "").trim();
    if (!normalizedNextId || sameText(originalId, normalizedNextId)) {
        return { ok: true };
    }

    const { data, error } = await supabase
        .from("users")
        .select("id")
        .ilike("id", normalizedNextId)
        .maybeSingle();

    if (error) {
        return { ok: false, reason: error.message || "Unable to validate user ID" };
    }

    if (data && String(data.id) !== String(originalId)) {
        return { ok: false, reason: "User ID already exists" };
    }

    return { ok: true };
}

function renderDefaultPasswords() {
    const mount = document.getElementById("defaultPasswordList");
    if (!mount) return;

    const mergedRoles = Array.from(new Set([
        ...roleOptions,
        ...defaultPasswordRows.map(row => String(row.role_name || "").trim()).filter(Boolean)
    ])).sort((first, second) => first.localeCompare(second));

    if (!mergedRoles.length) {
        mount.innerHTML = `<div class="empty">No roles found.</div>`;
        return;
    }

    mount.innerHTML = `
        <div class="list-item">
            <strong>Roles Available</strong>
            <div class="users-role-summary" style="margin-top:12px;">
                ${mergedRoles.map(roleName => `<span class="tag pending">${escapeHtml(roleName)}</span>`).join("")}
            </div>
        </div>
        ${mergedRoles.map(roleName => {
        const row = defaultPasswordRows.find(item => sameText(item.role_name, roleName));
        return `
        <form class="list-item default-password-form" data-role-name="${escapeHtml(roleName)}" data-initial-password="${escapeHtml(row?.Default_Password || "")}">
            <div class="users-default-password-row">
                <div>
                    <strong>${escapeHtml(roleName || "Untitled role")}</strong>
                    <div class="muted">Current password: ${escapeHtml(row?.Default_Password || "Not set")}</div>
                    <div class="muted">Updated: ${escapeHtml(formatDateTime(row?.Last_Updated))}</div>
                    <div class="muted">Updated by: ${escapeHtml(row?.Updated_By || "N/A")}</div>
                </div>
                <div class="users-default-password-controls">
                    <input type="text" name="defaultPassword" value="${escapeHtml(row?.Default_Password || "")}" placeholder="Enter default password" required>
                    <button class="btn" type="submit">Save</button>
                    <button class="btn-ghost" type="button" data-discard-password="${escapeHtml(roleName)}" hidden>Discard</button>
                </div>
            </div>
        </form>
    `;
    }).join("")}
    `;

    mount.querySelectorAll(".default-password-form").forEach(form => {
        form.addEventListener("submit", saveDefaultPasswordRow);
        bindDefaultPasswordDirtyState(form);
    });
    mount.querySelectorAll("[data-discard-password]").forEach(button => {
        button.addEventListener("click", () => discardDefaultPasswordRow(button.dataset.discardPassword));
    });
}

async function upsertDefaultPassword(roleName, password) {
    if (!roleName || !password) {
        showToast("Enter both role and password", "error");
        return;
    }

    const existingRow = defaultPasswordRows.find(row => sameText(row.role_name, roleName));
    const payload = {
        role_name: roleName,
        Default_Password: password,
        Last_Updated: new Date().toISOString(),
        Updated_By: currentAdmin?.email || currentAdmin?.id || "admin"
    };

    const query = existingRow
        ? supabase.from("Default_Password").update(payload).eq("role_name", existingRow.role_name)
        : supabase.from("Default_Password").insert([payload]);

    const { error } = await query;
    if (error) {
        showToast(error.message || "Unable to save default password", "error");
        return;
    }

    await loadRolesAndDefaultPasswords();
    renderDefaultPasswords();
    showToast(`Default password saved for ${roleName}`);
}

async function saveDefaultPasswordRow(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const roleName = form.dataset.roleName;
    const password = form.elements.defaultPassword.value.trim();
    await upsertDefaultPassword(roleName, password);
}

function bindDefaultPasswordDirtyState(form) {
    ["input", "change"].forEach(eventName => {
        form.addEventListener(eventName, () => syncDefaultPasswordDirtyState(form));
    });
    syncDefaultPasswordDirtyState(form);
}

function syncDefaultPasswordDirtyState(form) {
    const discardButton = form.querySelector("[data-discard-password]");
    if (!discardButton) return;

    const isDirty = form.elements.defaultPassword.value !== (form.dataset.initialPassword || "");
    discardButton.hidden = !isDirty;
}

function discardDefaultPasswordRow(roleName) {
    const form = document.querySelector(`.default-password-form[data-role-name="${CSS.escape(String(roleName))}"]`);
    if (!form) return;
    form.elements.defaultPassword.value = form.dataset.initialPassword || "";
    syncDefaultPasswordDirtyState(form);
}

async function prepareCandidate(candidate, options = {}) {
    const id = String(candidate.id || "").trim();
    const name = String(candidate.name || "").trim();
    const email = normalizeEmail(candidate.email);
    const dob = formatDateValue(candidate.dob);
    const balance = formatBalance(candidate.balance);
    const department = String(candidate.department || "").trim();
    const userType = normalizeUserType(candidate.user_type || candidate.userType);
    const role = String(candidate.role || "").trim();

    const missing = [];
    if (!id) missing.push("id");
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!dob) missing.push("dob");
    if (balance === null) missing.push("balance");
    if (!userType) missing.push("user_type");
    if (!role) missing.push("role");

    if (missing.length) {
        return { ok: false, reason: `Missing or invalid fields: ${missing.join(", ")}` };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, reason: "Invalid email address" };
    }

    if (!["internal", "external"].includes(userType)) {
        return { ok: false, reason: "User type must be internal or external" };
    }

    const privilegeCheck = validateAddPrivilege({ userType, role, mode: options.mode });
    if (!privilegeCheck.ok) {
        return privilegeCheck;
    }

    const payload = {
        id,
        name,
        email,
        dob,
        balance,
        department: department || null,
        user_type: userType,
        role
    };

    if (options.includePassword !== false) {
        payload.password = dob;
    }

    if (!options.skipExistingCheck) {
        const exists = await checkUserExists(id, email);
        if (!exists.ok) {
            return exists;
        }
    }

    return { ok: true, payload };
}

async function checkUserExists(id, email) {
    const [idRes, emailRes] = await Promise.all([
        supabase.from("users").select("id").ilike("id", String(id || "").trim()).maybeSingle(),
        supabase.from("users").select("email").ilike("email", email).maybeSingle()
    ]);

    if (idRes.error) {
        return { ok: false, reason: idRes.error.message || "Unable to validate user ID" };
    }

    if (emailRes.error) {
        return { ok: false, reason: emailRes.error.message || "Unable to validate email" };
    }

    if (idRes.data) {
        return { ok: false, reason: "User ID already exists" };
    }

    if (emailRes.data) {
        return { ok: false, reason: "Email already exists" };
    }

    return { ok: true };
}

async function checkUserExistsForUpdate(id, email) {
    const { data, error } = await supabase
        .from("users")
        .select("id, email")
        .ilike("email", email);

    if (error) {
        return { ok: false, reason: error.message || "Unable to validate email" };
    }

    const duplicate = (data || []).find(item => String(item.id) !== String(id));
    return duplicate ? { ok: false, reason: "Email already exists" } : { ok: true };
}

async function insertUserRecord(payload) {
    const { error } = await supabase
        .from("users")
        .insert([payload]);

    if (error) {
        return { ok: false, reason: normalizeSupabaseFailure(error) };
    }

    return { ok: true };
}

async function fetchUserByIdOrEmail(query) {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) return null;

    let response = await supabase
        .from("users")
        .select("id, name, email, dob, balance, department, user_type, role")
        .ilike("id", normalizedQuery)
        .maybeSingle();

    if (response.data) {
        return response.data;
    }

    response = await supabase
        .from("users")
        .select("id, name, email, dob, balance, department, user_type, role")
        .ilike("email", normalizedQuery)
        .maybeSingle();

    return response.data || null;
}

async function setUserDefaultPassword(user) {
    const defaultPassword = await getRoleDefaultPassword(user.role);
    if (!defaultPassword) {
        showToast("No default password configured for this role", "error");
        return;
    }

    const confirmed = window.confirm(`Set the default password for ${user.name || user.id}?`);
    if (!confirmed) return;

    const adminLabel = currentAdmin?.email || currentAdmin?.id || "admin";
    const { error } = await supabase
        .from("users")
        .update({
            password: defaultPassword,
            last_reset_by: adminLabel,
            last_reset_at: new Date().toISOString()
        })
        .eq("id", user.id);

    if (error) {
        showToast(error.message || "Unable to reset password", "error");
        return;
    }

    showToast("Default password applied");
}

async function deleteUserAccount(user) {
    const confirmed = window.confirm(`Delete user ${user.name || user.id}? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

    if (error) {
        showToast(error.message || "Unable to delete user", "error");
        return;
    }

    userEditResult = null;
    renderUserEdit();
    showToast("User deleted");
}

async function getRoleDefaultPassword(roleName) {
    if (!roleName) return null;

    const row = defaultPasswordRows.find(item => sameText(item.role_name, roleName));
    if (row?.Default_Password) {
        return row.Default_Password;
    }

    const { data, error } = await supabase
        .from("Default_Password")
        .select("Default_Password")
        .ilike("role_name", String(roleName).trim())
        .maybeSingle();

    if (error) {
        return null;
    }

    return data?.Default_Password || null;
}

function getUserFormValues(prefix) {
    return {
        id: document.getElementById(`${prefix}UserId`).value,
        name: document.getElementById(`${prefix}UserName`).value,
        email: document.getElementById(`${prefix}UserEmail`).value,
        dob: document.getElementById(`${prefix}UserDob`).value,
        balance: document.getElementById(`${prefix}UserBalance`).value,
        department: document.getElementById(`${prefix}UserDepartment`).value,
        user_type: document.getElementById(`${prefix}UserType`).value,
        role: document.getElementById(`${prefix}UserRole`).value
    };
}

function mapRecordToCandidate(record) {
    const normalized = {};

    Object.entries(record || {}).forEach(([key, value]) => {
        normalized[normalizeHeader(key)] = value;
    });

    return {
        id: normalized.id || "",
        name: normalized.name || "",
        email: normalized.email || "",
        dob: normalized.dob || "",
        balance: normalized.balance || "",
        department: normalized.department || "",
        user_type: normalized.usertype || "",
        role: normalized.role || ""
    };
}

function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function formatDateValue(value) {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "number" && Number.isFinite(value)) {
        return formatDateObject(excelSerialToDate(value));
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return formatDateObject(value);
    }

    const raw = String(value).trim();
    if (!raw) return "";

    const isoMatch = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (isoMatch) {
        return padDate(Number(isoMatch[3]), Number(isoMatch[2]), Number(isoMatch[1]));
    }

    const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (slashMatch) {
        let first = Number(slashMatch[1]);
        let second = Number(slashMatch[2]);
        let year = normalizeYear(slashMatch[3]);

        if (String(slashMatch[1]).length === 4) {
            year = Number(slashMatch[1]);
            first = Number(slashMatch[3]);
            second = Number(slashMatch[2]);
        }

        if (year > 1900 && first > 12) return padDate(first, second, year);
        if (year > 1900 && second > 12) return padDate(second, first, year);
        return padDate(first, second, year);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return formatDateObject(parsed);
    }

    return "";
}

function excelSerialToDate(serial) {
    const utcValue = Math.round((serial - 25569) * 86400 * 1000);
    return new Date(utcValue);
}

function formatDateObject(date) {
    const day = date.getUTCDate ? date.getUTCDate() : date.getDate();
    const month = (date.getUTCMonth ? date.getUTCMonth() : date.getMonth()) + 1;
    const year = date.getUTCFullYear ? date.getUTCFullYear() : date.getFullYear();
    return padDate(day, month, year);
}

function padDate(day, month, year) {
    if (!day || !month || !year) return "";
    if (month < 1 || month > 12) return "";
    if (day < 1 || day > 31) return "";
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year).padStart(4, "0")}`;
}

function normalizeYear(value) {
    const year = Number(value);
    if (String(value).length === 2) {
        return year >= 70 ? 1900 + year : 2000 + year;
    }
    return year;
}

function formatBalance(value) {
    if (value === null || value === undefined || value === "") return null;
    const amount = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(amount) ? amount : null;
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizeUserType(value) {
    return String(value || "").trim().toLowerCase();
}

function getAssignableRoleOptions() {
    const allowedRoles = new Map();

    if (hasResolvedPower(POWER_USER_ADD) || hasResolvedPower(POWER_USER_BULK) || hasResolvedPower(POWER_USER_BULK_ALIAS)) {
        allowedRoles.set("user", "user");
    }

    Object.entries(ROLE_SCOPED_ADD_POWERS).forEach(([roleName, power]) => {
        if (hasResolvedPower(power)) {
            allowedRoles.set(roleName, roleName);
        }
    });

    const availableRoles = roleOptions.filter(role => allowedRoles.has(normalizeRoleLabel(role)));
    const normalizedAvailable = new Set(availableRoles.map(role => normalizeRoleLabel(role)));

    allowedRoles.forEach((_, roleName) => {
        if (!normalizedAvailable.has(roleName)) {
            availableRoles.push(roleName);
        }
    });

    return availableRoles.length ? availableRoles : ["user"];
}

function hasAnyRoleScopedAddPower() {
    return Object.values(ROLE_SCOPED_ADD_POWERS).some(power => activePowers.includes(power));
}

function normalizeRoleLabel(role) {
    return String(role || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

function getRequiredAddPowerForRole(role) {
    const normalizedRole = normalizeRoleLabel(role);
    return ROLE_SCOPED_ADD_POWERS[normalizedRole] || null;
}

function hasResolvedPower(code) {
    const normalizedCode = String(code || "").trim().toLowerCase();
    return activePowers.includes("master_control")
        || activePowers.includes("master_controll")
        || activePowers.includes(normalizedCode);
}

function validateAddPrivilege({ userType, role, mode = "single" }) {
    const scopedRolePower = getRequiredAddPowerForRole(role);
    if (scopedRolePower) {
        return hasResolvedPower(scopedRolePower)
            ? { ok: true }
            : { ok: false, reason: "You don't have privilege to add the role" };
    }

    if (mode === "edit") {
        return { ok: true };
    }

    const hasGenericPermission = mode === "bulk"
        ? (hasResolvedPower(POWER_USER_BULK) || hasResolvedPower(POWER_USER_BULK_ALIAS))
        : hasResolvedPower(POWER_USER_ADD);

    if (["internal", "external"].includes(normalizeUserType(userType)) && hasGenericPermission && normalizeRoleLabel(role) === "user") {
        return { ok: true };
    }

    return { ok: false, reason: "You don't have privilege to add the role" };
}

function normalizeSupabaseFailure(error) {
    const message = String(error?.message || "Unable to create account");
    if (message.toLowerCase().includes("duplicate")) {
        return "Account already exists";
    }
    return message;
}

function getFileExtension(fileName) {
    const match = String(fileName || "").trim().match(/\.([^.]+)$/);
    return String(match?.[1] || "csv").toLowerCase();
}

function sameText(first, second) {
    return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function formatDateTime(value) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
}
