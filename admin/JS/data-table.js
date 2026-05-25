import { escapeHtml } from "./common.js";

const TEXT_FILTER_OPTIONS = [
    ["", "No text filter"],
    ["contains", "Contains"],
    ["not_contains", "Does Not Contain"],
    ["begins_with", "Begins With"],
    ["ends_with", "Ends With"],
    ["equals", "Equals"],
    ["not_equals", "Does Not Equal"]
];

export function createDataTableState(defaultSort = {}) {
    return {
        sort: {
            column: String(defaultSort.column || "").trim(),
            direction: String(defaultSort.direction || "asc").trim().toLowerCase() === "desc" ? "desc" : "asc"
        },
        filters: {},
        activeFilterColumn: "",
        filterSearch: {},
        draftFilters: {},
        textFilters: {},
        draftTextFilters: {}
    };
}

export function renderDataTable(config) {
    const {
        tableId,
        columns,
        rows,
        state,
        emptyMessage = "No data found.",
        tableClassName = "",
        wrapperClassName = "",
        scrollClassName = "",
        rowClassName = "",
        renderRowAttrs
    } = config;

    const visibleRows = getVisibleRows(config);
    const wrapperClass = ["admin-data-table-wrap", wrapperClassName].filter(Boolean).join(" ");
    const scrollClass = ["admin-data-table-scroll", scrollClassName].filter(Boolean).join(" ");
    const tableClass = ["admin-data-table", tableClassName].filter(Boolean).join(" ");

    return `
        <div class="${wrapperClass}">
            <div class="${scrollClass}">
                <table class="${tableClass}" data-admin-table="${escapeHtml(tableId)}">
                    <thead>
                        <tr>
                            ${columns.map((column, index) => renderHeaderCell(config, column, index)).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${visibleRows.length
        ? visibleRows.map(row => renderBodyRow(config, row, rowClassName, renderRowAttrs)).join("")
        : `<tr><td colspan="${columns.length}" class="admin-data-table-empty">${escapeHtml(emptyMessage)}</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function bindDataTable(root, config, onChange) {
    const { tableId, columns, state } = config;
    const triggerChange = () => {
        if (typeof onChange === "function") {
            onChange();
        }
    };

    root.querySelectorAll(`[data-table-filter-toggle="${tableId}"]`).forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();
            const columnKey = String(button.dataset.column || "").trim();
            if (!columnKey) return;

            if (state.activeFilterColumn === columnKey) {
                closeFilterMenu(state);
            } else {
                state.draftFilters[columnKey] = [...getCommittedFilterSelection(config, columnKey)];
                state.draftTextFilters[columnKey] = { ...getDraftTextFilter(state, columnKey) };
                state.activeFilterColumn = columnKey;
            }

            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-sort-action="${tableId}"]`).forEach(button => {
        button.addEventListener("click", () => {
            const columnKey = String(button.dataset.column || "").trim();
            const direction = String(button.dataset.sortDirection || "asc").trim().toLowerCase() === "desc" ? "desc" : "asc";
            if (!columnKey) return;
            state.sort = { column: columnKey, direction };
            closeFilterMenu(state);
            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-filter-clear="${tableId}"]`).forEach(button => {
        button.addEventListener("click", () => {
            const columnKey = String(button.dataset.column || "").trim();
            if (!columnKey) return;
            clearColumnState(state, columnKey);
            closeFilterMenu(state);
            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-filter-search="${tableId}"]`).forEach(input => {
        input.addEventListener("input", event => {
            const columnKey = String(event.currentTarget.dataset.column || "").trim();
            state.filterSearch[columnKey] = event.currentTarget.value || "";
            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-filter-select-all="${tableId}"]`).forEach(input => {
        input.addEventListener("change", event => {
            const columnKey = String(event.currentTarget.dataset.column || "").trim();
            const searchTerm = String(state.filterSearch[columnKey] || "").trim().toLowerCase();
            const visibleOptions = getColumnOptions(config, columnKey)
                .filter(option => option.toLowerCase().includes(searchTerm));
            const selected = new Set(getDraftFilterSelection(config, columnKey));

            if (event.currentTarget.checked) {
                visibleOptions.forEach(option => selected.add(option));
            } else {
                visibleOptions.forEach(option => selected.delete(option));
            }

            setDraftFilterSelection(config, columnKey, Array.from(selected));
            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-filter-option="${tableId}"]`).forEach(input => {
        input.addEventListener("change", event => {
            const columnKey = String(event.currentTarget.dataset.column || "").trim();
            const optionValue = String(event.currentTarget.value || "").trim();
            const selected = new Set(getDraftFilterSelection(config, columnKey));

            if (event.currentTarget.checked) {
                selected.add(optionValue);
            } else {
                selected.delete(optionValue);
            }

            setDraftFilterSelection(config, columnKey, Array.from(selected));
            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-text-filter-mode="${tableId}"]`).forEach(select => {
        select.addEventListener("change", event => {
            const columnKey = String(event.currentTarget.dataset.column || "").trim();
            setDraftTextFilter(state, columnKey, { mode: event.currentTarget.value || "" });
        });
    });

    root.querySelectorAll(`[data-table-text-filter-value="${tableId}"]`).forEach(input => {
        input.addEventListener("input", event => {
            const columnKey = String(event.currentTarget.dataset.column || "").trim();
            setDraftTextFilter(state, columnKey, { value: event.currentTarget.value || "" });
        });
    });

    root.querySelectorAll(`[data-table-filter-apply="${tableId}"]`).forEach(button => {
        button.addEventListener("click", () => {
            const columnKey = String(button.dataset.column || "").trim();
            applyFilter(config, columnKey);
            triggerChange();
        });
    });

    root.querySelectorAll(`[data-table-filter-cancel="${tableId}"]`).forEach(button => {
        button.addEventListener("click", () => {
            closeFilterMenu(state);
            triggerChange();
        });
    });

    document.removeEventListener("click", state._outsideClickHandler);
    state._outsideClickHandler = event => {
        if (!state.activeFilterColumn) return;
        if (event.target.closest(`[data-table-filter-menu="${tableId}"]`) || event.target.closest(`[data-table-filter-toggle="${tableId}"]`)) {
            return;
        }

        closeFilterMenu(state);
        triggerChange();
    };
    document.addEventListener("click", state._outsideClickHandler);
    syncFilterMenuPopup(root, tableId, state);
}

export function getVisibleRows(config) {
    const filteredRows = config.rows.filter(row =>
        config.columns.every(column => {
            if (column.filterable === false) {
                return true;
            }

            const selectedValues = getCommittedFilterSelection(config, column.key);
            const cellValue = getColumnValue(column, row);
            const hasSelectionFilter = Array.isArray(config.state.filters[column.key]);
            const matchesSelection = hasSelectionFilter ? selectedValues.includes(cellValue) : true;
            return matchesSelection && matchesTextFilter(config.state.textFilters[column.key], cellValue);
        })
    );

    const { column: sortColumnKey, direction } = config.state.sort;
    const sortColumn = config.columns.find(column => column.key === sortColumnKey) || config.columns[0];
    if (!sortColumn) {
        return filteredRows;
    }

    const multiplier = direction === "desc" ? -1 : 1;
    filteredRows.sort((left, right) => {
        const comparison = compareRows(sortColumn, left, right);
        if (comparison !== 0) {
            return comparison * multiplier;
        }

        return String(getColumnValue(sortColumn, left)).localeCompare(String(getColumnValue(sortColumn, right)), undefined, {
            sensitivity: "base",
            numeric: true
        });
    });

    return filteredRows;
}

function renderHeaderCell(config, column, index) {
    const { tableId, state } = config;
    const isSortable = column.sortable !== false;
    const isFilterable = column.filterable !== false;
    const isActive = state.sort.column === column.key;
    const direction = isActive ? state.sort.direction : "";
    const isFilterOpen = state.activeFilterColumn === column.key;
    const filterCount = getCommittedFilterSelection(config, column.key).length;
    const totalOptions = getColumnOptions(config, column.key).length;
    const hasTextFilter = hasCommittedTextFilter(state, column.key);
    const isFiltered = (filterCount > 0 && filterCount < totalOptions) || hasTextFilter;
    const sortLabel = direction === "asc" ? "A-Z" : direction === "desc" ? "Z-A" : "";
    const filterSummary = getFilterSummary(config, column.key);

    return `
        <th scope="col" aria-sort="${isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}">
            <div class="admin-data-table-header-shell ${index === 0 ? "is-first-column" : ""}">
                <div class="admin-data-table-header-label ${isActive ? "is-active" : ""}">
                    <span>${escapeHtml(column.label)}</span>
                    ${isSortable && sortLabel ? `<span class="admin-data-table-header-state">${escapeHtml(sortLabel)}</span>` : ""}
                </div>
                ${isFilterable ? `
                    <button
                        class="admin-data-table-filter-toggle ${isFilterOpen ? "is-open" : ""} ${isFiltered ? "is-filtered" : ""}"
                        type="button"
                        data-table-filter-toggle="${escapeHtml(config.tableId)}"
                        data-column="${escapeHtml(column.key)}"
                        aria-label="Open ${escapeHtml(column.label)} filter menu"
                        aria-expanded="${isFilterOpen ? "true" : "false"}"
                    >
                        <span aria-hidden="true">▾</span>
                    </button>
                ` : ""}
                ${isFilterable && isFilterOpen ? renderFilterMenu(config, column) : ""}
            </div>
            ${filterSummary ? `<div class="admin-data-table-header-filter-summary">${escapeHtml(filterSummary)}</div>` : ""}
        </th>
    `;
}

function renderFilterMenu(config, column) {
    const { tableId, state } = config;
    const searchTerm = String(state.filterSearch[column.key] || "").trim().toLowerCase();
    const allOptions = getColumnOptions(config, column.key);
    const visibleOptions = allOptions.filter(option => option.toLowerCase().includes(searchTerm));
    const selectedValues = getDraftFilterSelection(config, column.key);
    const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every(option => selectedValues.includes(option));
    const textFilter = getDraftTextFilter(state, column.key);
    const clearEnabled = hasActiveFilter(config, column.key);

    return `
        <div class="admin-data-table-filter-menu" data-table-filter-menu="${escapeHtml(tableId)}" data-column="${escapeHtml(column.key)}">
            <button class="admin-data-table-filter-action ${clearEnabled ? "" : "is-disabled"}" type="button" data-table-filter-clear="${escapeHtml(tableId)}" data-column="${escapeHtml(column.key)}" ${clearEnabled ? "" : "disabled"}>
                <span class="admin-data-table-filter-action-icon" aria-hidden="true">✕</span>
                <span>Clear Filter</span>
            </button>
            <button class="admin-data-table-filter-action" type="button" data-table-sort-action="${escapeHtml(tableId)}" data-column="${escapeHtml(column.key)}" data-sort-direction="asc">
                <span class="admin-data-table-filter-action-icon" aria-hidden="true">A↓Z</span>
                <span>Sort A to Z</span>
            </button>
            <button class="admin-data-table-filter-action" type="button" data-table-sort-action="${escapeHtml(tableId)}" data-column="${escapeHtml(column.key)}" data-sort-direction="desc">
                <span class="admin-data-table-filter-action-icon" aria-hidden="true">Z↓A</span>
                <span>Sort Z to A</span>
            </button>
            <div class="admin-data-table-filter-divider"></div>
            <div class="admin-data-table-filter-group">
                <div class="admin-data-table-filter-group-title">Text Filters</div>
                <select class="admin-data-table-filter-select" data-table-text-filter-mode="${escapeHtml(tableId)}" data-column="${escapeHtml(column.key)}">
                    ${TEXT_FILTER_OPTIONS.map(([value, label]) => `
                        <option value="${escapeHtml(value)}" ${textFilter.mode === value ? "selected" : ""}>${escapeHtml(label)}</option>
                    `).join("")}
                </select>
                <input
                    class="admin-data-table-filter-text"
                    type="text"
                    placeholder="Enter value"
                    value="${escapeHtml(textFilter.value || "")}"
                    data-table-text-filter-value="${escapeHtml(tableId)}"
                    data-column="${escapeHtml(column.key)}"
                >
            </div>
            <div class="admin-data-table-filter-divider"></div>
            <label class="admin-data-table-filter-search">
                <span class="sr-only">Search ${escapeHtml(column.label)}</span>
                <input
                    type="search"
                    placeholder="Search"
                    value="${escapeHtml(state.filterSearch[column.key] || "")}"
                    data-table-filter-search="${escapeHtml(tableId)}"
                    data-column="${escapeHtml(column.key)}"
                >
            </label>
            <div class="admin-data-table-filter-options">
                <label class="admin-data-table-filter-option admin-data-table-filter-option-all">
                    <input
                        type="checkbox"
                        ${allVisibleSelected ? "checked" : ""}
                        data-table-filter-select-all="${escapeHtml(tableId)}"
                        data-column="${escapeHtml(column.key)}"
                    >
                    <span>(Select All)</span>
                </label>
                ${visibleOptions.length ? visibleOptions.map(option => `
                    <label class="admin-data-table-filter-option">
                        <input
                            type="checkbox"
                            value="${escapeHtml(option)}"
                            ${selectedValues.includes(option) ? "checked" : ""}
                            data-table-filter-option="${escapeHtml(tableId)}"
                            data-column="${escapeHtml(column.key)}"
                        >
                        <span>${escapeHtml(option || "(Blank)")}</span>
                    </label>
                `).join("") : `<div class="admin-data-table-filter-empty">No matching values</div>`}
            </div>
            <div class="admin-data-table-filter-footer">
                <button class="btn-secondary admin-data-table-filter-btn" type="button" data-table-filter-apply="${escapeHtml(tableId)}" data-column="${escapeHtml(column.key)}">OK</button>
                <button class="btn-ghost admin-data-table-filter-btn" type="button" data-table-filter-cancel="${escapeHtml(tableId)}">Cancel</button>
            </div>
        </div>
    `;
}

function renderBodyRow(config, row, rowClassName, renderRowAttrs) {
    const attrs = typeof renderRowAttrs === "function" ? renderRowAttrs(row) : "";
    const attrMarkup = attrs ? ` ${attrs}` : "";
    const classMarkup = rowClassName ? ` class="${escapeHtml(rowClassName)}"` : "";

    return `
        <tr${classMarkup}${attrMarkup}>
            ${config.columns.map(column => `
                <td data-label="${escapeHtml(column.label)}" ${column.cellClassName ? `class="${escapeHtml(column.cellClassName)}"` : ""}>
                    ${typeof column.render === "function"
        ? column.render(row)
        : escapeHtml(getColumnValue(column, row))}
                </td>
            `).join("")}
        </tr>
    `;
}

function getColumnValue(column, row) {
    const rawValue = typeof column.value === "function" ? column.value(row) : row?.[column.key];
    return String(rawValue ?? "").trim();
}

function compareRows(column, leftRow, rightRow) {
    if (typeof column.compare === "function") {
        return Number(column.compare(leftRow, rightRow)) || 0;
    }

    const leftValue = getColumnValue(column, leftRow);
    const rightValue = getColumnValue(column, rightRow);
    return leftValue.localeCompare(rightValue, undefined, {
        sensitivity: "base",
        numeric: true
    });
}

function getColumnOptions(config, columnKey) {
    const column = config.columns.find(item => item.key === columnKey);
    if (!column || column.filterable === false) {
        return [];
    }

    return Array.from(new Set(
        config.rows
            .map(row => getColumnValue(column, row))
            .filter(value => String(value).trim() !== "")
    )).sort((left, right) => left.localeCompare(right, undefined, {
        sensitivity: "base",
        numeric: true
    }));
}

function getCommittedFilterSelection(config, columnKey) {
    const allOptions = getColumnOptions(config, columnKey);
    const selected = config.state.filters[columnKey];

    if (!Array.isArray(selected)) {
        return allOptions;
    }

    return selected.filter(value => allOptions.includes(value));
}

function getDraftFilterSelection(config, columnKey) {
    const draft = config.state.draftFilters[columnKey];
    if (!Array.isArray(draft)) {
        return getCommittedFilterSelection(config, columnKey);
    }

    const allOptions = getColumnOptions(config, columnKey);
    return draft.filter(value => allOptions.includes(value));
}

function setDraftFilterSelection(config, columnKey, values) {
    const normalized = Array.from(new Set((values || []).map(value => String(value || "").trim()).filter(Boolean)));
    const allOptions = getColumnOptions(config, columnKey);
    config.state.draftFilters[columnKey] = normalized.length === allOptions.length ? allOptions : normalized;
}

function getDraftTextFilter(state, columnKey) {
    return state.draftTextFilters[columnKey]
        || state.textFilters[columnKey]
        || { mode: "", value: "" };
}

function setDraftTextFilter(state, columnKey, patch = {}) {
    const current = getDraftTextFilter(state, columnKey);
    state.draftTextFilters[columnKey] = {
        mode: String(patch.mode ?? current.mode ?? "").trim(),
        value: String(patch.value ?? current.value ?? "").trim()
    };
}

function hasCommittedTextFilter(state, columnKey) {
    const filter = state.textFilters[columnKey];
    return Boolean(filter?.mode && String(filter?.value || "").trim());
}

function matchesTextFilter(filter, cellValue) {
    const mode = String(filter?.mode || "").trim();
    const compareValue = String(filter?.value || "").trim().toLowerCase();
    const source = String(cellValue || "").toLowerCase();

    if (!mode || !compareValue) {
        return true;
    }

    switch (mode) {
    case "contains":
        return source.includes(compareValue);
    case "not_contains":
        return !source.includes(compareValue);
    case "begins_with":
        return source.startsWith(compareValue);
    case "ends_with":
        return source.endsWith(compareValue);
    case "equals":
        return source === compareValue;
    case "not_equals":
        return source !== compareValue;
    default:
        return true;
    }
}

function applyFilter(config, columnKey) {
    const allOptions = getColumnOptions(config, columnKey);
    const draft = getDraftFilterSelection(config, columnKey);
    const searchTerm = String(config.state.filterSearch[columnKey] || "").trim().toLowerCase();
    const visibleOptions = allOptions.filter(option => option.toLowerCase().includes(searchTerm));

    if (searchTerm && visibleOptions.length === 0) {
        config.state.filters[columnKey] = [];
    } else if (draft.length === allOptions.length) {
        delete config.state.filters[columnKey];
    } else {
        config.state.filters[columnKey] = [...draft];
    }

    const textFilter = getDraftTextFilter(config.state, columnKey);
    config.state.textFilters[columnKey] = textFilter.mode && textFilter.value
        ? { ...textFilter }
        : { mode: "", value: "" };

    closeFilterMenu(config.state);
}

function clearColumnState(state, columnKey) {
    delete state.filters[columnKey];
    delete state.textFilters[columnKey];
    delete state.filterSearch[columnKey];
    delete state.draftFilters[columnKey];
    delete state.draftTextFilters[columnKey];

    if (state.sort.column === columnKey) {
        state.sort.direction = "asc";
    }
}

function closeFilterMenu(state) {
    if (state.activeFilterColumn) {
        delete state.draftFilters[state.activeFilterColumn];
        delete state.draftTextFilters[state.activeFilterColumn];
    }

    state.activeFilterColumn = "";
}

function syncFilterMenuPopup(root, tableId, state) {
    window.removeEventListener("resize", state._filterMenuLayoutHandler);
    document.removeEventListener("scroll", state._filterMenuLayoutHandler, true);
    clearDetachedFilterMenus(tableId);

    if (!state?.activeFilterColumn) {
        return;
    }

    detachFilterMenu(root, tableId, state.activeFilterColumn);
    const layout = () => positionFilterMenu(root, tableId, state.activeFilterColumn);
    state._filterMenuLayoutHandler = layout;
    layout();
    window.addEventListener("resize", layout);
    document.addEventListener("scroll", layout, true);
}

function positionFilterMenu(root, tableId, columnKey) {
    const toggle = root.querySelector(`[data-table-filter-toggle="${tableId}"][data-column="${columnKey}"]`);
    const menu = document.querySelector(`[data-table-filter-menu="${tableId}"][data-column="${columnKey}"]`);
    if (!(toggle instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
        return;
    }

    const margin = 12;
    const gap = 10;
    const toggleRect = toggle.getBoundingClientRect();
    const preferredWidth = Math.min(320, Math.max(260, menu.offsetWidth || 290));
    const maxWidth = Math.max(220, window.innerWidth - (margin * 2));

    menu.style.width = `${Math.min(preferredWidth, maxWidth)}px`;

    const spaceBelow = Math.max(180, window.innerHeight - toggleRect.bottom - gap - margin);
    const maxHeight = spaceBelow;

    let left = toggleRect.right - (menu.offsetWidth || preferredWidth);
    if (left < margin) {
        left = Math.min(toggleRect.left, window.innerWidth - (menu.offsetWidth || preferredWidth) - margin);
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - (menu.offsetWidth || preferredWidth) - margin));

    const top = Math.max(margin, toggleRect.bottom + gap);

    menu.style.position = "fixed";
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.right = "auto";
    menu.style.maxHeight = `${maxHeight}px`;
}

function detachFilterMenu(root, tableId, columnKey) {
    const menu = root.querySelector(`[data-table-filter-menu="${tableId}"][data-column="${columnKey}"]`);
    if (!(menu instanceof HTMLElement)) {
        return;
    }

    menu.dataset.detachedFilterMenu = "true";
    document.body.appendChild(menu);
}

function clearDetachedFilterMenus(tableId) {
    document.querySelectorAll(`[data-table-filter-menu="${tableId}"][data-detached-filter-menu="true"]`).forEach(menu => {
        menu.remove();
    });
}

function hasActiveFilter(config, columnKey) {
    const hasSortOverride = config.state.sort.column === columnKey && config.state.sort.direction === "desc";
    return Array.isArray(config.state.filters[columnKey]) || hasCommittedTextFilter(config.state, columnKey) || hasSortOverride;
}

function getFilterSummary(config, columnKey) {
    const textFilter = config.state.textFilters[columnKey];
    const selectedValues = getCommittedFilterSelection(config, columnKey);
    const totalOptions = getColumnOptions(config, columnKey).length;
    const parts = [];

    if (textFilter?.mode && String(textFilter?.value || "").trim()) {
        parts.push(`${humanizeFilterMode(textFilter.mode)}: ${textFilter.value}`);
    }

    if (Array.isArray(config.state.filters[columnKey])) {
        if (!selectedValues.length) {
            parts.push("No matches");
        } else if (selectedValues.length !== totalOptions) {
            parts.push(`${selectedValues.length} selected`);
        }
    }

    return parts.join(" | ");
}

function humanizeFilterMode(mode) {
    switch (mode) {
    case "contains":
        return "Contains";
    case "not_contains":
        return "Not contains";
    case "begins_with":
        return "Begins";
    case "ends_with":
        return "Ends";
    case "equals":
        return "Equals";
    case "not_equals":
        return "Not equals";
    default:
        return "Filter";
    }
}
