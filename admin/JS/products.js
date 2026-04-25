import {
    renderAdminShell,
    supabase,
    showToast,
    formatCurrency,
    escapeHtml,
    fileNameWithTimestamp,
    uploadToStorage,
    removeFromStorage,
    getStoragePublicUrl,
    initAdminFilePickers
} from "./common.js";

let products = [];
let editingId = null;
let mobileEditingId = null;
let existingImageName = null;
let removeExistingImage = false;
let previewUrl = null;
let mobilePreviewUrl = null;
let canAddProducts = false;
let canEditProducts = false;
let canControlStockVisibility = false;
let canControlQtyVisibility = false;

document.addEventListener("DOMContentLoaded", initProducts);

async function initProducts() {
    const view = await renderAdminShell({
        title: "Products",
        subtitle: "Product access is filtered by product view, add, edit, and stock-related powers.",
        requiredAnyPower: ["product_view", "product_add", "product_edit", "product_disable_stock", "product_disable_qty"]
    });

    if (!view?.root) return;

    const { root, hasPower } = view;
    canAddProducts = hasPower("product_add");
    canEditProducts = hasPower("product_edit");
    canControlStockVisibility = hasPower("product_disable_stock");
    canControlQtyVisibility = hasPower("product_disable_qty");

    root.innerHTML = `
        <div class="split products-split">
            <div class="card products-left-card" ${canAddProducts || canEditProducts ? "" : "hidden"}>
                <h3 id="productFormTitle">Add Product</h3>
                <form id="productForm" class="form-grid">
                    <label>
                        <span>Product Name</span>
                        <input type="text" id="productName" placeholder="Enter product name" required>
                    </label>
                    <label>
                        <span>Price</span>
                        <input type="number" id="productPrice" placeholder="Enter price" min="0" step="0.01" required>
                    </label>
                    <label>
                        <span>Quantity / Stock</span>
                        <input type="number" id="productStock" placeholder="Enter stock quantity" min="0" required>
                    </label>
                    <label>
                        <span>Category</span>
                        <input type="text" id="productCategory" placeholder="Enter category" required>
                    </label>
                    <label ${canControlStockVisibility ? "" : "hidden"}>
                        <span>Status</span>
                        <select id="productStatus">
                            <option value="enabled">enabled</option>
                            <option value="disabled">disabled</option>
                        </select>
                    </label>
                    <label ${canControlQtyVisibility ? "" : "hidden"}>
                        <span>Stock Quantity Display</span>
                        <select id="stockStatus">
                            <option value="show">show stock qty</option>
                            <option value="hide">hide stock qty</option>
                        </select>
                    </label>
                    <label class="full">
                        <span>Product ID</span>
                        <input class="readonly-field" type="text" id="productId" readonly>
                    </label>
                    <label class="full">
                        <span>Product Image</span>
                        <input class="full" type="file" id="productImage" accept="image/*">
                    </label>
                    <div class="full image-preview-card">
                        <span>Image Preview</span>
                        <div id="productImagePreview" class="image-preview-empty">No image selected</div>
                        <div class="compact-actions">
                            <button class="btn-danger" type="button" id="removeProductImage">Remove Image</button>
                        </div>
                    </div>
                    <div class="full compact-actions">
                        <button class="btn" type="submit" id="submitProductForm">Save</button>
                        <button class="btn-ghost" type="button" id="resetProductForm">Discard</button>
                    </div>
                </form>
            </div>
            <div class="card products-right-card">
                <div class="toolbar">
                    <input id="productSearch" type="search" placeholder="Search products">
                    <button class="btn-ghost" type="button" id="toggleProductFilters">Filters</button>
                    <button class="btn-ghost" id="refreshProducts">Refresh</button>
                </div>
                <div class="toolbar product-filters" id="productFiltersPanel" style="display:none;">
                    <select id="filterCategory">
                        <option value="">All Categories</option>
                    </select>
                    <select id="filterStatus">
                        <option value="">All Status</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                    </select>
                    <select id="sortBy">
                        <option value="">Default Sort</option>
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                        <option value="price-desc">Price Highest to Lowest</option>
                        <option value="price-asc">Price Lowest to Highest</option>
                        <option value="id-asc">Product ID A-Z</option>
                        <option value="id-desc">Product ID Z-A</option>
                    </select>
                    <button class="btn-secondary" type="button" id="applyProductFilters">Apply Filter</button>
                    <button class="btn-ghost" type="button" id="resetProductFilters">Reset</button>
                </div>
                <div class="table-wrap products-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="productsTable"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById("productForm")?.addEventListener("submit", submitProduct);
    document.getElementById("resetProductForm")?.addEventListener("click", resetForm);
    document.getElementById("productImage")?.addEventListener("change", handleImageSelection);
    document.getElementById("removeProductImage")?.addEventListener("click", clearSelectedImage);
    document.getElementById("productSearch").addEventListener("input", renderProducts);
    document.getElementById("toggleProductFilters").addEventListener("click", toggleFiltersPanel);
    document.getElementById("applyProductFilters").addEventListener("click", renderProducts);
    document.getElementById("resetProductFilters").addEventListener("click", resetFilters);
    document.getElementById("refreshProducts").addEventListener("click", loadProducts);
    bindRestrictedProductControls();
    initAdminFilePickers(root);

    await loadProducts();
}

async function loadProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

    if (error) {
        showToast(error.message || "Unable to load products", "error");
        return;
    }

    products = data || [];
    populateCategoryFilter();
    if (!editingId) {
        setNextProductId();
    }
    renderProducts();
}

function renderProducts() {
    const table = document.getElementById("productsTable");
    if (!table) return;

    const search = document.getElementById("productSearch").value.trim().toLowerCase();
    const categoryFilter = document.getElementById("filterCategory")?.value || "";
    const statusFilter = document.getElementById("filterStatus")?.value || "";
    const sortBy = document.getElementById("sortBy")?.value || "";

    let filtered = products.filter(product => {
        const haystack = `${product.name || ""} ${product.category || ""} ${product.id || ""}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesCategory = !categoryFilter || String(product.category || "") === categoryFilter;
        const matchesStatus = !statusFilter || String(product.Status || "").toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesCategory && matchesStatus;
    });

    filtered = sortProducts(filtered, sortBy);

    if (!filtered.length) {
        table.innerHTML = `<tr><td colspan="6" class="empty">No products found.</td></tr>`;
        return;
    }

    table.innerHTML = filtered.map(product => {
        if (isMobileView() && mobileEditingId === product.id) {
            return getMobileInlineDesktopEditor(product);
        }

        return `
            <tr data-row-id="${escapeHtml(product.id)}">
                <td>
                    ${product.image ? `<img class="thumb" src="${getStoragePublicUrl("Food-Website-Storage", `Products/${product.image}`)}" alt="${escapeHtml(product.name)}">` : ""}
                </td>
                <td>
                    <strong>${escapeHtml(product.name)}</strong>
                    <div class="muted code">${escapeHtml(product.id)}</div>
                </td>
                <td>${escapeHtml(product.category)}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${escapeHtml(product.stock)}</td>
                <td>
                    <div class="compact-actions">
                        ${canEditProducts ? `<button class="btn-secondary" data-edit="${escapeHtml(product.id)}">Edit</button>` : `<span class="muted">View only</span>`}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    table.querySelectorAll("[data-edit]").forEach(button => {
        button.addEventListener("click", () => handleEdit(button.dataset.edit));
    });

    bindMobileInlineEditor();
    initAdminFilePickers(table);
}

function handleEdit(id) {
    if (!canEditProducts) return;

    if (isMobileView()) {
        mobileEditingId = mobileEditingId === id ? null : id;
        clearMobilePreviewUrl();
        renderProducts();
        return;
    }

    fillEditForm(id);
}

function fillEditForm(id) {
    const product = products.find(item => String(item.id) === String(id));
    if (!product) return;

    editingId = product.id;
    existingImageName = product.image || null;
    removeExistingImage = false;
    document.getElementById("productFormTitle").textContent = `Edit Product: ${product.name}`;
    document.getElementById("submitProductForm").textContent = "Save";
    document.getElementById("resetProductForm").textContent = "Discard";
    document.getElementById("productId").value = product.id || "";
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productPrice").value = product.price ?? "";
    document.getElementById("productStock").value = product.stock ?? "";
    document.getElementById("productCategory").value = product.category || "";
    document.getElementById("productStatus").value = product.Status || "enabled";
    document.getElementById("stockStatus").value = product.Stock_qty_Status || "show";
    syncRestrictedProductControls();
    document.getElementById("productImage").value = "";
    renderImagePreview();

    const formCard = document.querySelector(".products-left-card");
    if (formCard) {
        formCard.scrollTo({ top: 0, behavior: "smooth" });
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function resetForm() {
    editingId = null;
    mobileEditingId = null;
    existingImageName = null;
    removeExistingImage = false;
    document.getElementById("productFormTitle").textContent = "Add Product";
    document.getElementById("submitProductForm").textContent = "Save";
    document.getElementById("resetProductForm").textContent = "Discard";
    document.getElementById("productForm").reset();
    document.getElementById("productStatus").value = "enabled";
    document.getElementById("stockStatus").value = "show";
    syncRestrictedProductControls();
    setNextProductId();
    clearPreviewUrl();
    renderImagePreview();
}

async function submitProduct(event) {
    event.preventDefault();

    const productIdField = document.getElementById("productId");

    await saveProductRecord({
        productId: editingId || productIdField.value.trim(),
        name: document.getElementById("productName").value.trim(),
        price: Number(document.getElementById("productPrice").value),
        stock: Number(document.getElementById("productStock").value),
        category: document.getElementById("productCategory").value.trim(),
        status: document.getElementById("productStatus").value,
        stockStatus: document.getElementById("stockStatus").value,
        imageFile: document.getElementById("productImage").files[0],
        originalImageName: existingImageName,
        removeOriginalImage: removeExistingImage,
        editId: editingId
    });
}

async function saveProductRecord({
    productId,
    name,
    price,
    stock,
    category,
    status,
    stockStatus,
    imageFile,
    originalImageName = null,
    removeOriginalImage = false,
    editId = null
}) {
    if (!editId && !canAddProducts) {
        showToast("You do not have permission to add products", "error");
        return;
    }

    if (editId && !canEditProducts) {
        showToast("You do not have permission to edit products", "error");
        return;
    }

    let imageName = removeOriginalImage ? null : originalImageName;

    try {
        if (!canControlQtyVisibility && String(stockStatus || "").toLowerCase() !== "show") {
            showToast("You don't have access to disable stock quantity", "error");
            syncRestrictedProductControls();
            return;
        }

        if (!canControlStockVisibility && String(status || "").toLowerCase() !== "enabled") {
            showToast("You don't have access to disable products", "error");
            syncRestrictedProductControls();
            return;
        }

        if (status === "enabled" && !imageFile && !imageName) {
            showToast("Enabled products must have an image", "error");
            return;
        }

        if (imageFile) {
            imageName = fileNameWithTimestamp(imageFile);
            await uploadToStorage("Food-Website-Storage", `Products/${imageName}`, imageFile);
        }

        const payload = {
            id: productId,
            name,
            price,
            stock,
            category,
            Status: canControlStockVisibility ? status : "enabled",
            Stock_qty_Status: canControlQtyVisibility ? stockStatus : "show",
            image: imageName
        };

        let query = supabase.from("products");
        let response;

        if (editId) {
            response = await query.update(payload).eq("id", editId);
        } else {
            response = await query.insert([payload]);
        }

        if (response.error) throw response.error;

        if (originalImageName && (removeOriginalImage || (imageFile && originalImageName !== imageName))) {
            await removeFromStorage("Food-Website-Storage", `Products/${originalImageName}`);
        }

        showToast(editId ? "Product updated" : "Product added");
        resetForm();
        await loadProducts();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Unable to save product", "error");
    }
}

async function deleteProduct(id) {
    showToast("Delete is not assigned to the current RBAC power set", "error");
}

function setNextProductId() {
    const productIdField = document.getElementById("productId");
    if (!productIdField) return;

    productIdField.value = getNextProductId(products);
}

function getNextProductId(rows) {
    const maxNumber = (rows || []).reduce((max, product) => {
        const match = String(product.id || "").trim().match(/^p(\d+)$/i);
        if (!match) return max;
        return Math.max(max, Number(match[1]));
    }, 0);

    return `P${maxNumber + 1}`;
}

function populateCategoryFilter() {
    const select = document.getElementById("filterCategory");
    if (!select) return;

    const currentValue = select.value;
    const categories = [...new Set(
        products
            .map(product => String(product.category || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    select.innerHTML = `
        <option value="">All Categories</option>
        ${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
    `;

    select.value = categories.includes(currentValue) ? currentValue : "";
}

function toggleFiltersPanel() {
    const panel = document.getElementById("productFiltersPanel");
    if (!panel) return;

    panel.style.display = panel.style.display === "none" ? "flex" : "none";
}

function bindRestrictedProductControls() {
    const productStatus = document.getElementById("productStatus");
    const stockStatus = document.getElementById("stockStatus");

    if (productStatus && !canControlStockVisibility) {
        productStatus.disabled = true;
        productStatus.addEventListener("change", () => {
            productStatus.value = "enabled";
            showToast("You don't have access to disable products", "error");
        });
    }

    if (stockStatus && !canControlQtyVisibility) {
        stockStatus.disabled = true;
        stockStatus.addEventListener("change", () => {
            stockStatus.value = "show";
            showToast("You don't have access to disable stock quantity", "error");
        });
    }

    syncRestrictedProductControls();
}

function syncRestrictedProductControls() {
    const productStatus = document.getElementById("productStatus");
    const stockStatus = document.getElementById("stockStatus");

    if (productStatus && !canControlStockVisibility) {
        productStatus.value = "enabled";
        productStatus.disabled = true;
    }

    if (stockStatus && !canControlQtyVisibility) {
        stockStatus.value = "show";
        stockStatus.disabled = true;
    }
}

function resetFilters() {
    const category = document.getElementById("filterCategory");
    const status = document.getElementById("filterStatus");
    const sort = document.getElementById("sortBy");

    if (category) category.value = "";
    if (status) status.value = "";
    if (sort) sort.value = "";

    renderProducts();
}

function sortProducts(rows, sortBy) {
    const sorted = [...rows];

    switch (sortBy) {
        case "name-asc":
            return sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        case "name-desc":
            return sorted.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
        case "price-desc":
            return sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        case "price-asc":
            return sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        case "id-asc":
            return sorted.sort((a, b) => compareProductIds(a.id, b.id));
        case "id-desc":
            return sorted.sort((a, b) => compareProductIds(b.id, a.id));
        default:
            return sorted;
    }
}

function compareProductIds(first, second) {
    const a = String(first || "");
    const b = String(second || "");
    const matchA = a.match(/^p(\d+)$/i);
    const matchB = b.match(/^p(\d+)$/i);

    if (matchA && matchB) {
        return Number(matchA[1]) - Number(matchB[1]);
    }

    return a.localeCompare(b);
}

function handleImageSelection(event) {
    const file = event.target.files[0];
    if (!file) {
        renderImagePreview();
        return;
    }

    clearPreviewUrl();
    previewUrl = URL.createObjectURL(file);
    removeExistingImage = false;
    renderImagePreview();
}

function clearSelectedImage() {
    const input = document.getElementById("productImage");
    if (input) {
        input.value = "";
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    clearPreviewUrl();

    if (existingImageName) {
        removeExistingImage = true;
    }

    renderImagePreview();
}

function renderImagePreview() {
    const preview = document.getElementById("productImagePreview");
    if (!preview) return;

    const file = document.getElementById("productImage")?.files?.[0];
    const currentImageName = removeExistingImage ? null : existingImageName;

    if (previewUrl && file) {
        preview.innerHTML = `
            <img class="preview-image" src="${previewUrl}" alt="Selected image preview">
            <div class="muted">New image selected: ${escapeHtml(file.name)}</div>
        `;
        preview.className = "image-preview-box";
        return;
    }

    if (currentImageName) {
        preview.innerHTML = `
            <img class="preview-image" src="${getStoragePublicUrl("Food-Website-Storage", `Products/${currentImageName}`)}" alt="Current product image">
            <div class="muted">Current image: ${escapeHtml(currentImageName)}</div>
        `;
        preview.className = "image-preview-box";
        return;
    }

    preview.textContent = "No image selected";
    preview.className = "image-preview-empty";
}

function clearPreviewUrl() {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
}

function isMobileView() {
    return window.matchMedia("(max-width: 640px)").matches;
}

function getMobileInlineDesktopEditor(product) {
    if (!canEditProducts) {
        return `
            <tr data-row-id="${escapeHtml(product.id)}">
                <td>
                    ${product.image ? `<img class="thumb" src="${getStoragePublicUrl("Food-Website-Storage", `Products/${product.image}`)}" alt="${escapeHtml(product.name)}">` : ""}
                </td>
                <td>
                    <strong>${escapeHtml(product.name)}</strong>
                    <div class="muted code">${escapeHtml(product.id)}</div>
                </td>
                <td>${escapeHtml(product.category)}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${escapeHtml(product.stock)}</td>
                <td><span class="muted">View only</span></td>
            </tr>
        `;
    }

    return `
        <tr class="mobile-edit-shell">
            <td colspan="6">
                <div class="mobile-desktop-editor" data-mobile-editor="${escapeHtml(product.id)}" data-existing-image="${escapeHtml(product.image || "")}" data-remove-image="false">
                    <h3>Edit Product: ${escapeHtml(product.name)}</h3>
                    <div class="form-grid">
                        <label>
                            <span>Product Name</span>
                            <input type="text" name="name" value="${escapeHtml(product.name || "")}" required>
                        </label>
                        <label>
                            <span>Price</span>
                            <input type="number" name="price" value="${escapeHtml(product.price ?? "")}" min="0" step="0.01" required>
                        </label>
                        <label>
                            <span>Quantity / Stock</span>
                            <input type="number" name="stock" value="${escapeHtml(product.stock ?? "")}" min="0" required>
                        </label>
                        <label>
                            <span>Category</span>
                            <input type="text" name="category" value="${escapeHtml(product.category || "")}" required>
                        </label>
                        <label ${canControlStockVisibility ? "" : "hidden"}>
                            <span>Status</span>
                            <select name="status">
                                <option value="enabled" ${String(product.Status).toLowerCase() === "enabled" ? "selected" : ""}>enabled</option>
                                <option value="disabled" ${String(product.Status).toLowerCase() === "disabled" ? "selected" : ""}>disabled</option>
                            </select>
                        </label>
                        <label ${canControlQtyVisibility ? "" : "hidden"}>
                            <span>Stock Quantity Display</span>
                            <select name="stockStatus">
                                <option value="show" ${String(product.Stock_qty_Status).toLowerCase() === "show" ? "selected" : ""}>show stock qty</option>
                                <option value="hide" ${String(product.Stock_qty_Status).toLowerCase() === "hide" ? "selected" : ""}>hide stock qty</option>
                            </select>
                        </label>
                        <label class="full">
                            <span>Product ID</span>
                            <input class="readonly-field" type="text" value="${escapeHtml(product.id || "")}" readonly>
                        </label>
                        <label class="full">
                            <span>Product Image</span>
                            <input type="file" name="image" accept="image/*">
                        </label>
                        <div class="full image-preview-card">
                            <span>Image Preview</span>
                            <div class="mobile-editor-preview image-preview-box" data-mobile-preview>
                                ${product.image ? `
                                    <img class="preview-image" src="${getStoragePublicUrl("Food-Website-Storage", `Products/${product.image}`)}" alt="Current product image">
                                    <div class="muted">Current image: ${escapeHtml(product.image)}</div>
                                ` : `No image selected`}
                            </div>
                            <div class="compact-actions">
                                <button class="btn-danger" type="button" data-mobile-remove-image="${escapeHtml(product.id)}">Remove Image</button>
                            </div>
                        </div>
                        <div class="full compact-actions">
                            <button class="btn" type="button" data-mobile-save="${escapeHtml(product.id)}">Save</button>
                            <button class="btn-ghost" type="button" data-mobile-discard="${escapeHtml(product.id)}">Discard</button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function bindMobileInlineEditor() {
    document.querySelectorAll("[data-mobile-discard]").forEach(button => {
        button.addEventListener("click", () => {
            mobileEditingId = null;
            clearMobilePreviewUrl();
            renderProducts();
        });
    });

    document.querySelectorAll("[data-mobile-remove-image]").forEach(button => {
        button.addEventListener("click", () => {
            const editor = button.closest("[data-mobile-editor]");
            if (!editor) return;
            editor.dataset.removeImage = "true";
            const input = editor.querySelector('input[name="image"]');
            if (input) input.value = "";
            updateMobileInlinePreview(editor);
        });
    });

    document.querySelectorAll("[data-mobile-editor]").forEach(editor => {
        const input = editor.querySelector('input[name="image"]');
        if (input) {
            input.addEventListener("change", () => {
                editor.dataset.removeImage = "false";
                updateMobileInlinePreview(editor);
            });
        }
    });

    document.querySelectorAll("[data-mobile-save]").forEach(button => {
        button.addEventListener("click", async () => {
            const editor = button.closest("[data-mobile-editor]");
            if (!editor) return;

            await saveProductRecord({
                productId: editor.dataset.mobileEditor,
                name: editor.querySelector('[name="name"]').value.trim(),
                price: Number(editor.querySelector('[name="price"]').value),
                stock: Number(editor.querySelector('[name="stock"]').value),
                category: editor.querySelector('[name="category"]').value.trim(),
                status: editor.querySelector('[name="status"]').value,
                stockStatus: editor.querySelector('[name="stockStatus"]').value,
                imageFile: editor.querySelector('[name="image"]').files[0],
                originalImageName: editor.dataset.existingImage || null,
                removeOriginalImage: editor.dataset.removeImage === "true",
                editId: editor.dataset.mobileEditor
            });
        });
    });
}

function updateMobileInlinePreview(editor) {
    const preview = editor.querySelector("[data-mobile-preview]");
    if (!preview) return;

    const imageFile = editor.querySelector('[name="image"]').files[0];
    const existingImage = editor.dataset.removeImage === "true" ? "" : (editor.dataset.existingImage || "");

    if (imageFile) {
        clearMobilePreviewUrl();
        mobilePreviewUrl = URL.createObjectURL(imageFile);
        preview.className = "mobile-editor-preview image-preview-box";
        preview.innerHTML = `
            <img class="preview-image" src="${mobilePreviewUrl}" alt="Selected image preview">
            <div class="muted">New image selected: ${escapeHtml(imageFile.name)}</div>
        `;
        return;
    }

    if (existingImage) {
        preview.className = "mobile-editor-preview image-preview-box";
        preview.innerHTML = `
            <img class="preview-image" src="${getStoragePublicUrl("Food-Website-Storage", `Products/${existingImage}`)}" alt="Current product image">
            <div class="muted">Current image: ${escapeHtml(existingImage)}</div>
        `;
        return;
    }

    preview.className = "mobile-editor-preview image-preview-empty";
    preview.textContent = "No image selected";
}

function clearMobilePreviewUrl() {
    if (mobilePreviewUrl) {
        URL.revokeObjectURL(mobilePreviewUrl);
        mobilePreviewUrl = null;
    }
}
