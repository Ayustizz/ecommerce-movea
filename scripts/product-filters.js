document.querySelectorAll("[data-product-list]").forEach((list) => {
    const searchInput = list.querySelector("[data-product-search]");
    const categorySelect = list.querySelector("[data-product-category]");
    const sortSelect = list.querySelector("[data-product-sort]");

    // Categoría pedida desde un enlace, por ejemplo productos.html?categoria=shorts
    const requestedCategory = new URLSearchParams(location.search).get("categoria") || "";
    const count = list.querySelector("[data-product-count]");
    const emptyMessage = list.querySelector("[data-product-empty]");

    const normalize = (value) => value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLocaleLowerCase("es");

    // Categoría madre de cada subcategoría, según las opciones del select

    const getParent = (value) => {
        const option = Array.from(categorySelect.options).find((item) => item.value === value);

        return option ? option.dataset.parent || "" : "";
    };

    // Botones de categoría a partir de las opciones del select.
    // Las subcategorías aparecen al elegir su categoría.

    const chips = document.createElement("div");
    const subchips = document.createElement("div");

    chips.className = "product-chips";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Filtrar por categoría");

    subchips.className = "product-chips product-chips--sub";
    subchips.setAttribute("role", "group");
    subchips.setAttribute("aria-label", "Filtrar por tipo");

    const createChip = (option) => {
        const chip = document.createElement("button");

        chip.type = "button";
        chip.dataset.value = option.value;
        chip.textContent = option.value ? option.textContent : "Todo";

        chip.addEventListener("click", () => {
            categorySelect.value = option.value;
            categorySelect.dispatchEvent(new Event("change"));
        });

        return chip;
    };

    // Se rehacen solo si cambian: así el foco no se pierde al elegir

    let shownGroup = null;

    const buildChips = () => {
        const options = Array.from(categorySelect.options);

        chips.replaceChildren(...options.filter((option) => !option.dataset.parent).map(createChip));
        shownGroup = null;
    };

    const updateChips = () => {
        const selected = categorySelect.value;
        const group = getParent(selected) || selected;

        if (group !== shownGroup) {
            const options = Array.from(categorySelect.options);

            subchips.replaceChildren(...options.filter((option) => group && option.dataset.parent === group).map(createChip));
            subchips.hidden = subchips.children.length === 0;
            shownGroup = group;
        }

        chips.querySelectorAll("button").forEach((chip) => {
            chip.setAttribute("aria-pressed", String(chip.dataset.value === group));
        });

        subchips.querySelectorAll("button").forEach((chip) => {
            chip.setAttribute("aria-pressed", String(chip.dataset.value === selected));
        });
    };

    const selectRequestedCategory = () => {
        if (Array.from(categorySelect.options).some((option) => option.value === requestedCategory)) {
            categorySelect.value = requestedCategory;
        }
    };

    categorySelect.closest("label").after(chips, subchips);
    categorySelect.addEventListener("change", updateChips);
    selectRequestedCategory();
    buildChips();
    updateChips();

    // Reemplaza las opciones escritas en el HTML por las del panel

    document.addEventListener("movea:categorias", (event) => {
        const categories = event.detail;
        const selected = categorySelect.value;
        const options = [categorySelect.options[0]];

        categories.filter((category) => !category.parent_slug).forEach((parent) => {
            options.push(new Option(parent.name, parent.slug));

            categories.filter((category) => category.parent_slug === parent.slug).forEach((child) => {
                const option = new Option(child.name, child.slug);

                option.dataset.parent = parent.slug;
                options.push(option);
            });
        });

        categorySelect.replaceChildren(...options);
        categorySelect.value = options.some((option) => option.value === selected) ? selected : "";

        if (!categorySelect.value) {
            selectRequestedCategory();
        }

        buildChips();
        updateChips();
    });

    const filterProducts = () => {
        const searchTerm = normalize(searchInput.value.trim());
        const category = categorySelect.value;
        let visibleCount = 0;

        list.querySelectorAll(".product_card").forEach((card) => {
            const matchesSearch = normalize(card.textContent).includes(searchTerm);
            const matchesCategory = !category
                || card.dataset.category === category
                || getParent(card.dataset.category) === category;
            const isVisible = matchesSearch && matchesCategory;

            card.hidden = !isVisible;
            visibleCount += Number(isVisible);
        });

        count.textContent = `${visibleCount} ${visibleCount === 1 ? "producto" : "productos"}`;
        emptyMessage.hidden = visibleCount > 0;
    };

    // Ordenar: los agotados siempre quedan al final.

    const sorters = {
        "precio-menor": (a, b) => a.dataset.price - b.dataset.price,
        "precio-mayor": (a, b) => b.dataset.price - a.dataset.price,
        nuevos: (a, b) => (b.dataset.created || "").localeCompare(a.dataset.created || ""),
        "": (a, b) => a.dataset.order - b.dataset.order
    };

    const sortProducts = () => {
        if (!sortSelect) return;

        const sorter = sorters[sortSelect.value] || sorters[""];

        Array.from(list.querySelectorAll(".product_card"))
            .sort((a, b) => {
                const soldOut = a.classList.contains("is-sold-out") - b.classList.contains("is-sold-out");

                return soldOut || sorter(a, b);
            })
            .forEach((card) => emptyMessage.before(card));
    };

    if (sortSelect) {
        sortSelect.addEventListener("change", sortProducts);
        document.addEventListener("movea:catalogo", sortProducts);
    }

    searchInput.addEventListener("input", filterProducts);
    categorySelect.addEventListener("change", filterProducts);
    document.addEventListener("movea:categorias", filterProducts);
    document.addEventListener("movea:catalogo", filterProducts);
    filterProducts();
});
