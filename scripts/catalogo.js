"use strict";

// Carga los productos del panel en la lista.
// Mientras tanto la lista queda con aria-busy ("Cargando productos...").

(() => {

    const config = window.TIENDA_SUPABASE;
    const list = document.querySelector("[data-catalog]");

    if (!list) return;

    function showLoadError() {

        const emptyMessage = list.querySelector("[data-product-empty]");

        emptyMessage.textContent =
            "No pudimos cargar los productos. Probá recargar la página.";
        emptyMessage.hidden = false;

        list.removeAttribute("aria-busy");

    }

    if (!config || !config.url || !config.anonKey) {
        document.addEventListener("DOMContentLoaded", showLoadError);
        return;
    }

    const siteRoot = new URL("../", document.currentScript.src);

    // Con esta cantidad o menos se muestra "Últimas unidades".
    const LOW_STOCK = 3;

    function formatCardPrice(price) {

        return price > 0
            ? `$${price.toLocaleString("es-AR")}`
            : "Consultar precio";

    }

    function getStockUnits(product) {

        return product.product_stock.reduce((total, item) => total + item.quantity, 0);

    }

    function isSoldOut(product) {

        return product.track_stock && getStockUnits(product) === 0;

    }

    function createCard(product, position) {

        const card = document.createElement("article");

        card.classList.add("product_card");

        card.dataset.category = product.category || "";
        card.dataset.order = position;
        card.dataset.created = product.created_at || "";
        card.dataset.id = product.id;
        card.dataset.name = product.name;
        card.dataset.price = product.price;
        card.dataset.sizes = product.sizes.join("|");
        card.dataset.colors = product.colors.join("|");

        if (product.track_stock) {
            card.dataset.stock = JSON.stringify(product.product_stock);
        }

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

        const hasComparePrice = product.on_offer && product.compare_price > product.price;

        if (hasComparePrice) {

            card.dataset.comparePrice = product.compare_price;

            const comparePrice = document.createElement("s");

            comparePrice.classList.add("product-card__compare");
            comparePrice.textContent = formatCardPrice(product.compare_price);

            footer.appendChild(comparePrice);

        }

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

        if (product.on_offer) {

            const label = document.createElement("span");

            // Con precio anterior se muestra cuánto se ahorra.

            const percent = hasComparePrice
                ? Math.round((1 - product.price / product.compare_price) * 100)
                : 0;

            label.classList.add("offer-label");
            label.textContent = percent > 0 ? `-${percent}%` : "Oferta";

            card.prepend(label);

        }

        if (isSoldOut(product)) {

            card.classList.add("is-sold-out");

            // En vez de un botón apagado, avisa por WhatsApp cuando vuelva.

            const notify = document.createElement("a");

            notify.classList.add("product-card__notify");
            notify.href = window.TIENDA.whatsappUrl(
                `${window.TIENDA.saludo()} Quiero que me avisen cuando vuelva a haber stock de "${product.name}".`
            );
            notify.target = "_blank";
            notify.rel = "noopener noreferrer";

            const notifyIcon = document.createElement("i");
            notifyIcon.classList.add("fa-regular", "fa-bell");
            notifyIcon.setAttribute("aria-hidden", "true");

            notify.append(notifyIcon, " Avisame cuando vuelva");

            const soldOut = document.createElement("span");
            soldOut.classList.add("sold-out-label");
            soldOut.textContent = "Agotado";

            button.replaceWith(notify);
            card.prepend(soldOut);

        } else if (product.track_stock && getStockUnits(product) <= LOW_STOCK) {

            const lowStock = document.createElement("span");

            lowStock.classList.add("stock-label");
            lowStock.textContent = "Últimas unidades";

            footer.before(lowStock);

        }

        return card;

    }

    // Si las categorías no cargan, quedan las escritas en el HTML.

    async function loadCategories() {

        try {

            const response = await fetch(
                `${config.url}/rest/v1/categories?select=slug,name,parent_slug&order=sort_order.asc,created_at.asc`,
                { headers: { apikey: config.anonKey } }
            );

            if (!response.ok) {
                throw new Error(`Respuesta ${response.status}`);
            }

            const categories = await response.json();

            document.dispatchEvent(
                new CustomEvent("tienda:categorias", { detail: categories })
            );

            return categories;

        } catch (error) {

            console.error("No se pudieron cargar las categorías:", error);

            return null;

        }

    }

    async function loadCatalog() {

        try {

            const response = await fetch(
                `${config.url}/rest/v1/products?select=id,name,description,category,price,image_url,created_at,featured,sizes,colors,on_offer,compare_price,track_stock,product_stock(size,color,quantity)&order=sort_order.asc,created_at.asc`,
                { headers: { apikey: config.anonKey } }
            );

            if (!response.ok) {
                throw new Error(`Respuesta ${response.status}`);
            }

            const products = await response.json();

            const filters = {
                featured: product => product.featured,
                offers: product => product.on_offer,
                all: () => true
            };

            const visibleProducts = products.filter(filters[list.dataset.catalog]);

            const emptyMessage = list.querySelector("[data-product-empty]");

            list.querySelectorAll(".product_card").forEach(card => card.remove());

            // Los agotados van al final.

            visibleProducts
                .map((product, position) => createCard(product, position))
                .sort((a, b) => {
                    return a.classList.contains("is-sold-out") - b.classList.contains("is-sold-out");
                })
                .forEach(card => emptyMessage.before(card));

            list.removeAttribute("aria-busy");

            document.dispatchEvent(
                new CustomEvent("tienda:catalogo", { detail: products })
            );

            return products;

        } catch (error) {

            console.error("No se pudo cargar el catálogo:", error);

            showLoadError();

            return null;

        }

    }

    // Espera a que el carrito y los filtros estén listos.

    document.addEventListener("DOMContentLoaded", () => {
        loadCategories();
        loadCatalog();
    });

})();
