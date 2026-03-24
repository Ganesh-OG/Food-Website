import { supabase } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {

    // ================= LOAD HEADER =================
    const header = await fetch("user_header.html");
    document.getElementById("headerContainer").innerHTML = await header.text();

    // ================= LOAD FOOTER =================
    const footer = await fetch("footer.html");
    document.getElementById("footerContainer").innerHTML = await footer.text();

    // ================= LOAD HERO =================
    loadHero();

});

// ================= HERO FUNCTION =================
async function loadHero() {
    try {
        const { data, error } = await supabase
            .from("hero_slider")
            .select("*");

        if (error) throw error;

        const wrapper = document.getElementById("heroWrapper");
        wrapper.innerHTML = "";

        data.forEach(item => {

            // 🔥 Build storage path
            const filePath = `Slider Images/${item.file_name}`;

            // 🔥 Get public URL
            const { data: img } = supabase
                .storage
                .from("Food-Website-Storage")
                .getPublicUrl(filePath);

            const slide = `
                <div class="swiper-slide slide">
                    <div class="content">
                        <span>${item.content_display}</span>
                        <h3>${item.name}</h3>
                        <a href="menu.html" class="btn">see menus</a>
                    </div>
                    <div class="image">
                        <img src="${img.publicUrl}" alt="">
                    </div>
                </div>
            `;

            wrapper.innerHTML += slide;
        });

        // ================= INIT SWIPER =================
        new Swiper(".hero-slider", {
            loop: true,
            grabCursor: true,
            pagination: {
                el: ".swiper-pagination",
                clickable: true
            },
            autoplay: {
                delay: 4000
            }
        });

    } catch (err) {
        console.error("Hero error:", err);
    }
}