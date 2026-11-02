document.querySelectorAll("[data-product-list]").forEach((list) => {
    const searchInput = list.querySelector("[data-product-search]");
    const categorySelect = list.querySelector("[data-product-category]");
    const count = list.querySelector("[data-product-count]");
    const emptyMessage = list.querySelector("[data-product-empty]");

    const normalize = (value) => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es");

    // Botones de categoría a partir de las opciones del select

    const chips = document.createElement("div");

    chips.className = "product-chips";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Filtrar por categoría");

    const updateChips = () => {
        chips.querySelectorAll("button").forEach((chip) => {
            chip.setAttribute("aria-pressed", String(chip.dataset.value === categorySelect.value));
        });
    };

    Array.from(categorySelect.options).forEach((option) => {
        const chip = document.createElement("button");

        chip.type = "button";
        chip.dataset.value = option.value;
        chip.textContent = option.value ? option.textContent : "Todo";

        chip.addEventListener("click", () => {
            categorySelect.value = option.value;
            categorySelect.dispatchEvent(new Event("change"));
        });

        chips.appendChild(chip);
    });

    categorySelect.closest("label").after(chips);
    categorySelect.addEventListener("change", updateChips);
    updateChips();

    const filterProducts = () => {
        const searchTerm = normalize(searchInput.value.trim());
        const category = categorySelect.value;
        let visibleCount = 0;

        list.querySelectorAll(".product_card").forEach((card) => {
            const matchesSearch = normalize(card.textContent).includes(searchTerm);
            const matchesCategory = !category || card.dataset.category === category;
            const isVisible = matchesSearch && matchesCategory;

            card.hidden = !isVisible;
            visibleCount += Number(isVisible);
        });

        count.textContent = `${visibleCount} ${visibleCount === 1 ? "producto" : "productos"}`;
        emptyMessage.hidden = visibleCount > 0;
    };

    searchInput.addEventListener("input", filterProducts);
    categorySelect.addEventListener("change", filterProducts);
    document.addEventListener("movea:catalogo", filterProducts);
    filterProducts();
});
