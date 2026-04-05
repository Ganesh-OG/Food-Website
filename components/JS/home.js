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

    // ================= LOAD CATEGORIES =================
    loadCategories();

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

// ================= CATEGORIES FUNCTION =================
async function loadCategories() {
    try {
        const { data, error } = await supabase
            .from("category")
            .select("*");

        if (error) throw error;

        const wrapper = document.getElementById("categoryWrapper");
        wrapper.innerHTML = "";

        console.log('Categories data:', data); // DEBUG
        
        if (!data || data.length === 0) {
            wrapper.innerHTML = '<p class="empty">No categories available</p>';
            return;
        }

        data.forEach(item => {
            const filePath = `category/${item.display_image.trim()}`;
            const { data: img } = supabase
                .storage
                .from("Food-Website-Storage")
                .getPublicUrl(filePath);

            const slide = `
                <div class="swiper-slide">
                    <a href="menu.html?category=${item.category_name}" class="box">
                        <img src="${img.publicUrl}" alt="${item.category_name}">
                        <h3>${item.category_name}</h3>
                    </a>
                </div>
            `;

            wrapper.innerHTML += slide;
        });

        console.log('Categories data:', data); // DEBUG
        
        if (!data || data.length === 0) {
            wrapper.innerHTML = '<p class="empty">No categories available</p>';
            return;
        }

        // ================= INIT CATEGORY SWIPER =================
        new Swiper(".category-slider", {
            loop: data.length > 4,
            slidesPerView: 'auto',
            spaceBetween: 20,
            grabCursor: true,
            centeredSlides: false,
            pagination: {
                el: ".category-pagination",
                clickable: true
            },
            breakpoints: {
                450: { slidesPerView: 1.2, spaceBetween: 10 },
                768: { slidesPerView: 2.5, spaceBetween: 15 },
                991: { slidesPerView: 3.2, spaceBetween: 20 },
                1200: { slidesPerView: 4, spaceBetween: 25 }
            }
        });


    } catch (err) {
        console.error("Categories error:", err);
    }
}

