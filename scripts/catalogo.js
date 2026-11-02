"use strict";

// Reemplaza los productos del HTML por los del panel.
// Si Supabase no responde, quedan los del HTML.

(() => {

    const config = window.MOVEA_SUPABASE;
    const list = document.querySelector("[data-catalog]");

    if (!list || !config || !config.url || !config.anonKey) return;

    const siteRoot = new URL("../", document.currentScript.src);

    function formatCardPrice(price) {

        return price > 0
            ? `$${price.toLocaleString("es-AR")}`
            : "Consultar precio";

    }

    function createCard(product) {

        const card = document.createElement("article");

        card.classList.add("product_card");

        card.dataset.category = product.category;
        card.dataset.id = product.id;
        card.dataset.name = product.name;
        card.dataset.price = product.price;

        const figure = document.createElement("figure");
        const image = document.createElement("img");

        image.src = new URL(product.image_url, siteRoot).href;
        image.alt = product.name;
        image.loading = "lazy";

        figure.appendChild(image);

        const title = document.createElement("h2");
        title.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description;

        const footer = document.createElement("div");
        footer.classList.add("product-card__footer");

        const price = document.createElement("p");
        price.classList.add("product-card__price");
        price.textContent = formatCardPrice(product.price);

        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("product-card__order");
        button.setAttribute("aria-label", `Agregar ${product.name} al carrito`);

        const icon = document.createElement("i");
        icon.classList.add("fa-solid", "fa-cart-plus");
        icon.setAttribute("aria-hidden", "true");

        button.append(icon, " Agregar");

        footer.append(price, button);

        card.append(figure, title, description, footer);

        return card;

    }

    async function loadCatalog() {

        try {

            const response = await fetch(
                `${config.url}/rest/v1/products?select=id,name,description,category,price,image_url,featured&order=sort_order.asc,created_at.asc`,
                { headers: { apikey: config.anonKey } }
            );

            if (!response.ok) {
                throw new Error(`Respuesta ${response.status}`);
            }

            const products = await response.json();

            const visibleProducts = list.dataset.catalog === "featured"
                ? products.filter(product => product.featured)
                : products;

            const emptyMessage = list.querySelector("[data-product-empty]");

            list.querySelectorAll(".product_card").forEach(card => card.remove());

            visibleProducts.forEach(product => {
                emptyMessage.before(createCard(product));
            });

            document.dispatchEvent(
                new CustomEvent("movea:catalogo", { detail: products })
            );

        } catch (error) {

            console.error("No se pudo cargar el catálogo:", error);

        }

    }

    loadCatalog();

})();
