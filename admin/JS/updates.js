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
import {
    getDefaultLoaderConfig,
    getLoaderImagePath,
    hasStructuredLoaderConfig,
    normalizeLoaderConfig,
    setLoaderBaseConfig
} from "../../components/JS/loader_config.js";

let appConfig = null;
let serviceStatus = null;
let aboutContent = [];
let contactConfigs = [];
let heroSlides = [];
let categoryRows = [];
let editingHeroSlideId = null;
let editingLoaderItemKey = null;
let canManageFooter = false;
let canControlSite = false;
let canManageSlider = false;
let canEditAbout = false;
let canManageSiteLogo = false;
let loaderConfigState = getDefaultLoaderConfig();
let projectRootHandle = null;

function refreshLoaderPanels() {
    renderLoaderForm();
    renderLoaderList();
    renderLoaderConnectionState();
}

function renderLoaderConnectionState() {
    const mount = document.getElementById("loaderConnectionState");
    if (!mount) return;

    mount.innerHTML = projectRootHandle
        ? `<div class="loader-connection-note is-connected">Local project connected. Loader config and SVG files will be updated here.</div>`
        : `<div class="loader-connection-note">Viewing loader from config. When saving, choose the <code>Final Supabase</code> project root folder that contains <code>admin</code>, <code>components</code>, and <code>images</code>.</div>`;
}

document.addEventListener("DOMContentLoaded", initUpdates);

async function initUpdates() {
    try {
        const baseConfigResponse = await fetch("../components/config/loader-config.json", { cache: "no-store" });
        if (baseConfigResponse.ok) {
            const baseConfig = await baseConfigResponse.json();
            setLoaderBaseConfig(baseConfig);
            loaderConfigState = normalizeLoaderConfig(baseConfig);
        }
    } catch (error) {
        console.warn("Unable to load loader-config.json, using fallback loader base config", error);
    }

    const view = await renderAdminShell({
        title: "Website Updates",
        subtitle: "Each update panel opens only for roles with the matching management powers.",
        requiredAnyPower: ["site_control", "about_edit", "slider_manage", "footer_manage", "category_manage", "loader_manage", "site_logo_manage"]
    });

    if (!view?.root) return;

    const { root, hasPower } = view;
    canManageFooter = hasPower("footer_manage");
    canControlSite = hasPower("site_control");
    canManageSlider = hasPower("slider_manage");
    canEditAbout = hasPower("about_edit");
    canManageSiteLogo = hasPower("site_logo_manage") || hasPower("site_control");
    const canManageCategories = hasPower("site_control") || hasPower("category_manage");
    const canManageLoader = hasPower("site_control") || hasPower("loader_manage");
    const activePanelId = canManageFooter
        ? "appConfigPanel"
        : canControlSite
            ? "serviceStatusPanel"
            : canManageSiteLogo
                ? "siteLogoPanel"
                : canManageSlider
                ? "heroPanel"
                : canEditAbout
                    ? "aboutPanel"
                    : canManageCategories
                        ? "categoryPanel"
                        : canManageLoader
                            ? "loaderPanel"
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
                    <button class="updates-menu-item ${activePanelId === "siteLogoPanel" ? "active" : ""}" type="button" data-update-target="siteLogoPanel" ${canManageSiteLogo ? "" : "hidden"}>
                        <span>Site Logo</span>
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
                    <button class="updates-menu-item ${activePanelId === "categoryPanel" ? "active" : ""}" type="button" data-update-target="categoryPanel" ${canManageCategories ? "" : "hidden"}>
                        <span>Category Manage</span>
                    </button>
                    <button class="updates-menu-item ${activePanelId === "loaderPanel" ? "active" : ""}" type="button" data-update-target="loaderPanel" ${canManageLoader ? "" : "hidden"}>
                        <span>Loader Control</span>
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

                <div class="card updates-panel ${activePanelId === "siteLogoPanel" ? "active" : ""}" id="siteLogoPanel" ${canManageSiteLogo && activePanelId === "siteLogoPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Site Logo</h3>
                        <p class="muted">Upload the user-side header logo. The selected file is stored in app_config under the Logo field.</p>
                    </div>
                    <form id="siteLogoForm" class="form-grid">
                        <input id="siteLogoAsset" class="full" type="file" accept="image/*" required>
                        <button class="btn full" type="submit">Save Site Logo</button>
                    </form>
                    <div class="list updates-scroll-list" id="siteLogoList"></div>
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
                    <div class="list updates-scroll-list" id="heroList"></div>
                </div>

                <div class="card updates-panel ${activePanelId === "aboutPanel" ? "active" : ""}" id="aboutPanel" ${canEditAbout && activePanelId === "aboutPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>About Content</h3>
                        <p class="muted">Edit the About section separately with its own title, content, status, and image.</p>
                    </div>
                    <div class="list updates-scroll-list" id="aboutList"></div>
                </div>

                <div class="card updates-panel ${activePanelId === "contactPanel" ? "active" : ""}" id="contactPanel" ${canManageFooter && activePanelId === "contactPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Contact Content</h3>
                        <p class="muted">Manage the Contact section independently from About.</p>
                    </div>
                    <div class="list updates-scroll-list" id="contactList"></div>
                </div>

                <div class="card updates-panel ${activePanelId === "categoryPanel" ? "active" : ""}" id="categoryPanel" ${canManageCategories && activePanelId === "categoryPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Category Manage</h3>
                        <p class="muted">Add, edit, or remove the categories shown on the home page.</p>
                    </div>
                    <form id="categoryForm" class="form-grid category-create-form">
                        <input id="categoryName" type="text" placeholder="Category name" required>
                        <input id="categoryImage" type="file" accept="image/*" required>
                        <button class="btn full" type="submit">Add Category</button>
                    </form>
                    <div class="list updates-scroll-list" id="categoryList"></div>
                </div>

                <div class="card updates-panel ${activePanelId === "loaderPanel" ? "active" : ""}" id="loaderPanel" ${canManageLoader && activePanelId === "loaderPanel" ? "" : "hidden"}>
                    <div class="updates-panel-header">
                        <h3>Loader Manage</h3>
                        <p class="muted">This panel uses the same <code>components/config/loader-config.json</code> that the site loader reads.</p>
                        <p class="muted">Add, replace, delete, and speed changes update that config and the local <code>images/loader</code> folder directly.</p>
                        <div id="loaderConnectionState"></div>
                        <div class="compact-actions">
                            <button class="btn-secondary" type="button" id="connectLoaderProject">Connect Local Project</button>
                        </div>
                    </div>
                    <div class="loader-section-heading">
                        <h4>1. Add New Logo</h4>
                        <p class="muted">Upload a new SVG logo and choose its initial color.</p>
                    </div>
                    <form id="loaderAddForm" class="form-grid">
                        <input id="loaderNewLabel" type="text" placeholder="New logo name" required>
                        <input id="loaderNewColor" type="color" value="#f7a600">
                        <input id="loaderNewFile" class="full" type="file" accept=".svg,image/svg+xml" required>
                        <button class="btn full" type="submit">Add New Logo</button>
                    </form>
                    <div class="loader-section-heading">
                        <h4>2. Edit Existing Logos</h4>
                        <p class="muted">Edit, replace, or delete the logos already used by the loader.</p>
                    </div>
                    <div class="list" id="loaderList"></div>
                    <div class="loader-section-heading">
                        <h4>3. Adjust Speed</h4>
                        <p class="muted">Control logo/color cycle speed and ball movement speed.</p>
                    </div>
                    <form id="loaderSpeedForm" class="form-grid">
                        <div>
                            <label for="loaderCycleSeconds">Color/logo speed</label>
                            <input id="loaderCycleSeconds" type="number" min="2" max="20" step="0.1" placeholder="Color cycle seconds">
                            <div class="updates-file-meta">Lower value = faster color and logo switching.</div>
                        </div>
                        <div>
                            <label for="loaderOrbitSeconds">Ball movement speed</label>
                            <input id="loaderOrbitSeconds" type="number" min="2" max="20" step="0.1" placeholder="Orbit seconds">
                            <div class="updates-file-meta">Lower value = faster small ball movement.</div>
                        </div>
                        <button class="btn full" type="submit">Save Speed</button>
                    </form>
                </div>
            </section>
        </div>
    `;

    document.getElementById("appConfigForm")?.addEventListener("submit", saveAppConfig);
    document.getElementById("serviceStatusForm")?.addEventListener("submit", saveServiceStatus);
    document.getElementById("siteLogoForm")?.addEventListener("submit", saveSiteLogo);
    document.getElementById("heroForm")?.addEventListener("submit", addHeroSlide);
    document.getElementById("categoryForm")?.addEventListener("submit", addCategoryRow);
    document.getElementById("loaderSpeedForm")?.addEventListener("submit", saveLoaderSpeed);
    document.getElementById("loaderAddForm")?.addEventListener("submit", addLoaderLogo);
    document.getElementById("connectLoaderProject")?.addEventListener("click", connectLoaderProjectFolder);
    bindUpdatePanelMenu();
    initAdminFilePickers(root);

    await loadUpdateData();
}

async function loadUpdateData() {
    const [appRes, serviceRes, aboutRes, contactRes, heroRes, categoryRes] = await Promise.all([
        supabase.from("app_config").select("*").limit(1),
        supabase.from("service_status").select("*").limit(1),
        supabase.from("about_content").select("*").order("section"),
        supabase.from("contact_config").select("*").order("id"),
        supabase.from("hero_slider").select("*").order("id"),
        supabase.from("category").select("*").order("category_name")
    ]);

    appConfig = appRes.data?.[0] || null;
    serviceStatus = serviceRes.data?.[0] || null;
    aboutContent = aboutRes.data || [];
    contactConfigs = contactRes.data || [];
    heroSlides = heroRes.data || [];
    categoryRows = categoryRes.data || [];

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
    renderCategoryList();
    refreshLoaderPanels();
    renderSiteLogoList();
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

function renderCategoryList() {
    const mount = document.getElementById("categoryList");
    if (!mount) return;

    mount.innerHTML = categoryRows.length
        ? categoryRows.map(item => `
            <form class="list-item category-form" data-category-id="${escapeHtml(item.id ?? item.category_name)}" data-current-image="${escapeHtml(item.display_image || "")}">
                <div class="category-form-grid">
                    <div class="category-form-fields">
                        <div class="category-form-heading">
                            <span class="eyebrow">Category Item</span>
                            <strong>${escapeHtml(item.category_name || "Unnamed category")}</strong>
                            <p class="muted">Update the category label or replace the display image used on the home page.</p>
                        </div>
                        <input type="text" name="category_name" value="${escapeHtml(item.category_name || "")}" placeholder="Category name" required>
                        <input type="file" name="display_image" accept="image/*">
                        <div class="updates-file-meta"><strong>Stored file:</strong> ${escapeHtml(item.display_image || "No image")}</div>
                    </div>
                    <div class="category-preview-card">
                        ${item.display_image
                            ? `<img class="thumb category-thumb" src="${getStoragePublicUrl("Food-Website-Storage", `category/${item.display_image}`)}" alt="${escapeHtml(item.category_name || "Category")}">`
                            : `<div class="category-thumb category-thumb-empty">No image</div>`
                        }
                    </div>
                </div>
                <div class="compact-actions category-actions">
                    <button class="btn" type="submit">Save Category</button>
                    <button class="btn-danger" type="button" data-delete-category="${escapeHtml(item.id ?? item.category_name)}" data-file="${escapeHtml(item.display_image || "")}">Delete</button>
                </div>
            </form>
        `).join("")
        : `<div class="empty">No category rows found.</div>`;

    mount.querySelectorAll(".category-form").forEach(form => {
        form.addEventListener("submit", saveCategoryRow);
    });

    mount.querySelectorAll("[data-delete-category]").forEach(button => {
        button.addEventListener("click", () => deleteCategoryRow(button.dataset.deleteCategory, button.dataset.file));
    });

    initAdminFilePickers(mount);
}

function renderLoaderList() {
    const mount = document.getElementById("loaderList");
    if (!mount) return;

    const config = getCurrentLoaderConfig();

    mount.innerHTML = `
        ${config.items.length ? config.items.map((item, index) => `
            ${editingLoaderItemKey === getLoaderItemDomKey(item, index) ? `
                <form class="list-item loader-logo-form" data-loader-item-key="${escapeHtml(getLoaderItemDomKey(item, index))}">
                    ${renderLoaderItemPreview(item)}
                    <div class="loader-logo-fields">
                        <input type="text" name="label" value="${escapeHtml(item.label || "")}" placeholder="Logo name" required>
                        <input type="color" name="color" value="${escapeHtml(normalizeHexColor(item.color, "#f7a600"))}">
                        <input type="file" name="file" accept=".svg,image/svg+xml">
                        <div class="updates-file-meta">Choose a new SVG file only if you want to replace this logo icon.</div>
                    </div>
                    <div class="compact-actions">
                        <button class="btn-secondary" type="submit">Save</button>
                        <button class="btn-ghost" type="button" data-cancel-loader-item="${escapeHtml(getLoaderItemDomKey(item, index))}">Cancel</button>
                        <button class="btn-danger" type="button" data-delete-loader-item="${escapeHtml(getLoaderItemDomKey(item, index))}">Delete</button>
                    </div>
                </form>
            ` : `
                <div class="list-item loader-logo-card">
                    ${renderLoaderItemPreview(item)}
                    <div class="loader-logo-copy">
                        <strong>${escapeHtml(item.label || `Logo ${index + 1}`)}</strong>
                        <div class="updates-file-meta">${escapeHtml(item.fileName || "")}</div>
                        <div class="updates-file-meta">Color ${escapeHtml(item.color || "")}</div>
                    </div>
                    <div class="compact-actions">
                        <button class="btn-secondary" type="button" data-edit-loader-item="${escapeHtml(getLoaderItemDomKey(item, index))}">Edit</button>
                        <button class="btn-danger" type="button" data-delete-loader-item="${escapeHtml(getLoaderItemDomKey(item, index))}">Delete</button>
                    </div>
                </div>
            `}
        `).join("") : `<div class="empty">No loader logos added yet.</div>`}
    `;

    mount.querySelectorAll(".loader-logo-form").forEach(form => {
        form.addEventListener("submit", saveLoaderItem);
    });

    mount.querySelectorAll("[data-edit-loader-item]").forEach(button => {
        button.addEventListener("click", () => {
            editingLoaderItemKey = button.dataset.editLoaderItem;
            renderLoaderList();
        });
    });

    mount.querySelectorAll("[data-cancel-loader-item]").forEach(button => {
        button.addEventListener("click", () => {
            editingLoaderItemKey = null;
            renderLoaderList();
        });
    });

    mount.querySelectorAll("[data-delete-loader-item]").forEach(button => {
        button.addEventListener("click", () => deleteLoaderItem(button.dataset.deleteLoaderItem));
    });
}

function renderLoaderForm() {
    const config = getCurrentLoaderConfig();
    const cycleInput = document.getElementById("loaderCycleSeconds");
    const orbitInput = document.getElementById("loaderOrbitSeconds");
    if (cycleInput) cycleInput.value = String(config.cycleSeconds);
    if (orbitInput) orbitInput.value = String(config.orbitSeconds);
}

async function connectLoaderProjectFolder() {
    if (!window.showDirectoryPicker) {
        showToast("This browser does not support direct folder editing", "error");
        return false;
    }

    try {
        const handle = await window.showDirectoryPicker({ mode: "readwrite" });
        await ensureLoaderProjectShape(handle);
        projectRootHandle = handle;

        const configFromDisk = await readLoaderConfigFromProject(handle);
        loaderConfigState = configFromDisk;
        showToast("Loader config connected");
        refreshLoaderPanels();
        return true;
    } catch (error) {
        if (error?.name === "AbortError") return false;
        console.error(error);
        showToast(error.message || "Unable to connect project folder", "error");
        return false;
    }
}

async function ensureLoaderProjectConnected() {
    if (projectRootHandle) {
        return true;
    }

    showToast("Connect the local project once to save loader changes");
    return connectLoaderProjectFolder();
}

function getLoaderRootFolderError() {
    return "Choose the Final Supabase project root folder that contains admin, components, and images.";
}

async function ensureLoaderProjectShape(rootHandle) {
    const imagesHandle = await rootHandle.getDirectoryHandle("images");
    await imagesHandle.getDirectoryHandle("loader");
    const componentsHandle = await rootHandle.getDirectoryHandle("components");
    const configHandle = await componentsHandle.getDirectoryHandle("config");
    await configHandle.getFileHandle("loader-config.json");
}

async function readLoaderConfigFromProject(rootHandle) {
    const configHandle = await getLoaderConfigFileHandle(rootHandle);
    const configFile = await configHandle.getFile();
    const rawConfig = await configFile.text();
    const parsedConfig = hasStructuredLoaderConfig(rawConfig)
        ? normalizeLoaderConfig(rawConfig)
        : getDefaultLoaderConfig();

    const folderFiles = await listLoaderSvgFileNames(rootHandle);
    const mergedItems = mergeLoaderItemsWithFolder(parsedConfig.items, folderFiles);
    const nextConfig = normalizeLoaderConfig({
        ...parsedConfig,
        items: mergedItems,
        customAssets: parsedConfig.customAssets || {}
    });

    setLoaderBaseConfig(nextConfig);
    return nextConfig;
}

async function writeLoaderConfigToProject(rootHandle, config) {
    const configHandle = await getLoaderConfigFileHandle(rootHandle);
    const writable = await configHandle.createWritable();
    await writable.write(JSON.stringify(config, null, 2));
    await writable.close();
}

async function listLoaderSvgFileNames(rootHandle) {
    const loaderDirHandle = await getLoaderDirectoryHandle(rootHandle);
    const names = [];

    for await (const [name, handle] of loaderDirHandle.entries()) {
        if (handle.kind === "file" && /\.svg$/i.test(name)) {
            names.push(name);
        }
    }

    names.sort((first, second) => first.localeCompare(second, undefined, { sensitivity: "base" }));
    return names;
}

async function writeNewLoaderSvgFile(loaderDirectoryHandle, file, label) {
    const rawBaseName = slugifyLoaderAssetName(label || file.name.replace(/\.svg$/i, ""));
    let fileName = `${rawBaseName}.svg`;
    let counter = 2;

    while (await fileExists(loaderDirectoryHandle, fileName)) {
        fileName = `${rawBaseName}-${counter}.svg`;
        counter += 1;
    }

    const fileHandle = await loaderDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await file.text());
    await writable.close();
    return fileName;
}

async function replaceLoaderSvgFile(rootHandle, targetFileName, file) {
    const loaderDirectoryHandle = await getLoaderDirectoryHandle(rootHandle);
    const fileHandle = await loaderDirectoryHandle.getFileHandle(targetFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(await file.text());
    await writable.close();
}

async function deleteLoaderSvgFile(rootHandle, fileName) {
    const loaderDirectoryHandle = await getLoaderDirectoryHandle(rootHandle);
    await loaderDirectoryHandle.removeEntry(fileName);
}

async function fileExists(directoryHandle, fileName) {
    try {
        await directoryHandle.getFileHandle(fileName);
        return true;
    } catch {
        return false;
    }
}

function mergeLoaderItemsWithFolder(items, folderFileNames) {
    const normalizedItems = Array.isArray(items) ? items.map(item => ({ ...item })) : [];
    const existingByFileName = new Map(
        normalizedItems.map(item => [String(item.fileName || "").toLowerCase(), item])
    );

    folderFileNames.forEach((fileName, index) => {
        const fileKey = String(fileName || "").toLowerCase();
        if (existingByFileName.has(fileKey)) return;

        const fallback = getDefaultLoaderConfig().items[index] || getDefaultLoaderConfig().items[0];
        normalizedItems.push({
            key: slugifyLoaderAssetName(fileName.replace(/\.svg$/i, "")),
            source: "local",
            label: fileName.replace(/\.svg$/i, ""),
            fileName,
            color: fallback?.color || "#f7a600"
        });
    });

    return normalizedItems.filter(item => folderFileNames.some(fileName => String(fileName).toLowerCase() === String(item.fileName || "").toLowerCase()));
}

async function getLoaderDirectoryHandle(rootHandle) {
    const imagesHandle = await rootHandle.getDirectoryHandle("images");
    return imagesHandle.getDirectoryHandle("loader");
}

async function getLoaderConfigFileHandle(rootHandle) {
    const componentsHandle = await rootHandle.getDirectoryHandle("components");
    const configHandle = await componentsHandle.getDirectoryHandle("config");
    return configHandle.getFileHandle("loader-config.json");
}

function renderSiteLogoList() {
    const mount = document.getElementById("siteLogoList");
    if (!mount) return;

    const fileName = getAppConfigLogoFileName(appConfig);
    if (!fileName) {
        mount.innerHTML = `<div class="empty">No site logo configured yet.</div>`;
        return;
    }

    mount.innerHTML = `
        <div class="list-item">
            <strong>Current site logo</strong>
            <div class="updates-file-meta">${escapeHtml(fileName)}</div>
            <img class="preview-image" src="${getStoragePublicUrl("Food-Website-Storage", `Logo/${fileName}`)}" alt="Current site logo">
        </div>
    `;
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

async function saveSiteLogo(event) {
    event.preventDefault();

    const file = document.getElementById("siteLogoAsset").files[0];
    if (!file) {
        showToast("Choose a logo file first", "error");
        return;
    }

    const fileName = fileNameWithTimestamp(file);
    const previousFileName = getAppConfigLogoFileName(appConfig);

    try {
        await uploadToStorage("Food-Website-Storage", `Logo/${fileName}`, file);

        const payload = setAppConfigLogoValue({
            ...(appConfig || {}),
            ...(appConfig?.id ? { id: appConfig.id } : {}),
        }, appConfig, [{ file_name: fileName }]);

        const query = appConfig?.id
            ? supabase.from("app_config").update(payload).eq("id", appConfig.id)
            : supabase.from("app_config").insert([payload]);

        const { error } = await query;
        if (error) throw error;

        if (previousFileName && previousFileName !== fileName) {
            await removeFromStorage("Food-Website-Storage", `Logo/${previousFileName}`);
        }

        showToast("Site logo updated");
        document.getElementById("siteLogoForm").reset();
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        try {
            await removeFromStorage("Food-Website-Storage", `Logo/${fileName}`);
        } catch (cleanupError) {
            console.error(cleanupError);
        }
        showToast(error.message || "Unable to save site logo", "error");
    }
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

async function addCategoryRow(event) {
    event.preventDefault();

    const name = document.getElementById("categoryName").value.trim();
    const imageFile = document.getElementById("categoryImage").files[0];
    if (!name || !imageFile) {
        showToast("Enter category name and image", "error");
        return;
    }

    const fileName = fileNameWithTimestamp(imageFile);

    try {
        await uploadToStorage("Food-Website-Storage", `category/${fileName}`, imageFile);
        const { error } = await supabase
            .from("category")
            .insert([{ category_name: name, display_image: fileName }]);

        if (error) throw error;

        showToast("Category added");
        document.getElementById("categoryForm").reset();
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to add category", "error");
    }
}

async function saveCategoryRow(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const categoryId = form.dataset.categoryId;
    const existingRow = categoryRows.find(item => String(item.id ?? item.category_name) === String(categoryId));
    const currentImage = form.dataset.currentImage || "";
    const imageFile = form.elements.display_image.files[0];
    let fileName = currentImage;

    try {
        if (imageFile) {
            fileName = fileNameWithTimestamp(imageFile);
            await uploadToStorage("Food-Website-Storage", `category/${fileName}`, imageFile);
            if (currentImage && currentImage !== fileName) {
                await removeFromStorage("Food-Website-Storage", `category/${currentImage}`);
            }
        }

        const payload = {
            category_name: form.elements.category_name.value.trim(),
            display_image: fileName || null
        };

        const { error } = await matchCategoryRow(
            supabase.from("category").update(payload),
            existingRow,
            categoryId
        );

        if (error) throw error;

        showToast("Category updated");
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update category", "error");
    }
}

async function deleteCategoryRow(categoryId, fileName) {
    const confirmed = window.confirm("Delete this category?");
    if (!confirmed) return;

    try {
        const existingRow = categoryRows.find(item => String(item.id ?? item.category_name) === String(categoryId));
        const { error } = await matchCategoryRow(
            supabase.from("category").delete(),
            existingRow,
            categoryId
        );

        if (error) throw error;
        if (fileName) {
            await removeFromStorage("Food-Website-Storage", `category/${fileName}`);
        }

        showToast("Category deleted");
        await loadUpdateData();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to delete category", "error");
    }
}

function getCurrentLoaderConfig() {
    return normalizeLoaderConfig(loaderConfigState);
}

function getLoaderItemDomKey(item, index) {
    return `${String(item?.key || "loader-item").trim().toLowerCase()}::${index}`;
}

function renderLoaderItemPreview(item) {
    return `
        <div class="loader-item-thumb">
            ${item?.source === "custom" && item?.svg
                ? `<div class="loader-inline-asset-preview">${item.svg}</div>`
                : `<img class="loader-asset-thumb" src="../${escapeHtml(getLoaderImagePath(item?.fileName || ""))}" alt="${escapeHtml(item?.label || "Loader icon")}">`
            }
        </div>
    `;
}

function getLoaderItemIndexByDomKey(config, domKey) {
    return config.items.findIndex((item, index) => getLoaderItemDomKey(item, index) === domKey);
}

async function saveLoaderSpeed(event) {
    event.preventDefault();

    try {
        const currentConfig = getCurrentLoaderConfig();
        const nextConfig = normalizeLoaderConfig({
            ...currentConfig,
            cycleSeconds: document.getElementById("loaderCycleSeconds")?.value || currentConfig.cycleSeconds,
            orbitSeconds: document.getElementById("loaderOrbitSeconds")?.value || currentConfig.orbitSeconds,
            items: currentConfig.items,
            customAssets: currentConfig.customAssets || {}
        });

        await saveLoaderConfig(nextConfig);
        showToast("Loader speed updated");
        refreshLoaderPanels();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to save loader speed", "error");
    }
}

async function addLoaderLogo(event) {
    event.preventDefault();

    const labelInput = document.getElementById("loaderNewLabel");
    const colorInput = document.getElementById("loaderNewColor");
    const fileInput = document.getElementById("loaderNewFile");
    const file = fileInput?.files?.[0];

    if (!file) {
        showToast("Choose an SVG file first", "error");
        return;
    }

    if (!/\.svg$/i.test(file.name)) {
        showToast("Please choose an SVG file", "error");
        return;
    }

    try {
        const isConnected = await ensureLoaderProjectConnected();
        if (!isConnected) {
            return;
        }

        const currentConfig = getCurrentLoaderConfig();
        const loaderDirectoryHandle = await getLoaderDirectoryHandle(projectRootHandle);
        const label = String(labelInput?.value || file.name.replace(/\.svg$/i, "")).trim() || "Loader Logo";
        const key = slugifyLoaderAssetName(label);
        const color = normalizeHexColor(colorInput?.value, "#f7a600");
        const fileName = await writeNewLoaderSvgFile(loaderDirectoryHandle, file, label);

        const nextConfig = normalizeLoaderConfig({
            ...currentConfig,
            items: [
                ...currentConfig.items,
                { key, source: "local", label, fileName, color }
            ],
            customAssets: {}
        });

        await saveLoaderConfig(nextConfig);
        showToast("Loader logo added");
        document.getElementById("loaderAddForm")?.reset();
        const newColorInput = document.getElementById("loaderNewColor");
        if (newColorInput) newColorInput.value = "#f7a600";
        refreshLoaderPanels();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to add loader logo", "error");
    }
}

async function saveLoaderItem(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const itemKey = form.dataset.loaderItemKey;
    const currentConfig = getCurrentLoaderConfig();
    const itemIndex = getLoaderItemIndexByDomKey(currentConfig, itemKey);
    if (itemIndex < 0) return;

    const currentItem = currentConfig.items[itemIndex];
    const nextItems = currentConfig.items.map(item => ({ ...item }));
    const nextLabel = form.elements.label.value.trim() || currentItem.label || `Logo ${itemIndex + 1}`;
    const nextColor = normalizeHexColor(form.elements.color.value, currentItem.color || "#f7a600");
    const nextFile = form.elements.file.files?.[0];

    try {
        const isConnected = await ensureLoaderProjectConnected();
        if (!isConnected) {
            return;
        }

        let nextItem = {
            ...currentItem,
            label: nextLabel,
            color: nextColor
        };

        if (nextFile) {
            if (!/\.svg$/i.test(nextFile.name)) {
                throw new Error("Please choose an SVG file");
            }

            const loaderDirectoryHandle = await getLoaderDirectoryHandle(projectRootHandle);
            const nextFileName = await writeNewLoaderSvgFile(loaderDirectoryHandle, nextFile, nextLabel);

            nextItem = {
                key: nextItem.key,
                source: "local",
                label: nextLabel,
                fileName: nextFileName,
                color: nextColor
            };
        }

        nextItems[itemIndex] = nextItem;

        const nextConfig = normalizeLoaderConfig({
            ...currentConfig,
            items: nextItems,
            customAssets: {}
        });

        await saveLoaderConfig(nextConfig);

        if (nextFile && currentItem.fileName && currentItem.fileName !== nextItem.fileName) {
            const stillUsed = nextItems.some((item, index) => (
                index !== itemIndex &&
                String(item.fileName || "").toLowerCase() === String(currentItem.fileName || "").toLowerCase()
            ));

            if (!stillUsed) {
                await deleteLoaderSvgFile(projectRootHandle, currentItem.fileName);
            }
        }

        showToast("Loader logo updated");
        editingLoaderItemKey = null;
        refreshLoaderPanels();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to update loader logo", "error");
    }
}

async function deleteLoaderItem(domKey) {
    const currentConfig = getCurrentLoaderConfig();
    const itemIndex = getLoaderItemIndexByDomKey(currentConfig, domKey);
    if (itemIndex < 0) return;

    if (currentConfig.items.length <= 1) {
        showToast("At least one loader logo is required", "error");
        return;
    }

    try {
        const isConnected = await ensureLoaderProjectConnected();
        if (!isConnected) {
            return;
        }

        const removedItem = currentConfig.items[itemIndex];
        const nextItems = currentConfig.items.filter((_, index) => index !== itemIndex);
        const stillUsed = nextItems.some(item => String(item.fileName || "").toLowerCase() === String(removedItem.fileName || "").toLowerCase());
        if (!stillUsed) {
            await deleteLoaderSvgFile(projectRootHandle, removedItem.fileName);
        }

        const nextConfig = normalizeLoaderConfig({
            ...currentConfig,
            items: nextItems,
            customAssets: {}
        });

        await saveLoaderConfig(nextConfig);
        showToast("Loader logo deleted");
        editingLoaderItemKey = null;
        refreshLoaderPanels();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to delete loader logo", "error");
    }
}

async function saveLoaderConfig(config) {
    const nextConfig = normalizeLoaderConfig(config);
    loaderConfigState = nextConfig;
    setLoaderBaseConfig(nextConfig);

    const isConnected = await ensureLoaderProjectConnected();
    if (!isConnected) {
        throw new Error("Local project connection is required to save loader changes");
    }

    await writeLoaderConfigToProject(projectRootHandle, nextConfig);
}

function slugifyLoaderAssetName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `loader-${Date.now()}`;
}

function normalizeHexColor(value, fallback) {
    const raw = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(raw) ? raw : fallback;
}

function matchCategoryRow(query, row, fallbackId) {
    if (row?.id !== undefined && row?.id !== null && row.id !== "") {
        return query.eq("id", row.id);
    }

    return query.eq("category_name", row?.category_name || fallbackId);
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

function getAppConfigLogoFileName(configRow) {
    return getFirstAppConfigFileName(configRow?.Logo ?? configRow?.logo ?? null);
}

function normalizeLogoValue(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        const raw = value.trim();
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [raw];
        }
    }

    if (typeof value === "object") {
        return [value];
    }

    return [];
}

function setAppConfigLogoValue(payload, sourceConfig, value) {
    const logoKey = Object.prototype.hasOwnProperty.call(sourceConfig || {}, "logo")
        ? "logo"
        : "Logo";

    return {
        ...payload,
        [logoKey]: value
    };
}

function getAppConfigLoaderFileName(configRow) {
    return getFirstAppConfigFileName(configRow?.Loader ?? configRow?.loader ?? null);
}

function getFirstAppConfigFileName(rawValue) {
    if (!rawValue) return "";

    const items = normalizeLogoValue(rawValue);
    const firstItem = items[0];
    if (!firstItem) return "";

    if (typeof firstItem === "string") {
        return firstItem.trim();
    }

    return String(firstItem.file_name || firstItem.fileName || firstItem.name || "").trim();
}

function setAppConfigLoaderValue(payload, sourceConfig, value) {
    const loaderKey = Object.prototype.hasOwnProperty.call(sourceConfig || {}, "loader")
        ? "loader"
        : "Loader";

    return {
        ...payload,
        [loaderKey]: value
    };
}

async function archiveStorageFile(folder, originalName) {
    if (!originalName) return "";

    const cleanFolder = String(folder || "").trim().replace(/^\/+|\/+$/g, "");
    const cleanName = String(originalName || "").trim();
    if (!cleanFolder || !cleanName) return "";

    for (let index = 0; index <= 50; index += 1) {
        const archivedName = index === 0 ? `old_${cleanName}` : `old_${index}_${cleanName}`;
        try {
            await moveInStorage("Food-Website-Storage", `${cleanFolder}/${cleanName}`, `${cleanFolder}/${archivedName}`);
            return archivedName;
        } catch (error) {
            const message = String(error?.message || "").toLowerCase();
            if (message.includes("already exists") || message.includes("duplicate")) {
                continue;
            }
            throw error;
        }
    }

    throw new Error(`Unable to archive previous file for ${cleanFolder}`);
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
