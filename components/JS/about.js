import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
    await loadAbout();
    subscribeToRealtimeUpdates();
});

// Function to get image URL
function getImageUrl(fileName) {
    if (!fileName) return null;
    return `https://plojfgqvvojpushcatsn.supabase.co/storage/v1/object/public/Food-Website-Storage/About/${fileName}`;
}

// Default fallback
const FALLBACK = {
    paragraph: {
        title: "why choose us",
        content: `Choose us for our commitment to quality and variety in our menu, offering a diverse range of delicious and nutritious options...`,
        image: "images/about-img.svg"
    },
    steps: [
        { section: "step1", title: "Choose", image: "images/choose1.gif" },
        { section: "step2", title: "Pay", image: "images/pay.gif" },
        { section: "step3", title: "Eat", image: "images/eatfood.gif" }
    ]
};

// Load about
async function loadAbout() {
    try {
        const { data, error } = await supabase
            .from("about_content")
            .select("*");

        if (error || !data || data.length === 0) {
            return renderFallback();
        }

        renderDbContent(data);

    } catch (err) {
        console.error("❌ Error loading About:", err);
        renderFallback();
    }
}

// Render DB with partial fallback
function renderDbContent(data) {

    // ================= PARAGRAPH =================
    const paragraph = data.find(d =>
        (d.section || "").toLowerCase().trim() === "paragraph"
    );

    const paragraphValid =
        paragraph &&
        (paragraph.Status || "").toLowerCase() === "enabled";

    document.getElementById("aboutTitle").textContent =
        paragraphValid ? paragraph.title : FALLBACK.paragraph.title;

    document.getElementById("aboutContent").innerHTML =
        paragraphValid ? paragraph.content : FALLBACK.paragraph.content;

    document.getElementById("aboutImage").src =
        paragraphValid && paragraph.image_path
            ? getImageUrl(paragraph.image_path)
            : FALLBACK.paragraph.image;


    // ================= STEPS =================
    const container = document.getElementById("stepsContainer");
    container.innerHTML = "";

    ["step1", "step2", "step3"].forEach((step, index) => {

        const item = data.find(d =>
            (d.section || "").toLowerCase().trim() === step.toLowerCase()
        );

        const isValid =
            item &&
            (item.Status || "").toLowerCase() === "enabled";

        const box = document.createElement("div");
        box.classList.add("box");

        box.innerHTML = `
            <img src="${
                isValid && item.image_path
                    ? getImageUrl(item.image_path)
                    : FALLBACK.steps[index].image
            }" alt="${isValid ? item.title : FALLBACK.steps[index].title}">
            
            <h3>${isValid ? item.title : FALLBACK.steps[index].title}</h3>
        `;

        container.appendChild(box);
    });

    console.log("🎉 Partial DB content displayed");
}

// Full fallback (only if DB totally fails)
function renderFallback() {
    console.warn("⚠️ Full fallback displayed");

    document.getElementById("aboutTitle").textContent = FALLBACK.paragraph.title;
    document.getElementById("aboutContent").textContent = FALLBACK.paragraph.content;
    document.getElementById("aboutImage").src = FALLBACK.paragraph.image;

    const container = document.getElementById("stepsContainer");
    container.innerHTML = "";

    FALLBACK.steps.forEach(step => {
        const box = document.createElement("div");
        box.classList.add("box");

        box.innerHTML = `
            <img src="${step.image}" alt="${step.title}">
            <h3>${step.title}</h3>
        `;

        container.appendChild(box);
    });
}

// Realtime
function subscribeToRealtimeUpdates() {
    supabase
        .channel("about-updates")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "about_content" },
            () => loadAbout()
        )
        .subscribe();
}