"use strict";

// Reemplaza los banners del HTML por los del panel.
// Si Supabase no responde, quedan los del HTML.

(() => {

    const config = window.TIENDA_SUPABASE;
    const gallery = document.getElementById("galeriaTienda");

    if (!gallery || !config || !config.url || !config.anonKey) return;

    const siteRoot = new URL("../", document.currentScript.src);

    function createSlide(banner, index) {

        const slide = document.createElement("div");
        const image = document.createElement("img");

        slide.classList.add("carousel-item");
        slide.classList.toggle("active", index === 0);

        image.src = new URL(banner.image_url, siteRoot).href;
        image.alt = banner.alt;
        image.className = "d-block w-100";

        if (index > 0) {
            image.loading = "lazy";
        }

        slide.appendChild(image);

        return slide;

    }

    function createIndicator(index) {

        const indicator = document.createElement("button");

        indicator.type = "button";
        indicator.dataset.bsTarget = "#galeriaTienda";
        indicator.dataset.bsSlideTo = index;
        indicator.setAttribute("aria-label", `Imagen ${index + 1}`);

        if (index === 0) {

            indicator.classList.add("active");
            indicator.setAttribute("aria-current", "true");

        }

        return indicator;

    }

    async function loadBanners() {

        try {

            const response = await fetch(
                `${config.url}/rest/v1/banners?select=image_url,alt&order=sort_order.asc,created_at.asc`,
                { headers: { apikey: config.anonKey } }
            );

            if (!response.ok) {
                throw new Error(`Respuesta ${response.status}`);
            }

            const banners = await response.json();

            if (banners.length === 0) return;

            gallery.querySelector(".carousel-inner")
                .replaceChildren(...banners.map(createSlide));

            gallery.querySelector(".carousel-indicators")
                .replaceChildren(...banners.map((banner, index) => createIndicator(index)));

            gallery.classList.toggle("is-single", banners.length === 1);

        } catch (error) {

            console.error("No se pudieron cargar los banners:", error);

        }

    }

    document.addEventListener("DOMContentLoaded", loadBanners);

})();
