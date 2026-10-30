document.querySelectorAll("[data-product-list]").forEach((list) => {
    const searchInput = list.querySelector("[data-product-search]");
    const categorySelect = list.querySelector("[data-product-category]");
    const count = list.querySelector("[data-product-count]");
    const emptyMessage = list.querySelector("[data-product-empty]");
    const cards = Array.from(list.querySelectorAll(".product_card"));

    const normalize = (value) => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("es");

    const filterProducts = () => {
        const searchTerm = normalize(searchInput.value.trim());
        const category = categorySelect.value;
        let visibleCount = 0;

        cards.forEach((card) => {
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
    filterProducts();
});
