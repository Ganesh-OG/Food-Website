// components/JS/header_loader.js

document.addEventListener("DOMContentLoaded", async () => {
  await loadHeader();
  await loadFooter();
});

async function loadHeader() {
  try {
    // ✅ ABSOLUTE PATH (important)
    const response = await fetch("./user_header.html");
    const html = await response.text();

    document.getElementById("headerContainer").innerHTML = html;

    console.log("✅ Header injected");

    // 🔥 Trigger event AFTER header is fully inserted
    document.dispatchEvent(new Event("headerLoaded"));

  } catch (err) {
    console.error("❌ Header load error:", err);
  }
}

async function loadFooter() {
  try {
    // ✅ ABSOLUTE PATH (important)
    const response = await fetch("./footer.html");
    const html = await response.text();

    document.getElementById("footerContainer").innerHTML = html;

    console.log("✅ Footer injected");

  } catch (err) {
    console.error("❌ Footer load error:", err);
  }
}