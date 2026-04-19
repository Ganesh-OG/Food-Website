const markupCache = new Map();
const markupPromiseCache = new Map();

function getParser() {
    return new DOMParser();
}

export async function loadAuthBoxMarkup(pageName) {
    if (markupCache.has(pageName)) {
        return markupCache.get(pageName);
    }

    if (markupPromiseCache.has(pageName)) {
        return markupPromiseCache.get(pageName);
    }

    const loadPromise = (async () => {
        const response = await fetch(pageName, { cache: "no-store" });
        const html = await response.text();
        const doc = getParser().parseFromString(html, "text/html");
        const box = doc.querySelector(".login-box");

        const markup = box ? box.outerHTML : "";
        markupCache.set(pageName, markup);
        markupPromiseCache.delete(pageName);
        return markup;
    })();

    markupPromiseCache.set(pageName, loadPromise);
    return loadPromise;
}

export async function preloadAuthBoxMarkup(pageNames = []) {
    await Promise.all(pageNames.map(pageName => loadAuthBoxMarkup(pageName)));
}
