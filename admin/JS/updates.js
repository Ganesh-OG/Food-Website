import {
    renderAdminShell,
    supabase,
    showToast,
    escapeHtml,
    normalizeArrayValue,
    fileNameWithTimestamp,
    uploadToStorage,
    moveInStorage,
    removeFromStorage,
    getStoragePublicUrl,
    createStatusTag,
    initAdminFilePickers
} from "./common.js";

let appConfig = null;
let serviceStatus = null;
let aboutContent = [];
let contactConfigs = [];
let heroSlides = [];
let editingHeroSlideId = null;
let canManageFooter = false;
let canControlSite = false;
let canManageSlider = false;
let canEditAbout = false;

document.addEventListener("DOMContentLoaded", initUpdates);

async function initUpdates() {
    const view = await renderAdminShell({
        title: "Website Updates",
        subtitle: "Each update panel opens only for roles with the matching management powers.",
        requiredAnyPower: ["site_control", "about_edit", "slider_manage", "footer_manage"]
    });

    if (!view?.root) return;

    const { root, hasPower } = view;
    canManageFooter = hasPower("footer_manage");
    canControlSite = hasPower("site_control");
    canManageSlider = hasPower("slider_manage");
    canEditAbout = hasPower("about_edit");
    const activePanelId = canManageFooter
        ? "appConfigPanel"
        : canControlSite
            ? "serviceStatusPanel"
            : canManageSlider
                ? "heroPanel"
                : canEditAbout
                    ? "aboutPanel"
                    : "contactPanel";

    root.innerHTML = `
        <div class="updates-workspace">
            <aside class="card updates-menu">
                <div class="updates-menu-header">
                    <p class="eyebrow">Controls</p>
                    <h3>Update Functions</h3>
                    <p class="muted">Click a function name to open that control container.</p>
                </div>
                <div class="updates-menu-list">
                    <button class="updates-menu-item ${activePanelId === "appConfigPanel" ? "active" : ""}" type="button" data-update-target="appConfigPanel" ${canManageFooter ? "" : "hidden"}>
                        <span>Footer / App Config</span>
                    </button>
                    <button class="updates-menu-item ${activePanelId === "serviceStatusPanel" ? "active" : ""}" type="button" data-update-target="serviceStatusPanel" ${canControlSite ? "" : "hidden"}>
                        <span>Service Status</span>
                    </button>
                    <button class="updates-menu-item ${activePanelId === "heroPanel" ? "active" : ""}" type="button" data-update-target="heroPanel" ${canManageSlider ? "" : "hidden"}>
                        <span>Home Slider</span>
                    </button>
                    <button class="updates-menu-item ${activePanelId === "aboutPanel" ? "active" : ""}" type="button" data-update-target="aboutPanel" ${canEditAbout ? "" : "hidden"}>
                        <span>About Content</span>
                    </button>
                    <button class="updates-menu-item ${activePanelId === "contactPanel" ? "active" : ""}" type="button" data-update-target="contactPanel" ${canManageFooter ? "" : "hidden"}>
                        <span>Contact Content</span>
                    </button>
                </div>
            </aside>

            <section class="updates-content">
                <div class="card updates-panel ${activePanelId === "appConfigPanel" ? "active" : ""}" id="appConfigPanel" ${canManageFooter && activePanelId === "appConfigPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Footer / App Config</h3>
                        <p class="muted">Manage contact details and footer information visible across the website.</p>
                    </div>
                    <form id="appConfigForm" class="form-grid">
                        <input id="configAddress" class="full" type="text" placeholder="Address">
                        <input id="configMapLink" class="full" type="text" placeholder="Map link">
                        <input id="configHours" type="text" placeholder="Opening hours">
                        <input id="configPhones" type="text" placeholder="Phones (comma separated)">
                        <input id="configEmails" class="full" type="text" placeholder="Emails (comma separated)">
                        <button class="btn full" type="submit">Save Footer Settings</button>
                    </form>
                </div>

                <div class="card updates-panel ${activePanelId === "serviceStatusPanel" ? "active" : ""}" id="serviceStatusPanel" ${canControlSite && activePanelId === "serviceStatusPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Service Status</h3>
                        <p class="muted">Control whether ordering is shown as available or temporarily stopped.</p>
                    </div>
                    <form id="serviceStatusForm" class="stack">
                        <div id="serviceStatusTag"></div>
                        <select id="serviceStatusValue">
                            <option value="Working">Working</option>
                            <option value="Stopped">Stopped</option>
                        </select>
                        <button class="btn" type="submit">Update Service</button>
                    </form>
                </div>

                <div class="card updates-panel ${activePanelId === "heroPanel" ? "active" : ""}" id="heroPanel" ${canManageSlider && activePanelId === "heroPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Home Slider</h3>
                        <p class="muted">Add new hero slides, then edit or delete each existing slide from the list below.</p>
                    </div>
                    <form id="heroForm" class="form-grid">
                        <input id="heroName" type="text" placeholder="Slide title" required>
                        <input id="heroText" type="text" placeholder="Slide text" required>
                        <input id="heroImage" class="full" type="file" accept="image/*" required>
                        <button class="btn full" type="submit">Add Slider Image</button>
                    </form>
                    <div class="list" id="heroList"></div>
                </div>

                <div class="card updates-panel ${activePanelId === "aboutPanel" ? "active" : ""}" id="aboutPanel" ${canEditAbout && activePanelId === "aboutPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>About Content</h3>
                        <p class="muted">Edit the About section separately with its own title, content, status, and image.</p>
                    </div>
                    <div class="list" id="aboutList"></div>
                </div>

                <div class="card updates-panel ${activePanelId === "contactPanel" ? "active" : ""}" id="contactPanel" ${canManageFooter && activePanelId === "contactPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Contact Content</h3>
                        <p class="muted">Manage the Contact section independently from About.</p>
                    </div>
                    <div class="list" id="contactList"></div>
                </div>
            </section>
        </div>
    `;

    document.getElementById("appConfigForm")?.addEventListener("submit", saveAppConfig);
    document.getElementById("serviceStatusForm")?.addEventListener("submit", saveServiceStatus);
    document.getElementById("heroForm")?.addEventListener("submit", addHeroSlide);
    bindUpdatePanelMenu();
    initAdminFilePickers(root);

    await loadUpdateData();
}

async function loadUpdateData() {
    const [appRes, serviceRes, aboutRes, contactRes, heroRes] = await Promise.all([
        supabase.from("app_config").select("*").limit(1),
        supabase.from("service_status").select("*").limit(1),
        supabase.from("about_content").select("*").order("section"),
        supabase.from("contact_config").select("*").order("id"),
        supabase.from("hero_slider").select("*").order("id")
    ]);

    appConfig = appRes.data?.[0] || null;
    serviceStatus = serviceRes.data?.[0] || null;
    aboutContent = aboutRes.data || [];
    contactConfigs = contactRes.data || [];
    heroSlides = heroRes.data || [];

    renderUpdateForms();
}

function renderUpdateForms() {
    document.getElementById("configAddress").value = appConfig?.address || "";
    document.getElementById("configMapLink").value = appConfig?.map_link || "";
    document.getElementById("configHours").value = appConfig?.opening_hours || "";
    document.getElementById("configPhones").value = normalizeArrayValue(appConfig?.phones).join(", ");
    document.getElementById("configEmails").value = normalizeArrayValue(appConfig?.emails).join(", ");

    document.getElementById("serviceStatusValue").value = serviceStatus?.status || "Working";
    document.getElementById("serviceStatusTag").innerHTML = createStatusTag(serviceStatus?.status || "Unknown");

    renderHeroList();
    renderAboutList("About", "aboutList");
    renderContactList();
}

function bindUpdatePanelMenu() {
    const buttons = Array.from(document.querySelectorAll("[data-update-target]"));
    const panels = Array.from(document.querySelectorAll(".updates-panel"));

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.updateTarget;

            buttons.forEach(item => item.classList.toggle("active", item === button));
            panels.forEach(panel => {
                const isActive = panel.id === targetId;
                panel.classList.toggle("active", isActive);
                panel.hidden = !isActive;
            });
        });
    });
}

function renderHeroList() {
    const mount = document.getElementById("heroList");
    if (!mount) return;

    mount.innerHTML = heroSlides.length
        ? heroSlides.map(slide => `
            ${String(editingHeroSlideId) === String(slide.id) ? `
                <form class="list-item hero-edit-form is-editing" data-slide-id="${escapeHtml(slide.id)}" data-file="${escapeHtml(slide.file_name || "")}">
                    <img class="thumb" src="${slide.file_name ? getStoragePublicUrl("Food-Website-Storage", `Slider Images/${slide.file_name}`) : ""}" alt="${escapeHtml(slide.name)}">
                    <div class="hero-edit-fields">
                        <input type="text" name="name" value="${escapeHtml(slide.name || "")}" placeholder="Slide title" required>
                        <textarea name="content_display" rows="3" placeholder="Slide text" required>${escapeHtml(slide.content_display || "")}</textarea>
                        <input type="file" name="image" accept="image/*">
                    </div>
                    <div class="compact-actions">
                        <button class="btn-secondary" type="submit">Save</button>
                        <button class="btn-ghost" type="button" data-cancel-slide="${escapeHtml(slide.id)}">Cancel</button>
                        <button class="btn-danger" type="button" data-delete-slide="${escapeHtml(slide.id)}" data-file="${escapeHtml(slide.file_name || "")}">Delete</button>
                    </div>
                </form>
            ` : `
                <div class="list-item hero-slide-card">
                    <img class="thumb" src="${slide.file_name ? getStoragePublicUrl("Food-Website-Storage", `Slider Images/${slide.file_name}`) : ""}" alt="${escapeHtml(slide.name)}">
                    <div class="hero-slide-copy">
                        <strong>${escapeHtml(slide.name || "")}</strong>
                        <div class="muted">${escapeHtml(slide.content_display || "")}</div>
                    </div>
                    <div class="compact-actions">
                        <button class="btn-secondary" type="button" data-edit-slide="${escapeHtml(slide.id)}">Edit</button>
                        <button class="btn-danger" type="button" data-delete-slide="${escapeHtml(slide.id)}" data-file="${escapeHtml(slide.file_name || "")}">Delete</button>
                    </div>
                </div>
            `}
        `).join("")
        : `<div class="empty">No slider items found.</div>`;

    mount.querySelectorAll(".hero-edit-form").forEach(form => {
        form.addEventListener("submit", saveHeroSlide);
    });

    mount.querySelectorAll("[data-edit-slide]").forEach(button => {
        button.addEventListener("click", () => {
            editingHeroSlideId = button.dataset.editSlide;
            renderHeroList();
        });
    });

    mount.querySelectorAll("[data-cancel-slide]").forEach(button => {
        button.addEventListener("click", () => {
            editingHeroSlideId = null;
            renderHeroList();
        });
    });

    mount.querySelectorAll("[data-delete-slide]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            deleteHeroSlide(button.dataset.deleteSlide, button.dataset.file);
        });
    });

    initAdminFilePickers(mount);
}

function renderAboutList(sectionName, mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const sectionRows = aboutContent.filter(item => getAboutSectionGroup(item.section) === String(sectionName).toLowerCase());

    mount.innerHTML = sectionRows.length
        ? sectionRows.map(item => `
            <form
                class="list-item about-form"
                data-id="${escapeHtml(item.id)}"
                data-section="${escapeHtml(item.section)}"
                data-initial-title="${escapeHtml(item.title || "")}"
                data-initial-content="${escapeHtml(item.content || "")}"
                data-initial-status="${escapeHtml(String(item.Status || "disabled").toLowerCase())}"
                data-initial-image-path="${escapeHtml(item.image_path || "")}"
                data-initial-image-url="${escapeHtml(item.image_path ? getAboutImageUrl(item.section, item.image_path) : "")}"
            >
                <div><strong>${escapeHtml(item.section)}</strong> ${createStatusTag(item.Status || "disabled")}</div>
                <input type="text" name="title" value="${escapeHtml(item.title || "")}" placeholder="Title">
                <textarea name="content" rows="4" placeholder="Content">${escapeHtml(item.content || "")}</textarea>
                <select name="status">
                    <option value="enabled" ${String(item.Status).toLowerCase() === "enabled" ? "selected" : ""}>enabled</option>
                    <option value="disabled" ${String(item.Status).toLowerCase() === "disabled" ? "selected" : ""}>disabled</option>
                </select>
                <input type="file" name="image" accept="image/*">
                <div class="updates-file-meta">
                    <strong>Stored file:</strong> ${escapeHtml(item.image_path || "No file uploaded")}
                </div>
                <img
                    class="thumb updates-preview-thumb ${item.image_path ? "" : "is-hidden"}"
                    src="${item.image_path ? getAboutImageUrl(item.section, item.image_path) : ""}"
                    alt="${escapeHtml(item.title)}"
                >
                <div class="compact-actions">
                    <button class="btn" type="submit" data-save-about="${escapeHtml(item.id)}" hidden>Save Section</button>
                    <button class="btn-ghost" type="button" data-discard-about="${escapeHtml(item.id)}" hidden>Discard</button>
                </div>
            </form>
        `).join("")
        : `<div class="empty">No ${escapeHtml(sectionName)} content rows found.</div>`;

    mount.querySelectorAll(".about-form").forEach(form => {
        form.addEventListener("submit", saveAboutSection);
        bindAboutFormDirtyState(form);
        bindAboutImagePreview(form);
    });

    mount.querySelectorAll("[data-discard-about]").forEach(button => {
        button.addEventListener("click", () => discardAboutSection(button.dataset.discardAbout));
    });

    initAdminFilePickers(mount);
}

function renderContactList() {
    const mount = document.getElementById("contactList");
    if (!mount) return;

    mount.innerHTML = contactConfigs.length
        ? contactConfigs.map(item => `
            <form
                class="list-item about-form contact-config-form"
                data-id="${escapeHtml(item.id)}"
                data-initial-title="${escapeHtml(item.title || "")}"
                data-initial-status="${escapeHtml(String(item.status || "disabled").toLowerCase())}"
                data-initial-image-path="${escapeHtml(item.image_path || "")}"
                data-initial-image-url="${escapeHtml(item.image_path ? getStoragePublicUrl("Food-Website-Storage", `Contact/${item.image_path}`) : "")}"
            >
                <div><strong>${escapeHtml(item.Stage || item.stage || `Contact ${item.id}`)}</strong> ${createStatusTag(item.status || "disabled")}</div>
                <input type="text" name="title" value="${escapeHtml(item.title || "")}" placeholder="Title">
                <select name="status">
                    <option value="enabled" ${String(item.status).toLowerCase() === "enabled" ? "selected" : ""}>enabled</option>
                    <option value="disabled" ${String(item.status).toLowerCase() === "disabled" ? "selected" : ""}>disabled</option>
                </select>
                <input type="file" name="image" accept="image/*">
                <div class="updates-file-meta">
                    <strong>Stored file:</strong> ${escapeHtml(item.image_path || "No file uploaded")}
                </div>
                <img
                    class="thumb updates-preview-thumb contact-preview-thumb ${item.image_path ? "" : "is-hidden"}"
                    src="${item.image_path ? getStoragePublicUrl("Food-Website-Storage", `Contact/${item.image_path}`) : ""}"
                    alt="${escapeHtml(item.title || "Contact image")}"
                >
                <div class="compact-actions">
                    <button class="btn" type="submit" data-save-contact="${escapeHtml(item.id)}" hidden>Save Contact</button>
                    <button class="btn-ghost" type="button" data-discard-contact="${escapeHtml(item.id)}" hidden>Discard</button>
                </div>
            </form>
        `).join("")
        : `<div class="empty">No contact_config rows found.</div>`;

    mount.querySelectorAll(".contact-config-form").forEach(form => {
        form.addEventListener("submit", saveContactConfig);
        bindContactFormDirtyState(form);
        bindContactImagePreview(form);
    });

    mount.querySelectorAll("[data-discard-contact]").forEach(button => {
        button.addEventListener("click", () => discardContactConfig(button.dataset.discardContact));
    });

    initAdminFilePickers(mount);
}

async function saveAppConfig(event) {
    event.preventDefault();

    const payload = {
        ...(appConfig?.id ? { id: appConfig.id } : {}),
        address: document.getElementById("configAddress").value.trim(),
        map_link: document.getElementById("configMapLink").value.trim(),
        opening_hours: document.getElementById("configHours").value.trim(),
        phones: normalizeArrayValue(document.getElementById("configPhones").value),
        emails: normalizeArrayValue(document.getElementById("configEmails").value)
    };

    const query = appConfig?.id
        ? supabase.from("app_config").update(payload).eq("id", appConfig.id)
        : supabase.from("app_config").insert([payload]);

    const { error } = await query;

    if (error) {
        showToast(error.message || "Unable to save footer settings", "error");
        return;
    }

    showToast("Footer settings updated");
    await loadUpdateData();
}

async function saveServiceStatus(event) {
    event.preventDefault();

    const payload = {
        ...(serviceStatus?.id ? { id: serviceStatus.id } : {}),
        status: document.getElementById("serviceStatusValue").value
    };

    const query = serviceStatus?.id
        ? supabase.from("service_status").update(payload).eq("id", serviceStatus.id)
        : supabase.from("service_status").insert([payload]);

    const { error } = await query;

    if (error) {
        showToast(error.message || "Unable to update service status", "error");
        return;
    }

    showToast("Service status updated");
    await loadUpdateData();
}

async function addHeroSlide(event) {
    event.preventDefault();

    const name = document.getElementById("heroName").value.trim();
    const text = document.getElementById("heroText").value.trim();
    const imageFile = document.getElementById("heroImage").files[0];

    if (!imageFile) {
        showToast("Choose an image first", "error");
        return;
    }

    const fileName = fileNameWithTimestamp(imageFile);

    try {
        await uploadToStorage("Food-Website-Storage", `Slider Images/${fileName}`, imageFile);

        const { error } = await supabase
            .from("hero_slider")
            .insert([{
                name,
                content_display: text,
                file_name: fileName
            }]);

        if (error) throw error;

        showToast("Hero slide added");
        document.getElementById("heroForm").reset();
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to add slide", "error");
    }
}

async function saveHeroSlide(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const slideId = form.dataset.slideId;
    const oldFileName = form.dataset.file;
    const imageFile = form.elements.image.files[0];

    let fileName = oldFileName || null;

    try {
        if (imageFile) {
            fileName = fileNameWithTimestamp(imageFile);
            await uploadToStorage("Food-Website-Storage", `Slider Images/${fileName}`, imageFile);

            if (oldFileName && oldFileName !== fileName) {
                await removeFromStorage("Food-Website-Storage", `Slider Images/${oldFileName}`);
            }
        }

        const payload = {
            name: form.elements.name.value.trim(),
            content_display: form.elements.content_display.value.trim(),
            file_name: fileName
        };

        const { error } = await supabase
            .from("hero_slider")
            .update(payload)
            .eq("id", slideId);

        if (error) throw error;

        showToast("Hero slide updated");
        editingHeroSlideId = null;
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update slide", "error");
    }
}

async function deleteHeroSlide(id, fileName) {
    try {
        const { error } = await supabase
            .from("hero_slider")
            .delete()
            .eq("id", id);

        if (error) throw error;

        if (fileName) {
            await removeFromStorage("Food-Website-Storage", `Slider Images/${fileName}`);
        }

        showToast("Hero slide removed");
        if (String(editingHeroSlideId) === String(id)) {
            editingHeroSlideId = null;
        }
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to delete slide", "error");
    }
}

async function saveAboutSection(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const rowId = form.dataset.id;
    const section = form.dataset.section;
    const item = aboutContent.find(row => String(row.id) === String(rowId));
    if (!item) return;

    const sectionLabel = item.section || section || "About";
    const folder = getAboutSectionGroup(section) === "contact" ? "Contact" : "About";
    let imagePath = item.image_path || null;
    const imageFile = form.elements.image.files[0];
    let uploadedPath = null;
    let archivedImagePath = null;

    try {
        if (imageFile) {
            imagePath = normalizeSectionFileName(imageFile, sectionLabel, folder);

            if (item.image_path && sameText(item.image_path, imagePath)) {
                archivedImagePath = await archiveSectionImage(item.image_path, sectionLabel, folder);
            }

            uploadedPath = `${folder}/${imagePath}`;
            await uploadToStorage("Food-Website-Storage", uploadedPath, imageFile);
        }

        const payload = {
            title: form.elements.title.value.trim(),
            content: form.elements.content.value.trim(),
            Status: form.elements.status.value,
            image_path: imagePath
        };

        const { error } = await supabase
            .from("about_content")
            .update(payload)
            .eq("id", rowId);

        if (error) throw error;

        if (imageFile && item.image_path && item.image_path !== imagePath && !archivedImagePath) {
            archivedImagePath = await archiveSectionImage(item.image_path, sectionLabel, folder);
        }

        showToast(`${section} updated`);
        await loadUpdateData();
    } catch (error) {
        if (uploadedPath) {
            try {
                await removeFromStorage("Food-Website-Storage", uploadedPath);
            } catch (cleanupError) {
                console.error(cleanupError);
            }
        }
        if (archivedImagePath && item.image_path) {
            try {
                await moveInStorage("Food-Website-Storage", `${folder}/${archivedImagePath}`, `${folder}/${item.image_path}`);
            } catch (restoreError) {
                console.error(restoreError);
            }
        }
        console.error(error);
        showToast(error.message || "Unable to update section", "error");
    }
}

async function saveContactConfig(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const rowId = form.dataset.id;
    const item = contactConfigs.find(row => String(row.id) === String(rowId));
    if (!item) return;

    const stageLabel = item.Stage || item.stage || "Contact";
    let imagePath = item.image_path || null;
    const imageFile = form.elements.image.files[0];
    let uploadedPath = null;
    let archivedImagePath = null;

    try {
        if (imageFile) {
            imagePath = normalizeContactFileName(imageFile, stageLabel);

            if (item.image_path && sameText(item.image_path, imagePath)) {
                archivedImagePath = await archiveContactImage(item.image_path, stageLabel);
            }

            uploadedPath = `Contact/${imagePath}`;
            await uploadToStorage("Food-Website-Storage", uploadedPath, imageFile);
        }

        const payload = {
            title: form.elements.title.value.trim(),
            status: form.elements.status.value,
            image_path: imagePath
        };

        const { error } = await supabase
            .from("contact_config")
            .update(payload)
            .eq("id", rowId);

        if (error) throw error;

        if (imageFile && item.image_path && item.image_path !== imagePath && !archivedImagePath) {
            archivedImagePath = await archiveContactImage(item.image_path, stageLabel);
        }

        showToast(`${item.Stage || item.stage || "Contact"} updated`);
        await loadUpdateData();
    } catch (error) {
        if (uploadedPath) {
            try {
                await removeFromStorage("Food-Website-Storage", uploadedPath);
            } catch (cleanupError) {
                console.error(cleanupError);
            }
        }
        if (archivedImagePath && item.image_path) {
            try {
                await moveInStorage("Food-Website-Storage", `Contact/${archivedImagePath}`, `Contact/${item.image_path}`);
            } catch (restoreError) {
                console.error(restoreError);
            }
        }
        console.error(error);
        showToast(error.message || "Unable to update contact config", "error");
    }
}

function discardAboutSection(id) {
    const item = aboutContent.find(row => String(row.id) === String(id));
    const form = document.querySelector(`.about-form[data-id="${CSS.escape(String(id))}"]`);
    if (!item || !form) return;

    form.elements.title.value = item.title || "";
    form.elements.content.value = item.content || "";
    form.elements.status.value = String(item.Status || "disabled").toLowerCase();
    form.elements.image.value = "";
    form.elements.image.dispatchEvent(new Event("change", { bubbles: true }));
    resetAboutImagePreview(form);
    syncAboutFormDirtyState(form);
}

function discardContactConfig(id) {
    const item = contactConfigs.find(row => String(row.id) === String(id));
    const form = document.querySelector(`.contact-config-form[data-id="${CSS.escape(String(id))}"]`);
    if (!item || !form) return;

    form.elements.title.value = item.title || "";
    form.elements.status.value = String(item.status || "disabled").toLowerCase();
    form.elements.image.value = "";
    form.elements.image.dispatchEvent(new Event("change", { bubbles: true }));
    resetContactImagePreview(form);
    syncContactFormDirtyState(form);
}

function bindAboutFormDirtyState(form) {
    ["input", "change"].forEach(eventName => {
        form.addEventListener(eventName, () => syncAboutFormDirtyState(form));
    });

    syncAboutFormDirtyState(form);
}

function syncAboutFormDirtyState(form) {
    const isDirty =
        form.elements.title.value !== (form.dataset.initialTitle || "") ||
        form.elements.content.value !== (form.dataset.initialContent || "") ||
        form.elements.status.value !== (form.dataset.initialStatus || "disabled") ||
        Boolean(form.elements.image.files[0]);

    const saveButton = form.querySelector("[data-save-about]");
    const discardButton = form.querySelector("[data-discard-about]");
    if (saveButton) {
        saveButton.hidden = !isDirty;
    }
    if (discardButton) {
        discardButton.hidden = !isDirty;
    }
}

function bindContactFormDirtyState(form) {
    ["input", "change"].forEach(eventName => {
        form.addEventListener(eventName, () => syncContactFormDirtyState(form));
    });

    syncContactFormDirtyState(form);
}

function syncContactFormDirtyState(form) {
    const isDirty =
        form.elements.title.value !== (form.dataset.initialTitle || "") ||
        form.elements.status.value !== (form.dataset.initialStatus || "disabled") ||
        Boolean(form.elements.image.files[0]);

    const saveButton = form.querySelector("[data-save-contact]");
    const discardButton = form.querySelector("[data-discard-contact]");
    if (saveButton) {
        saveButton.hidden = !isDirty;
    }
    if (discardButton) {
        discardButton.hidden = !isDirty;
    }
}

function bindAboutImagePreview(form) {
    form.elements.image?.addEventListener("change", () => updateAboutImagePreview(form));
    resetAboutImagePreview(form);
}

function updateAboutImagePreview(form) {
    const preview = form.querySelector(".updates-preview-thumb");
    if (!preview) return;

    const imageFile = form.elements.image?.files?.[0];
    if (!imageFile) {
        resetAboutImagePreview(form);
        return;
    }

    if (form.dataset.previewObjectUrl) {
        URL.revokeObjectURL(form.dataset.previewObjectUrl);
        delete form.dataset.previewObjectUrl;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    form.dataset.previewObjectUrl = objectUrl;
    preview.src = objectUrl;
    preview.classList.remove("is-hidden");
}

function resetAboutImagePreview(form) {
    const preview = form.querySelector(".updates-preview-thumb");
    if (!preview) return;

    if (form.dataset.previewObjectUrl) {
        URL.revokeObjectURL(form.dataset.previewObjectUrl);
        delete form.dataset.previewObjectUrl;
    }

    const initialUrl = form.dataset.initialImageUrl || "";
    preview.src = initialUrl;
    preview.classList.toggle("is-hidden", !initialUrl);
}

function bindContactImagePreview(form) {
    form.elements.image?.addEventListener("change", () => updateContactImagePreview(form));
    resetContactImagePreview(form);
}

function updateContactImagePreview(form) {
    const preview = form.querySelector(".contact-preview-thumb");
    if (!preview) return;

    const imageFile = form.elements.image?.files?.[0];
    if (!imageFile) {
        resetContactImagePreview(form);
        return;
    }

    if (form.dataset.previewObjectUrl) {
        URL.revokeObjectURL(form.dataset.previewObjectUrl);
        delete form.dataset.previewObjectUrl;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    form.dataset.previewObjectUrl = objectUrl;
    preview.src = objectUrl;
    preview.classList.remove("is-hidden");
}

function resetContactImagePreview(form) {
    const preview = form.querySelector(".contact-preview-thumb");
    if (!preview) return;

    if (form.dataset.previewObjectUrl) {
        URL.revokeObjectURL(form.dataset.previewObjectUrl);
        delete form.dataset.previewObjectUrl;
    }

    const initialUrl = form.dataset.initialImageUrl || "";
    preview.src = initialUrl;
    preview.classList.toggle("is-hidden", !initialUrl);
}

async function archiveContactImage(fileName, stageLabel = "Contact") {
    return archiveSectionImage(fileName, stageLabel, "Contact");
}

async function archiveSectionImage(fileName, sectionLabel = "Section", folder = "About") {
    const originalName = String(fileName || "").trim();
    if (!originalName) return;

    const extensionMatch = originalName.match(/\.([^.]+)$/);
    const extension = extensionMatch ? `.${extensionMatch[1]}` : "";
    const stageSlug = String(sectionLabel || "Section")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    const normalizedStage = stageSlug
        ? `${stageSlug.charAt(0).toUpperCase()}${stageSlug.slice(1)}`
        : "Section";

    for (let index = 1; index <= 50; index += 1) {
        const archivedName = `Old_${normalizedStage}_${index}${extension}`;
        try {
            await moveInStorage("Food-Website-Storage", `${folder}/${originalName}`, `${folder}/${archivedName}`);
            return archivedName;
        } catch (error) {
            const message = String(error?.message || "").toLowerCase();
            if (message.includes("already exists") || message.includes("duplicate")) {
                continue;
            }
            throw error;
        }
    }

    throw new Error("Unable to archive previous contact image");
}

function normalizeContactFileName(file, stageLabel = "Contact") {
    return normalizeSectionFileName(file, stageLabel, "Contact");
}

function normalizeSectionFileName(file, sectionLabel = "Section", folder = "About") {
    const rawName = String(file?.name || "contact-image");
    const parts = rawName.split(".");
    const extension = parts.length > 1 ? parts.pop().toLowerCase() : "";
    const stageSlug = String(sectionLabel || "Section")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    const normalizedStage = stageSlug
        ? `${stageSlug.charAt(0).toUpperCase()}${stageSlug.slice(1)}`
        : "Section";
    const basePrefix = folder === "Contact" ? "Contact" : "About";
    const normalizedBase = `${basePrefix}_${normalizedStage}`;

    return extension ? `${normalizedBase}.${extension}` : normalizedBase;
}

function sameText(first, second) {
    return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function getAboutImageUrl(section, fileName) {
    const folder = getAboutSectionGroup(section) === "contact" ? "Contact" : "About";
    return getStoragePublicUrl("Food-Website-Storage", `${folder}/${fileName}`);
}

function getAboutSectionGroup(section) {
    const value = String(section || "").trim().toLowerCase();

    if (value.includes("contact")) return "contact";
    if (
        value.includes("about") ||
        value === "paragraph" ||
        /^step\d+$/.test(value)
    ) {
        return "about";
    }

    return value;
}
