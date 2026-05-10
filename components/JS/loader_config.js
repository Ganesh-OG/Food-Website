const EMERGENCY_FALLBACK_ITEM = {
    key: "loader-item-1",
    label: "Loader Logo",
    fileName: "burger.svg",
    color: "#f7a600",
    source: "local"
};

let loaderBaseConfig = {
    mode: "code-orbit-loader",
    version: 1,
    source: "local-first",
    background: "#ffffff",
    cycleSeconds: 4.8,
    orbitSeconds: 4.5,
    centerSize: 88,
    orbitSize: 53,
    logoSize: 70,
    items: [{ ...EMERGENCY_FALLBACK_ITEM }],
    customAssets: {}
};

const DEFAULT_CONFIG = {
    ...loaderBaseConfig,
    items: loaderBaseConfig.items.map(item => ({ ...item })),
    customAssets: { ...loaderBaseConfig.customAssets }
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function parseMaybeJson(value) {
    if (!value) return null;
    if (typeof value === "object") return value;

    const raw = String(value).trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function clampNumber(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function normalizeCustomAssets(rawAssets = {}) {
    const entries = Object.entries(rawAssets || {});
    return Object.fromEntries(entries.flatMap(([key, asset]) => {
        const cleanKey = String(key || "").trim().toLowerCase();
        const cleanSvg = String(asset?.svg || "").trim();
        if (!cleanKey || !cleanSvg) return [];

        return [[cleanKey, {
            key: cleanKey,
            label: String(asset?.label || cleanKey).trim() || cleanKey,
            fileName: String(asset?.fileName || `${cleanKey}.svg`).trim() || `${cleanKey}.svg`,
            svg: cleanSvg
        }]];
    }));
}

function getDefaultSequenceItem(index) {
    return loaderBaseConfig.items[index] || loaderBaseConfig.items[0] || EMERGENCY_FALLBACK_ITEM;
}

function slugifyLoaderKey(value, fallback = "loader-item") {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || fallback;
}

function normalizeLoaderItem(item, index, customAssets) {
    const fallback = getDefaultSequenceItem(index);
    const cleanColor = String(item?.color || fallback.color).trim() || fallback.color;
    const source = String(item?.source || "").trim().toLowerCase();
    const customKey = String(item?.key || item?.assetKey || "").trim().toLowerCase();

    if (source === "custom" && customKey && customAssets[customKey]) {
        const asset = customAssets[customKey];
        return {
            key: customKey,
            label: String(item?.label || asset.label || fallback.label).trim() || fallback.label,
            fileName: asset.fileName,
            color: cleanColor,
            source: "custom",
            svg: asset.svg
        };
    }

    const localKey = String(item?.key || fallback.key).trim().toLowerCase();
    const fileName = String(item?.fileName || item?.file_name || "").trim();
    const label = String(item?.label || "").trim();
    const hasExplicitLocalAsset = Boolean(
        source === "local" &&
        localKey &&
        fileName
    );

    if (hasExplicitLocalAsset) {
        return {
            key: localKey,
            label: label || fileName.replace(/\.svg$/i, "") || fallback.label,
            fileName,
            color: cleanColor,
            source: "local"
        };
    }

    const defaultLocal = loaderBaseConfig.items.find(entry => entry.key === localKey) || fallback;

    return {
        key: localKey || defaultLocal.key,
        label: String(item?.label || defaultLocal.label).trim() || defaultLocal.label,
        fileName: String(item?.fileName || item?.file_name || defaultLocal.fileName).trim() || defaultLocal.fileName,
        color: cleanColor,
        source: "local"
    };
}

export function getDefaultLoaderConfig() {
    return {
        ...loaderBaseConfig,
        items: loaderBaseConfig.items.map(item => ({ ...item })),
        customAssets: { ...(loaderBaseConfig.customAssets || {}) }
    };
}

export function getLocalLoaderAssets() {
    return getDefaultLoaderConfig().items.map(item => ({
        key: item.key,
        label: item.label,
        fileName: item.fileName,
        source: "local"
    }));
}

export function setLoaderBaseConfig(rawValue) {
    const parsed = parseMaybeJson(rawValue);
    if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) {
        return getDefaultLoaderConfig();
    }

    const nextConfig = normalizeLoaderConfig({
        ...loaderBaseConfig,
        ...parsed,
        customAssets: parsed.customAssets || {}
    });

    loaderBaseConfig = {
        ...nextConfig,
        items: nextConfig.items.map(item => ({ ...item })),
        customAssets: { ...(nextConfig.customAssets || {}) }
    };

    return getDefaultLoaderConfig();
}

export function hasStructuredLoaderConfig(rawValue) {
    const parsed = parseMaybeJson(rawValue);
    return Boolean(parsed && typeof parsed === "object" && Array.isArray(parsed.items));
}

export function normalizeLoaderConfig(rawValue) {
    const parsed = parseMaybeJson(rawValue);
    const defaults = getDefaultLoaderConfig();
    const customAssets = normalizeCustomAssets(parsed?.customAssets);
    const rawItems = Array.isArray(parsed?.items) ? parsed.items : defaults.items;

    const items = rawItems
        .map((item, index) => normalizeLoaderItem(item || defaults.items[index] || defaults.items[0], index, customAssets))
        .filter(Boolean);

    return {
        mode: "code-orbit-loader",
        version: 1,
        source: "local-first",
        background: String(parsed?.background || defaults.background).trim() || defaults.background,
        cycleSeconds: clampNumber(parsed?.cycleSeconds, defaults.cycleSeconds, 2, 20),
        orbitSeconds: clampNumber(parsed?.orbitSeconds, defaults.orbitSeconds, 2, 20),
        centerSize: clampNumber(parsed?.centerSize, defaults.centerSize, 56, 160),
        orbitSize: clampNumber(parsed?.orbitSize, defaults.orbitSize, 34, 120),
        logoSize: clampNumber(parsed?.logoSize, defaults.logoSize, 32, 130),
        items: items.length ? items : defaults.items.map(item => ({ ...item })),
        customAssets
    };
}

export function getLoaderAssetOptions(config) {
    const localAssets = getLocalLoaderAssets();
    const customAssets = Object.values(config?.customAssets || {}).map(asset => ({
        key: asset.key,
        label: asset.label,
        fileName: asset.fileName,
        source: "custom"
    }));

    return [...localAssets, ...customAssets];
}

export function getLoaderImagePath(fileName, basePath = "") {
    const prefix = String(basePath || "").trim();
    return `${prefix}images/loader/${encodeURIComponent(String(fileName || "").trim())}`;
}

function buildLogoMarkup(item, basePath = "") {
    if (item?.source === "custom" && item?.svg) {
        return item.svg;
    }

    return `<img src="${escapeHtml(getLoaderImagePath(item?.fileName || "", basePath))}" alt="${escapeHtml(item?.label || "Loader icon")}">`;
}

function buildColorKeyframes(name, items) {
    const fallbackItems = getDefaultLoaderConfig().items;
    const palette = (items.length ? items : fallbackItems).map(item => item.color || fallbackItems[0]?.color || EMERGENCY_FALLBACK_ITEM.color);
    const segment = 100 / palette.length;
    const frames = palette.map((color, index) => {
        const start = Number((segment * index).toFixed(4));
        const end = Number((segment * (index + 1)).toFixed(4));
        const safeEnd = Math.max(start, end - 0.0001);
        return `
            ${start}%{ background-color:${color}; }
            ${safeEnd}%{ background-color:${color}; }
        `;
    }).join("");

    return `@keyframes ${name}{${frames}100%{ background-color:${palette[0]}; }}`;
}

function buildLogoKeyframes(name, itemCount) {
    const count = Math.max(1, itemCount);
    const visibleEnd = Number(Math.min(96, (100 / count) * 0.8).toFixed(4));
    return `
        @keyframes ${name}{
            0%, ${visibleEnd}%{
                opacity:1;
                transform:scale(1);
            }

            ${Math.min(99.999, visibleEnd + 0.0001)}%, 100%{
                opacity:0;
                transform:scale(1.08);
            }
        }
    `;
}

export function ensureOrbitLoaderStyles() {
    if (document.getElementById("orbitLoaderStyles")) return;

    const style = document.createElement("style");
    style.id = "orbitLoaderStyles";
    style.textContent = `
        .orbit-loader-shell{
            position: relative;
            width: min(92vw, 36rem);
            height: min(92vw, 36rem);
            display: flex;
            align-items: center;
            justify-content: center;
            --loader-highlight: rgba(255,255,255,0.24);
            --loader-shade: rgba(0,0,0,0.10);
            --loader-shadow: rgba(15,23,42,0.12);
        }

        .orbit-loader-visual{
            position: relative;
            width: 100%;
            height: 100%;
            filter: var(--orbit-loader-filter);
        }

        body[data-theme="dark"] .orbit-loader-shell,
        html[data-theme="dark"] .orbit-loader-shell{
            --loader-highlight: rgba(255,255,255,0.14);
            --loader-shade: rgba(0,0,0,0.22);
            --loader-shadow: rgba(0,0,0,0.26);
        }

        .orbit-loader-center,
        .orbit-loader-ball{
            position: absolute;
            border-radius: 50%;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--loader-color-1);
            background-image:
                linear-gradient(160deg, var(--loader-highlight), transparent 44%);
            animation: var(--loader-color-animation);
        }

        .orbit-loader-center{
            width: var(--loader-center-size);
            height: var(--loader-center-size);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            z-index: 2;
            box-shadow:
                inset 0 1px 1px var(--loader-highlight),
                inset 0 -5px 10px var(--loader-shade),
                0 10px 20px var(--loader-shadow);
        }

        .orbit-loader-ball{
            width: var(--loader-orbit-size);
            height: var(--loader-orbit-size);
            z-index: 1;
            box-shadow:
                inset 0 1px 1px var(--loader-highlight),
                inset 0 -4px 8px var(--loader-shade),
                0 8px 16px var(--loader-shadow);
            animation:
                orbitLoaderMove var(--loader-orbit) linear infinite,
                var(--loader-color-animation);
        }

        .orbit-loader-logo{
            position: absolute;
            width: var(--loader-logo-size);
            height: var(--loader-logo-size);
            opacity: 0;
            transform: scale(0.88);
            animation: var(--loader-logo-animation);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .orbit-loader-logo img,
        .orbit-loader-logo svg{
            width: 100%;
            height: 100%;
            object-fit: contain;
            filter: brightness(0) saturate(100%) invert(1);
        }

        @keyframes orbitLoaderMove{
            0%{ left:50%; top:50%; transform:translate(-50%, -50%); }
            6.25%{ left:62%; top:31%; transform:translate(-50%, -50%); }
            12.5%{ left:74%; top:24%; transform:translate(-50%, -50%); }
            18.75%{ left:80%; top:50%; transform:translate(-50%, -50%); }
            25%{ left:50%; top:50%; transform:translate(-50%, -50%); }
            31.25%{ left:64%; top:64%; transform:translate(-50%, -50%); }
            37.5%{ left:74%; top:74%; transform:translate(-50%, -50%); }
            43.75%{ left:50%; top:80%; transform:translate(-50%, -50%); }
            50%{ left:50%; top:50%; transform:translate(-50%, -50%); }
            56.25%{ left:36%; top:64%; transform:translate(-50%, -50%); }
            62.5%{ left:26%; top:74%; transform:translate(-50%, -50%); }
            68.75%{ left:20%; top:50%; transform:translate(-50%, -50%); }
            75%{ left:50%; top:50%; transform:translate(-50%, -50%); }
            81.25%{ left:36%; top:36%; transform:translate(-50%, -50%); }
            87.5%{ left:26%; top:26%; transform:translate(-50%, -50%); }
            93.75%{ left:50%; top:20%; transform:translate(-50%, -50%); }
            100%{ left:50%; top:50%; transform:translate(-50%, -50%); }
        }
    `;

    document.head.appendChild(style);
}

export function buildOrbitLoaderMarkup(config, options = {}) {
    const loaderConfig = normalizeLoaderConfig(config);
    const assetBasePath = String(options.assetBasePath || "");
    const gooeyId = `gooeyLoader${Math.random().toString(36).slice(2, 9)}`;
    const animationId = Math.random().toString(36).slice(2, 9);
    const colorAnimationName = `orbitLoaderColorLoop${animationId}`;
    const logoAnimationName = `orbitLoaderLogoLoop${animationId}`;
    const slotDelay = loaderConfig.cycleSeconds / Math.max(loaderConfig.items.length, 1);
    const shellStyle = [
        `--loader-cycle:${loaderConfig.cycleSeconds}s`,
        `--loader-orbit:${loaderConfig.orbitSeconds}s`,
        `--loader-center-size:${loaderConfig.centerSize}px`,
        `--loader-orbit-size:${loaderConfig.orbitSize}px`,
        `--loader-logo-size:${loaderConfig.logoSize}px`,
        `--loader-color-1:${loaderConfig.items[0]?.color || getDefaultLoaderConfig().items[0]?.color || EMERGENCY_FALLBACK_ITEM.color}`,
        `--orbit-loader-filter:url(#${gooeyId})`,
        `--loader-color-animation:${colorAnimationName} var(--loader-cycle) linear infinite`,
        `--loader-logo-animation:${logoAnimationName} var(--loader-cycle) linear infinite`
    ].join(";");
    const animationStyle = `
        <style>
            ${buildColorKeyframes(colorAnimationName, loaderConfig.items)}
            ${buildLogoKeyframes(logoAnimationName, loaderConfig.items.length)}
        </style>
    `;

    return `
        <div class="orbit-loader-shell" style="${shellStyle}">
            ${animationStyle}
            <svg width="0" height="0" aria-hidden="true" focusable="false">
                <filter id="${gooeyId}">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur"></feGaussianBlur>
                    <feColorMatrix in="blur" mode="matrix" values="
                        1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 25 -10" result="gooey"></feColorMatrix>
                    <feBlend in="SourceGraphic" in2="gooey"></feBlend>
                </filter>
            </svg>
            <div class="orbit-loader-visual">
                <div class="orbit-loader-ball"></div>
                <div class="orbit-loader-center">
                    ${loaderConfig.items.map((item, index) => `
                        <span class="orbit-loader-logo" style="animation-delay:${(slotDelay * index).toFixed(3)}s">
                            ${buildLogoMarkup(item, assetBasePath)}
                        </span>
                    `).join("")}
                </div>
            </div>
        </div>
    `;
}
