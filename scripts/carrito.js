
"use strict";

// ==========================================
// 1. CONFIGURACIÓN
// ==========================================

// El número de WhatsApp está en scripts/tienda-config.js.

const STORAGE_KEY = "movea-cart-v2";

// Raíz del sitio, para las fotos y los enlaces de productos.
const siteRoot = new URL("../", document.currentScript.src);

const DELIVERY_NAMES = {
    encuentro: "Punto de encuentro",
    uber: "Envío a coordinar"
};

// Datos de cobro del negocio.
// El pago y el link de Mercado Pago con el monto cargado se crean solos
// cuando mercadoPago está activo en scripts/supabase-config.js.

const PAYMENT_CONFIG = {
    alias: "Martuu.rocio",
    // Nombre del titular de la cuenta, para que el cliente lo verifique antes de transferir.
    accountHolder: "Martina Rocio Bugallo Zak",
    // Descuento en % según el medio de pago. Tienen que coincidir con
    // create_order en supabase/migracion-descuentos.sql.
    discounts: {
        "mercado-pago": 10,
        link: 10,
        transferencia: 10
    }
};

const PAYMENT_NAMES = {
    "mercado-pago": "Mercado Pago",
    link: "Link de pago de Mercado Pago",
    transferencia: "Transferencia con alias",
    entrega: "Efectivo al momento de la entrega"
};


// ==========================================
// 2. ELEMENTOS DEL DOM
// ==========================================

const cartPanel = document.getElementById("cart-panel");
const cartOverlay = document.getElementById("cart-overlay");

const cartToggle = document.getElementById("cart-toggle");
const cartClose = document.getElementById("cart-close");

const cartItems = document.getElementById("cart-items");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");

const cartSummary = document.getElementById("cart-summary");
const cartClear = document.getElementById("cart-clear");
const cartPending = document.getElementById("cart-pending");

const checkoutOpen = document.getElementById("cart-checkout-open");
const checkoutSection = document.getElementById("checkout-section");
const checkoutBack = document.getElementById("checkout-back");
const checkoutForm = document.getElementById("checkout-form");

const customerName = document.getElementById("customer-name");
const customerPhone = document.getElementById("customer-phone");
const customerDetails = document.getElementById("customer-details");
const deliveryZone = document.getElementById("delivery-zone");
const deliveryZoneLabel = document.getElementById("delivery-zone-label");

const paymentInfo = document.getElementById("payment-info");

const checkoutSubtotal = document.getElementById("checkout-subtotal");
const checkoutDiscount = document.getElementById("checkout-discount");
const checkoutTotal = document.getElementById("checkout-total");
const checkoutDiscountRow = document.getElementById("checkout-discount-row");
const checkoutDiscountLabel = document.getElementById("checkout-discount-label");
const checkoutPending = document.getElementById("checkout-pending");
const checkoutError = document.getElementById("checkout-error");
const checkoutSubmit = document.getElementById("checkout-submit");
const checkoutSubmitText = document.getElementById("checkout-submit-text");

const orderDone = document.getElementById("order-done");
const orderDoneCode = document.getElementById("order-done-code");
const orderDoneProof = document.getElementById("order-done-proof");
const orderDoneProofTitle = document.getElementById("order-done-proof-title");
const orderDoneProofText = document.getElementById("order-done-proof-text");
const orderDonePayment = document.getElementById("order-done-payment");
const orderDoneWhatsapp = document.getElementById("order-done-whatsapp");
const orderDoneFinish = document.getElementById("order-done-finish");

const productDialog = document.getElementById("product-dialog");
const productDialogForm = document.getElementById("product-dialog-form");
const productDialogClose = document.getElementById("product-dialog-close");
const productDialogImage = document.getElementById("product-dialog-image");
const productDialogName = document.getElementById("product-dialog-name");
const productDialogPrice = document.getElementById("product-dialog-price");
const productDialogDescription = document.getElementById("product-dialog-description");
const productDialogSizes = document.getElementById("product-dialog-sizes");
const productDialogColors = document.getElementById("product-dialog-colors");
const productDialogError = document.getElementById("product-dialog-error");
const productDialogStock = document.getElementById("product-dialog-stock");
const productQuantityLess = document.getElementById("product-quantity-less");
const productQuantityMore = document.getElementById("product-quantity-more");
const productQuantityValue = document.getElementById("product-quantity-value");

const cartToast = document.getElementById("cart-toast");
const cartToastText = document.getElementById("cart-toast-text");
const cartToastOpen = document.getElementById("cart-toast-open");

const cartSaving = document.getElementById("cart-saving");

const sizeGuide = document.getElementById("product-size-guide");
const productDialogPrepaid = document.getElementById("product-dialog-prepaid");
const productDialogWhatsapp = document.getElementById("product-dialog-whatsapp");
const productDialogShare = document.getElementById("product-dialog-share");


// ==========================================
// 3. CARGAR CARRITO
// ==========================================

function loadCart() {

    try {

        const savedCart = JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        );

        if (!Array.isArray(savedCart)) {
            return [];
        }

        return savedCart.filter(product => {

            return (
                product &&
                typeof product.key === "string" &&
                typeof product.id === "string" &&
                typeof product.size === "string" &&
                typeof product.color === "string" &&
                typeof product.name === "string" &&
                product.name.length > 0 &&
                Number.isFinite(product.price) &&
                product.price >= 0 &&
                Number.isInteger(product.quantity) &&
                product.quantity > 0 &&
                product.quantity <= 99
            );

        }).map(product => {

            // La foto es opcional y solo puede ser una dirección web.

            const image = typeof product.image === "string" && /^(https?|file):/.test(product.image)
                ? product.image
                : "";

            return { ...product, image };

        });

    } catch (error) {

        console.error("Error al cargar el carrito:", error);

        return [];

    }

}

let cart = loadCart();


// ==========================================
// 4. GUARDAR CARRITO
// ==========================================

function saveCart() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(cart)
        );

    } catch (error) {

        console.error("No se pudo guardar el carrito:", error);

        alert("No se pudo guardar tu carrito en este navegador.");

    }

}


// ==========================================
// 5. FORMATEAR PRECIOS
// ==========================================

// Mismo formato que las tarjetas de producto: $50.000

function formatPrice(price) {

    return `$${Math.round(price).toLocaleString("es-AR")}`;

}


// ==========================================
// 6. CALCULAR IMPORTES
// ==========================================

function getDiscountPercent(paymentMethod) {

    return PAYMENT_CONFIG.discounts[paymentMethod] ?? 0;

}


function calculateTotals(paymentMethod = "") {

    const subtotal = cart.reduce((total, product) => {

        return total + product.price * product.quantity;

    }, 0);

    const hasPendingPrices = cart.some(product => {
        return product.price === 0;
    });

    const discount =
        Math.round(subtotal * getDiscountPercent(paymentMethod) / 100);

    const total = subtotal - discount;

    return {
        subtotal,
        discount,
        total,
        hasPendingPrices
    };

}


// ==========================================
// 7. ABRIR CARRITO
// ==========================================

function openCart() {

    cartPanel.classList.add("active");
    cartOverlay.classList.add("active");

    cartPanel.inert = false;
    cartPanel.setAttribute("aria-hidden", "false");

    cartOverlay.setAttribute("aria-hidden", "false");

    cartToggle.setAttribute("aria-expanded", "true");

    document.body.classList.add("cart-open");

    cartClose.focus();

}


// ==========================================
// 8. CERRAR CARRITO
// ==========================================

function closeCart() {

    cartPanel.classList.remove("active");
    cartOverlay.classList.remove("active");

    cartPanel.inert = true;
    cartPanel.setAttribute("aria-hidden", "true");

    cartOverlay.setAttribute("aria-hidden", "true");

    cartToggle.setAttribute("aria-expanded", "false");

    document.body.classList.remove("cart-open");

    cartToggle.focus();

}

cartToggle.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);


// Cerrar con Escape

document.addEventListener("keydown", event => {

    if (
        event.key === "Escape" &&
        cartPanel.classList.contains("active")
    ) {

        closeCart();

    }

});


// ==========================================
// 9. ELEGIR TALLE Y COLOR
// ==========================================

let selectedProduct = null;
let selectedQuantity = 1;
let selectedMaximum = 99;
let toastTimer = null;


function splitOptions(value = "") {

    return value ? value.split("|") : [];

}


function getCardProduct(card) {

    return {
        id: card.dataset.id,
        name: card.dataset.name,
        price: Number(card.dataset.price),
        sizes: splitOptions(card.dataset.sizes),
        colors: splitOptions(card.dataset.colors),
        comparePrice: Number(card.dataset.comparePrice) || 0,
        stock: card.dataset.stock ? JSON.parse(card.dataset.stock) : null,
        image: card.querySelector("img").src,
        priceText: card.querySelector(".product-card__price").textContent.trim(),
        description: card.querySelector(":scope > p").textContent.trim()
    };

}


function renderProductOptions(fieldset, options, inputName) {

    const list = fieldset.querySelector(".product-options__list");

    list.replaceChildren();

    fieldset.hidden = options.length === 0;

    options.forEach(option => {

        const label = document.createElement("label");
        const input = document.createElement("input");
        const text = document.createElement("span");

        input.type = "radio";
        input.name = inputName;
        input.value = option;
        input.checked = options.length === 1;

        input.addEventListener("change", updateStockAvailability);

        text.textContent = option;

        label.append(input, text);
        list.appendChild(label);

    });

}


function getSelectedOption(inputName) {

    const selected = productDialogForm.querySelector(
        `input[name="${inputName}"]:checked`
    );

    return selected ? selected.value : null;

}


// Unidades disponibles. Sin talle o color elegido, cuenta todas las opciones.

function getAvailableUnits(size, color) {

    if (!selectedProduct.stock) return 99;

    return selectedProduct.stock
        .filter(item => {

            return (
                (size === null || item.size === size) &&
                (color === null || item.color === color)
            );

        })
        .reduce((total, item) => total + item.quantity, 0);

}


function updateStockAvailability() {

    const size = getSelectedOption("productSize");
    const color = getSelectedOption("productColor");

    productDialogForm.querySelectorAll('input[name="productSize"]').forEach(input => {
        input.disabled = getAvailableUnits(input.value, color) === 0;
    });

    productDialogForm.querySelectorAll('input[name="productColor"]').forEach(input => {
        input.disabled = getAvailableUnits(size, input.value) === 0;
    });

    productDialogForm.querySelectorAll("input:checked:disabled").forEach(input => {
        input.checked = false;
    });

    const hasSize = selectedProduct.sizes.length === 0 || getSelectedOption("productSize");
    const hasColor = selectedProduct.colors.length === 0 || getSelectedOption("productColor");

    const units = getAvailableUnits(
        getSelectedOption("productSize") ?? (selectedProduct.sizes.length ? null : ""),
        getSelectedOption("productColor") ?? (selectedProduct.colors.length ? null : "")
    );

    selectedMaximum = hasSize && hasColor ? Math.min(units, 99) : 99;

    setSelectedQuantity(selectedQuantity);

    const isLow = selectedProduct.stock && hasSize && hasColor && units <= 3;

    productDialogStock.textContent = `${units === 1 ? "Queda 1 unidad" : `Quedan ${units} unidades`}`;
    productDialogStock.hidden = !isLow;

}


function setSelectedQuantity(quantity) {

    selectedQuantity = Math.min(Math.max(quantity, 1), Math.max(selectedMaximum, 1));

    productQuantityValue.textContent = selectedQuantity;

    productQuantityLess.disabled = selectedQuantity === 1;
    productQuantityMore.disabled = selectedQuantity >= selectedMaximum;

}


function openProductDialog(card) {

    const product = getCardProduct(card);

    if (!product.id || !product.name || !Number.isFinite(product.price)) {

        console.error("Producto con datos incorrectos:", card);

        return;

    }

    selectedProduct = product;

    productDialogImage.src = product.image;
    productDialogImage.alt = product.name;
    productDialogName.textContent = product.name;
    productDialogDescription.textContent = product.description;

    productDialogPrice.replaceChildren(product.priceText);

    if (product.comparePrice > product.price) {

        const comparePrice = document.createElement("s");

        comparePrice.classList.add("product-dialog__compare");
        comparePrice.textContent = formatPrice(product.comparePrice);

        productDialogPrice.prepend(comparePrice, " ");

    }

    const prepaidPercent = PAYMENT_CONFIG.discounts.transferencia;

    productDialogPrepaid.hidden = !(product.price > 0);
    productDialogPrepaid.textContent =
        `${formatPrice(product.price - Math.round(product.price * prepaidPercent / 100))} pagando con transferencia o Mercado Pago (${prepaidPercent}% off)`;

    // La guía de talles no aplica a productos de talle único.

    sizeGuide.hidden =
        !hasSizeGuide() ||
        product.sizes.length === 0 ||
        product.sizes.every(size => size === "Único");

    sizeGuide.open = false;

    productDialogWhatsapp.href = window.MOVEA_TIENDA.whatsappUrl(
        `¡Hola Movea! Quiero consultar por el producto "${product.name}".`
    );

    productDialogShare.lastElementChild.textContent = "Compartir";

    renderProductOptions(productDialogSizes, product.sizes, "productSize");
    renderProductOptions(productDialogColors, product.colors, "productColor");

    selectedQuantity = 1;
    selectedMaximum = 99;

    updateStockAvailability();

    productDialogError.hidden = true;

    productDialog.showModal();
    productDialog.scrollTop = 0;

    document.body.classList.add("cart-open");

}


document.addEventListener("click", event => {

    const trigger = event.target.closest(
        ".product_card .product-card__order, .product_card figure, .product_card h2"
    );

    const card = trigger && trigger.closest(".product_card");

    if (card && !card.classList.contains("is-sold-out")) {
        openProductDialog(card);
    }

});


// Guía de talles: se arma una vez con los datos de scripts/tienda-config.js.

function hasSizeGuide() {

    const guide = window.MOVEA_TIENDA && window.MOVEA_TIENDA.guiaDeTalles;

    return Boolean(guide && guide.filas && guide.filas.length > 0);

}


function renderSizeGuide() {

    if (!hasSizeGuide()) return;

    const guide = window.MOVEA_TIENDA.guiaDeTalles;

    const table = document.createElement("table");
    const head = table.createTHead().insertRow();

    guide.columnas.forEach(column => {

        const cell = document.createElement("th");

        cell.scope = "col";
        cell.textContent = column;

        head.append(cell);

    });

    const body = table.createTBody();

    guide.filas.forEach(row => {

        const tableRow = body.insertRow();

        row.forEach((value, index) => {

            const cell = document.createElement(index === 0 ? "th" : "td");

            if (index === 0) cell.scope = "row";

            cell.textContent = value;
            tableRow.append(cell);

        });

    });

    const content = sizeGuide.querySelector(".size-guide__content");

    content.replaceChildren(table);

    if (guide.nota) {

        const note = document.createElement("p");

        note.textContent = guide.nota;
        content.append(note);

    }

}

renderSizeGuide();


// Compartir: abre el menú del celular o copia el enlace.

productDialogShare.addEventListener("click", async () => {

    const url = new URL(`Pages/productos.html?producto=${encodeURIComponent(selectedProduct.id)}`, siteRoot).href;

    try {

        if (navigator.share) {

            await navigator.share({ title: `${selectedProduct.name} | Movea`, url });

            return;

        }

        await navigator.clipboard.writeText(url);

        productDialogShare.lastElementChild.textContent = "¡Enlace copiado!";

    } catch (error) {

        // Cerrar el menú de compartir no es un error.

        if (error.name !== "AbortError") {

            console.error("No se pudo compartir:", error);

            productDialogShare.lastElementChild.textContent = "No se pudo copiar";

        }

    }

});


productDialogClose.addEventListener("click", () => productDialog.close());

productDialog.addEventListener("click", event => {

    // Clic en el fondo, fuera del contenido.

    if (event.target === productDialog) {
        productDialog.close();
    }

});

productDialog.addEventListener("close", () => {
    document.body.classList.remove("cart-open");
});

productQuantityLess.addEventListener("click", () => {
    setSelectedQuantity(selectedQuantity - 1);
});

productQuantityMore.addEventListener("click", () => {
    setSelectedQuantity(selectedQuantity + 1);
});


productDialogForm.addEventListener("submit", event => {

    event.preventDefault();

    const size = productDialogForm.querySelector(
        'input[name="productSize"]:checked'
    );

    const color = productDialogForm.querySelector(
        'input[name="productColor"]:checked'
    );

    const missing = selectedProduct.sizes.length > 0 && !size
        ? "Elegí un talle."
        : selectedProduct.colors.length > 0 && !color
            ? "Elegí un color."
            : "";

    productDialogError.textContent = missing;
    productDialogError.hidden = !missing;

    if (missing) return;

    addToCart(
        selectedProduct,
        size ? size.value : "",
        color ? color.value : "",
        selectedQuantity
    );

    productDialog.close();

    showToast(`${selectedProduct.name} se agregó al carrito`);

});


// ==========================================
// 9B. AGREGAR PRODUCTOS
// ==========================================

function addToCart(product, size, color, quantity) {

    const key = `${product.id}|${size}|${color}`;

    const existingProduct = cart.find(item => item.key === key);

    if (existingProduct) {

        existingProduct.quantity = Math.min(
            existingProduct.quantity + quantity,
            99
        );

    } else {

        cart.push({
            key,
            id: product.id,
            name: product.name,
            size,
            color,
            price: product.price,
            image: product.image,
            quantity
        });

    }

    saveCart();
    renderCart();

}


function showToast(text) {

    cartToastText.textContent = text;
    cartToast.hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        cartToast.hidden = true;
    }, 4000);

}


cartToastOpen.addEventListener("click", () => {

    cartToast.hidden = true;

    openCart();

});


function showPrepaidPrices() {

    document.querySelectorAll(".product_card[data-id]").forEach(card => {

        const price = Number(card.dataset.price);

            if (
            !(price > 0) ||
            card.classList.contains("is-sold-out") ||
            card.querySelector(".product-card__prepaid")
        ) return;

        const prepaid = document.createElement("p");

        const prepaidPrice =
            price - Math.round(price * PAYMENT_CONFIG.discounts.transferencia / 100);

        // Corto para que entre en una línea en el celular.

        prepaid.classList.add("product-card__prepaid");
        prepaid.textContent =
            `${formatPrice(prepaidPrice)} con ${PAYMENT_CONFIG.discounts.transferencia}% off`;
        prepaid.title = "Pagando con transferencia o Mercado Pago";

        card.querySelector(".product-card__price").after(prepaid);

    });

}


function getVariantText(product) {

    return [
        product.size && `Talle ${product.size}`,
        product.color
    ].filter(Boolean).join(", ");

}


// ==========================================
// 10. MODIFICAR CANTIDADES
// ==========================================

function changeQuantity(key, amount) {

    const product = cart.find(item => item.key === key);

    if (!product) return;

    const newQuantity = product.quantity + amount;

    if (newQuantity <= 0) {

        removeProduct(key);

        return;

    }

    if (newQuantity > 99) {

        alert("No puedes agregar más de 99 unidades.");

        return;

    }

    product.quantity = newQuantity;

    saveCart();
    renderCart();

}


// ==========================================
// 11. ELIMINAR PRODUCTOS
// ==========================================

function removeProduct(key) {

    cart = cart.filter(product => product.key !== key);

    saveCart();
    renderCart();

}


// ==========================================
// 12. CREAR ELEMENTO DEL CARRITO
// ==========================================

function createCartItem(product) {

    const article = document.createElement("article");
    article.classList.add("cart-item");

    const info = document.createElement("div");
    info.classList.add("cart-item-info");

    const name = document.createElement("h3");
    name.textContent = product.name;

    const price = document.createElement("p");

    price.textContent = product.price > 0
        ? formatPrice(product.price)
        : "Precio a consultar";

    const variant = document.createElement("p");
    variant.textContent = getVariantText(product);

    info.append(name, variant, price);

    // Los carritos guardados antes de las fotos no tienen imagen.

    if (product.image) {

        const image = document.createElement("img");

        image.src = product.image;
        image.alt = "";
        image.classList.add("cart-item-image");

        article.classList.add("cart-item--image");
        article.append(image);

    }

    const actions = document.createElement("div");
    actions.classList.add("cart-item-actions");

    const decreaseButton = document.createElement("button");

    decreaseButton.type = "button";
    decreaseButton.textContent = "−";

    decreaseButton.setAttribute(
        "aria-label",
        `Disminuir cantidad de ${product.name}`
    );

    decreaseButton.addEventListener("click", () => {
        changeQuantity(product.key, -1);
    });

    const quantity = document.createElement("span");
    quantity.textContent = product.quantity;

    const increaseButton = document.createElement("button");

    increaseButton.type = "button";
    increaseButton.textContent = "+";
    increaseButton.disabled = product.quantity >= 99;

    increaseButton.setAttribute(
        "aria-label",
        `Aumentar cantidad de ${product.name}`
    );

    increaseButton.addEventListener("click", () => {
        changeQuantity(product.key, 1);
    });

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.textContent = "Eliminar";
    removeButton.classList.add("cart-item-remove");

    removeButton.addEventListener("click", () => {
        removeProduct(product.key);
    });

    actions.append(
        decreaseButton,
        quantity,
        increaseButton,
        removeButton
    );

    article.append(info, actions);

    return article;

}


// ==========================================
// 13. RENDERIZAR CARRITO
// ==========================================

function renderCart() {

    cartItems.innerHTML = "";

    if (cart.length === 0) {

        const emptyMessage = document.createElement("p");

        emptyMessage.classList.add("cart-empty");
        emptyMessage.textContent = "Tu carrito está vacío.";

        cartItems.appendChild(emptyMessage);

    } else {

        cart.forEach(product => {
            cartItems.appendChild(createCartItem(product));
        });

    }

    updateCartSummary();
    updateCheckoutSummary();

}


// ==========================================
// 14. ACTUALIZAR RESUMEN DEL CARRITO
// ==========================================

function updateCartSummary() {

    const totalQuantity = cart.reduce(
        (total, product) => total + product.quantity,
        0
    );

    const totals = calculateTotals();

    cartCount.textContent = totalQuantity;
    cartTotal.textContent = formatPrice(totals.subtotal);

    cartPending.hidden = !totals.hasPendingPrices;

    // Cuánto ahorra pagando con transferencia o Mercado Pago.

    const prepaid = calculateTotals("transferencia");

    cartSaving.hidden = prepaid.discount === 0 || totals.hasPendingPrices;

    cartSaving.textContent =
        `Con transferencia o Mercado Pago pagás ${formatPrice(prepaid.total)} y ahorrás ${formatPrice(prepaid.discount)}.`;

    checkoutOpen.disabled = cart.length === 0;
    cartClear.disabled = cart.length === 0;

}


// ==========================================
// 15. VACIAR CARRITO
// ==========================================

cartClear.addEventListener("click", () => {

    if (cart.length === 0) return;

    cart = [];

    saveCart();
    renderCart();

    showCartView();

});


// ==========================================
// 16. CAMBIAR ENTRE CARRITO Y CHECKOUT
// ==========================================

function showCheckoutView() {

    if (cart.length === 0) {

        alert("Agregá al menos un producto antes de continuar.");

        return;

    }

    cartItems.hidden = true;
    cartSummary.hidden = true;

    checkoutSection.hidden = false;

    updateCheckoutSummary();

    customerName.focus();

}


function showCartView() {

    checkoutSection.hidden = true;
    orderDone.hidden = true;

    cartItems.hidden = false;
    cartSummary.hidden = false;

    paymentInfo.hidden = true;

}


checkoutOpen.addEventListener("click", showCheckoutView);

checkoutBack.addEventListener("click", showCartView);


// ==========================================
// 17. ACTUALIZAR RESUMEN DEL CHECKOUT
// ==========================================

function getSelectedPaymentMethod() {

    const selected = checkoutForm.querySelector(
        'input[name="paymentMethod"]:checked'
    );

    return selected ? selected.value : "";

}


function getSelectedDeliveryMethod() {

    const selected = checkoutForm.querySelector(
        'input[name="deliveryMethod"]:checked'
    );

    return selected ? selected.value : "";

}


function updateCheckoutSummary() {

    const paymentMethod = getSelectedPaymentMethod();

    const totals = calculateTotals(paymentMethod);

    checkoutSubtotal.textContent = formatPrice(totals.subtotal);

    checkoutDiscount.textContent =
        `-${formatPrice(totals.discount)}`;

    checkoutTotal.textContent = formatPrice(totals.total);

    // Cada método tiene su descuento; pagando al recibir no hay.

    const percent = getDiscountPercent(paymentMethod);

    checkoutDiscountLabel.textContent = `Descuento (${percent}%)`;

    checkoutDiscountRow.hidden = percent === 0;

    // Aviso por productos sin precio.

    checkoutPending.hidden = !totals.hasPendingPrices;

}


// ==========================================
// 18. INFORMACIÓN DEL MÉTODO DE PAGO
// ==========================================

function isPrepaidMethod(paymentMethod) {

    return (
        paymentMethod === "mercado-pago" ||
        paymentMethod === "link" ||
        paymentMethod === "transferencia"
    );

}


// El link es otra forma de pagar con Mercado Pago:
// en la base el pedido se guarda igual.

function getOrderPaymentMethod(paymentMethod) {

    return paymentMethod === "link" ? "mercado-pago" : paymentMethod;

}


function isMercadoPagoEnabled() {

    const config = window.MOVEA_SUPABASE;

    return Boolean(config && config.mercadoPago && isOrderSavingEnabled());

}


async function copyText(text, button, doneLabel) {

    try {

        await navigator.clipboard.writeText(text);

        button.textContent = doneLabel;

    } catch (error) {

        console.error("No se pudo copiar:", error);

        button.textContent = "Copialo a mano";

    }

}


// Un dato para copiar: etiqueta, valor y botón.

function createCopyRow(label, value, copyValue, buttonText, doneLabel) {

    const row = document.createElement("div");
    row.classList.add("payment-copy-row");

    const text = document.createElement("span");
    text.classList.add("payment-copy-row__text");

    const caption = document.createElement("small");
    caption.textContent = label;

    const strong = document.createElement("strong");
    strong.classList.add("payment-alias");
    strong.textContent = value;

    text.append(caption, strong);

    const button = document.createElement("button");

    button.type = "button";
    button.classList.add("payment-copy");
    button.textContent = buttonText;

    button.addEventListener("click", () => copyText(copyValue, button, doneLabel));

    row.append(text, button);

    return row;

}


function createPaymentAccess(paymentMethod, paymentLink = "") {

    const totals = calculateTotals(paymentMethod);

    if (paymentMethod === "transferencia") {

        // El monto no se repite acá: ya figura en el total del pedido.

        const access = [];

        access.push(createCopyRow("Alias", PAYMENT_CONFIG.alias, PAYMENT_CONFIG.alias, "Copiar alias", "¡Copiado!"));

        if (PAYMENT_CONFIG.accountHolder) {

            const holder = document.createElement("p");

            holder.textContent = `Titular: ${PAYMENT_CONFIG.accountHolder}`;

            access.push(holder);

        }

        return access;

    }

    if (paymentLink) {

        const link = document.createElement("a");

        link.href = paymentLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.classList.add("payment-link-button");
        link.textContent = `Pagar ${formatPrice(totals.total)} con Mercado Pago`;

        const copyButton = document.createElement("button");

        copyButton.type = "button";
        copyButton.classList.add("payment-copy");
        copyButton.textContent = "Copiar link";

        copyButton.addEventListener("click", () => {
            copyText(paymentLink, copyButton, "¡Link copiado!");
        });

        return [link, copyButton];

    }

    const linkNote = document.createElement("p");

    linkNote.textContent =
        "Te enviamos el link de pago por WhatsApp, con el monto ya cargado.";

    return [linkNote];

}


// Pago o link creados por Mercado Pago, con el monto exacto del pedido.

function usesMercadoPagoCheckout(paymentMethod) {

    const totals = calculateTotals();

    return Boolean(
        (paymentMethod === "mercado-pago" || paymentMethod === "link") &&
        isMercadoPagoEnabled() &&
        totals.subtotal > 0 &&
        !totals.hasPendingPrices
    );

}


function updateSubmitButton(paymentMethod) {

    const isOnline = usesMercadoPagoCheckout(paymentMethod);

    const texts = {
        "mercado-pago": "Pagar con Mercado Pago",
        link: "Generar link de pago"
    };

    checkoutSubmitText.textContent = isOnline
        ? texts[paymentMethod]
        : "Enviar pedido por WhatsApp";

    checkoutSubmit.querySelector("i").hidden = isOnline;

}


function renderPaymentInfo() {

    const paymentMethod = getSelectedPaymentMethod();

    checkoutError.hidden = true;

    updateSubmitButton(paymentMethod);

    paymentInfo.innerHTML = "";
    paymentInfo.hidden = true;

    if (!paymentMethod) {

        updateCheckoutSummary();

        return;

    }

    paymentInfo.hidden = false;

    const title = document.createElement("strong");
    const description = document.createElement("p");

    const discountText =
        `Tenés un ${getDiscountPercent(paymentMethod)}% de descuento por pagar con ${paymentMethod === "transferencia" ? "transferencia" : "Mercado Pago"}.`;

    if (usesMercadoPagoCheckout(paymentMethod)) {

        title.textContent = paymentMethod === "link"
            ? "Link de pago de Mercado Pago"
            : "Pago con Mercado Pago";

        description.textContent = paymentMethod === "link"
            ? `${discountText} Te damos un link con el monto ya cargado: lo podés pagar ahora, más tarde o compartirlo. El pago se confirma solo.`
            : `${discountText} Te llevamos a Mercado Pago con el monto ya cargado para pagar de forma segura. El pago se confirma solo.`;

        paymentInfo.append(title, description);

    } else if (paymentMethod === "transferencia") {

        title.textContent = "Transferencia con alias";

        description.textContent =
            `${discountText} Transferí el monto exacto al alias y después envianos el comprobante por WhatsApp.`;

        paymentInfo.append(
            title,
            description,
            ...createPaymentAccess(paymentMethod)
        );

    } else if (isPrepaidMethod(paymentMethod)) {

        title.textContent = "Pago con Mercado Pago";

        description.textContent =
            `${discountText} Después de pagar, envianos el comprobante por WhatsApp.`;

        paymentInfo.append(
            title,
            description,
            ...createPaymentAccess(paymentMethod)
        );

    } else {

        title.textContent = "Pago al momento de la entrega";

        description.textContent =
            "Abonás en efectivo cuando recibas tu pedido. No se aplica descuento.";

        paymentInfo.append(title, description);

    }

    updateCheckoutSummary();

}


// El link solo se ofrece si Mercado Pago está conectado.

document.querySelectorAll("[data-payment-link]").forEach(option => {
    option.hidden = !isMercadoPagoEnabled();
});


checkoutForm.addEventListener("change", event => {

    if (event.target.name === "paymentMethod") {
        renderPaymentInfo();
    }

    if (event.target.name === "deliveryMethod") {

        deliveryZoneLabel.textContent = event.target.value === "uber"
            ? "Dirección de entrega *"
            : "Tu zona o barrio *";

        deliveryZone.placeholder = event.target.value === "uber"
            ? "Ej.: Av. Siempre Viva 123, Tortuguitas"
            : "Ej.: Tortuguitas";

    }

});


// ==========================================
// 19. GENERAR MENSAJE DE WHATSAPP
// ==========================================

function generateWhatsAppMessage(orderCode, paymentLink = "") {

    const name = customerName.value.trim();
    const phone = customerPhone.value.trim();
    const details = customerDetails.value.trim();

    const paymentMethod = getSelectedPaymentMethod();

    const totals = calculateTotals(paymentMethod);

    let message = "";

    message += "¡Hola Movea! Quiero realizar el siguiente pedido.\n\n";

    if (orderCode) {
        message += `Pedido: ${orderCode}\n\n`;
    }

    message += "DATOS DEL CLIENTE\n";
    message += `Nombre: ${name}\n`;
    message += `Teléfono: ${phone}\n\n`;

    message += "PRODUCTOS\n";

    cart.forEach(product => {

        message += `• ${product.quantity}x ${product.name}`;

        const variant = getVariantText(product);

        if (variant) {
            message += ` (${variant})`;
        }

        if (product.price > 0) {

            const productSubtotal =
                product.price * product.quantity;

            message += ` - ${formatPrice(productSubtotal)}`;

        } else {

            message += " - Precio pendiente de confirmación";

        }

        message += "\n";

    });

    message += "\nRESUMEN DEL PEDIDO\n";

    message +=
        `Subtotal de productos con precio conocido: ${formatPrice(totals.subtotal)}\n`;

    if (isPrepaidMethod(paymentMethod)) {

        const discountName = paymentMethod === "transferencia"
            ? "transferencia"
            : "Mercado Pago";

        message +=
            `Descuento por pagar con ${discountName} (${getDiscountPercent(paymentMethod)}%): -${formatPrice(totals.discount)}\n`;

    } else {

        message += "Descuento: No aplica\n";

    }

    message += `Total estimado: ${formatPrice(totals.total)}\n`;

    if (totals.hasPendingPrices) {

        message +=
            "IMPORTANTE: Hay productos con precio pendiente. El total final debe confirmarse.\n";

    }

    message += "\nENTREGA\n";
    message += `${DELIVERY_NAMES[getSelectedDeliveryMethod()]}\n`;
    message += `${deliveryZone.value.trim()}\n`;

    if (details) {

        message += "\nACLARACIONES\n";
        message += `${details}\n`;

    }

    message += "\n";

    message += "MÉTODO DE PAGO\n";
    message += `${PAYMENT_NAMES[paymentMethod]}\n`;

    if (paymentLink) {

        message += `Link de pago (monto ya cargado): ${paymentLink}\n`;
        message += "El pago se confirma automáticamente.\n";

    } else if (paymentMethod === "mercado-pago" || paymentMethod === "link") {

        message += "Espero el link de pago por WhatsApp.\n";

        message +=
            "Después de pagar, envío el comprobante por este chat.\n";

    } else if (paymentMethod === "transferencia") {

        message +=
            `Alias: ${PAYMENT_CONFIG.alias}\n`;

        if (!totals.hasPendingPrices) {
            message += `Monto a transferir: ${formatPrice(totals.total)}\n`;
        }

        message +=
            "Después de pagar, envío el comprobante por este chat.\n";

    } else {

        message +=
            "Abonaré al recibir el pedido.\n";

    }

    message += "\nQuedo a la espera de la confirmación de mi pedido.";

    return message;

}


// ==========================================
// 20. GUARDAR PEDIDO EN EL PANEL
// ==========================================

function isOrderSavingEnabled() {

    const config = window.MOVEA_SUPABASE;

    return Boolean(config && config.url && config.anonKey);

}


function createOrderCode() {

    // Sin letras ni números que se confundan (O, 0, I, 1).

    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const values = crypto.getRandomValues(new Uint8Array(8));

    return Array.from(values, value => {
        return characters[value % characters.length];
    }).join("");

}


async function saveOrder(orderCode, paymentMethod) {

    const config = window.MOVEA_SUPABASE;

    try {

        const response = await fetch(
            `${config.url}/rest/v1/rpc/create_order`,
            {
                method: "POST",
                keepalive: true,
                headers: {
                    apikey: config.anonKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    p_code: orderCode,
                    p_customer_name: customerName.value.trim(),
                    p_customer_phone: customerPhone.value.trim(),
                    p_details: customerDetails.value.trim(),
                    p_payment_method: getOrderPaymentMethod(paymentMethod),
                    p_delivery_method: getSelectedDeliveryMethod(),
                    p_delivery_zone: deliveryZone.value.trim(),
                    p_items: cart.map(product => {
                        return {
                            id: product.id,
                            size: product.size,
                            color: product.color,
                            quantity: product.quantity
                        };
                    })
                })
            }
        );

        if (!response.ok) {

            const detail = await response.json().catch(() => ({}));

            // Sin stock o sobre el tope: el pedido no se puede tomar.

            if (/^(Sin stock|Máximo)/.test(detail.message ?? "")) {
                return { saved: false, blockedBy: detail.message };
            }

            throw new Error(`Respuesta ${response.status}`);

        }

        return { saved: true };

    } catch (error) {

        console.error("No se pudo guardar el pedido:", error);

        return { saved: false };

    }

}


async function createPaymentLink(orderCode) {

    const config = window.MOVEA_SUPABASE;

    const response = await fetch(
        `${config.url}/functions/v1/crear-pago`,
        {
            method: "POST",
            headers: {
                apikey: config.anonKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ code: orderCode })
        }
    );

    if (!response.ok) {
        throw new Error(`Respuesta ${response.status}`);
    }

    const { init_point: paymentLink } = await response.json();

    const { protocol, hostname } = new URL(paymentLink);

    if (protocol !== "https:" || !hostname.endsWith(".mercadopago.com.ar")) {
        throw new Error("Dirección de pago inesperada");
    }

    return paymentLink;

}


// "mercado-pago" lleva directo a pagar; "link" muestra el link
// para pagarlo después o compartirlo. Los dos tienen el monto cargado.

async function startOnlinePayment(paymentMethod) {

    checkoutError.hidden = true;

    checkoutSubmit.disabled = true;
    checkoutSubmitText.textContent = "Conectando con Mercado Pago...";

    try {

        const orderCode = createOrderCode();

        const result = await saveOrder(orderCode, paymentMethod);

        if (result.blockedBy) {

            showBlockedOrder(result.blockedBy);

            return;

        }

        if (!result.saved) {
            throw new Error("Pedido sin guardar");
        }

        let paymentLink = "";

        try {

            paymentLink = await createPaymentLink(orderCode);

        } catch (error) {

            // El pedido ya está guardado y con stock reservado:
            // reintentar crearía otro. Sigue por WhatsApp y el link se manda a mano.

            console.error("No se pudo crear el link de pago:", error);

        }

        if (paymentLink && paymentMethod === "mercado-pago") {

            location.href = paymentLink;

            return;

        }

        const message = generateWhatsAppMessage(orderCode, paymentLink);

        const whatsappURL = window.MOVEA_TIENDA.whatsappUrl(message);

        checkoutSubmit.disabled = false;

        updateSubmitButton(paymentMethod);

        showOrderDone(orderCode, paymentMethod, whatsappURL, paymentLink);

    } catch (error) {

        console.error("No se pudo iniciar el pago:", error);

        checkoutError.textContent =
            "No pudimos conectar con Mercado Pago. Probá de nuevo o elegí otro método de pago.";

        checkoutError.hidden = false;

        checkoutSubmit.disabled = false;

        updateSubmitButton(paymentMethod);

    }

}


// ==========================================
// 21. ENVIAR PEDIDO
// ==========================================

checkoutForm.addEventListener("submit", event => {

    event.preventDefault();

    if (cart.length === 0) {

        alert("Tu carrito está vacío.");

        showCartView();

        return;

    }

    if (!checkoutForm.reportValidity()) {
        return;
    }

    const paymentMethod = getSelectedPaymentMethod();

    if (!paymentMethod) {

        alert("Seleccioná un método de pago.");

        return;

    }

    if (usesMercadoPagoCheckout(paymentMethod)) {

        startOnlinePayment(paymentMethod);

        return;

    }

    submitOrder(paymentMethod);

});


function showBlockedOrder(message) {

    checkoutError.textContent =
        `${message}. Quitá ese producto del carrito o elegí otra opción.`.replace("..", ".");

    checkoutError.hidden = false;

    checkoutSubmit.disabled = false;

    updateSubmitButton(getSelectedPaymentMethod());

}


async function submitOrder(paymentMethod) {

    checkoutError.hidden = true;

    let orderCode = "";

    if (isOrderSavingEnabled()) {

        checkoutSubmit.disabled = true;
        checkoutSubmitText.textContent = "Guardando pedido...";

        const candidate = createOrderCode();

        const result = await saveOrder(candidate, paymentMethod);

        if (result.blockedBy) {

            showBlockedOrder(result.blockedBy);

            return;

        }

        // Si falla la conexión, el pedido igual se puede enviar por WhatsApp.

        if (result.saved) {
            orderCode = candidate;
        }

        checkoutSubmit.disabled = false;

        updateSubmitButton(paymentMethod);

    }

    const message = generateWhatsAppMessage(orderCode);

    const whatsappURL = window.MOVEA_TIENDA.whatsappUrl(message);

    showOrderDone(orderCode, paymentMethod, whatsappURL);

}


function showOrderDone(orderCode, paymentMethod, whatsappURL, paymentLink = "") {

    checkoutSection.hidden = true;
    orderDone.hidden = false;

    orderDoneCode.textContent = `Pedido ${orderCode}`;
    orderDoneCode.hidden = !orderCode;

    orderDoneProof.hidden = !isPrepaidMethod(paymentMethod);

    // Con link de Mercado Pago no hace falta comprobante: el pago se confirma solo.

    orderDoneProofTitle.textContent = paymentLink
        ? "Tu link de pago"
        : "Enviá tu comprobante";

    orderDoneProofText.textContent = paymentLink
        ? "El monto ya está cargado. Podés pagar ahora o más tarde, y también compartir el link. Cuando se acredite, tu pedido se confirma solo."
        : "Cuando hagas el pago, mandanos el comprobante por el mismo chat de WhatsApp. Tu pedido se confirma al verificarlo.";

    orderDonePayment.replaceChildren(
        ...(isPrepaidMethod(paymentMethod)
            ? createPaymentAccess(paymentMethod, paymentLink)
            : [])
    );

    orderDoneWhatsapp.href = whatsappURL;

    orderDone.focus();

}


orderDoneFinish.addEventListener("click", () => {

    cart = [];

    saveCart();
    renderCart();

    checkoutForm.reset();

    showCartView();
    closeCart();

});


// ==========================================
// 22. ACTUALIZAR PRODUCTOS GUARDADOS
// ==========================================

// El carrito guardado puede tener precios viejos:
// los datos de la página son los que valen.

function syncCartWithPage() {

    document.querySelectorAll(".product_card[data-id]").forEach(card => {

        cart.filter(item => item.id === card.dataset.id).forEach(product => {

            product.name = card.dataset.name;
            product.price = Number(card.dataset.price);

        });

    });

    saveCart();

}


// Con el catálogo del panel también se quitan
// los productos que ya no están a la venta.

document.addEventListener("movea:catalogo", event => {

    const catalog = new Map(
        event.detail.map(product => [product.id, product])
    );

    const isAvailable = product => {

        const item = catalog.get(product.id);

        return (
            item &&
            (item.sizes.length === 0 || item.sizes.includes(product.size)) &&
            (item.colors.length === 0 || item.colors.includes(product.color)) &&
            (!item.track_stock || item.product_stock.some(stock => {

                return (
                    stock.size === product.size &&
                    stock.color === product.color &&
                    stock.quantity > 0
                );

            }))
        );

    };

    cart = cart.filter(isAvailable);

    cart.forEach(product => {

        const item = catalog.get(product.id);

        product.name = item.name;
        product.price = item.price;

        if (item.image_url) {
            product.image = new URL(item.image_url, siteRoot).href;
        }

    });

    saveCart();
    renderCart();
    showPrepaidPrices();
    openSharedProduct();

});


// Un enlace compartido (productos.html?producto=ID) abre ese producto.

let sharedProductOpened = false;

function openSharedProduct() {

    const id = new URLSearchParams(location.search).get("producto");

    if (!id || sharedProductOpened) return;

    sharedProductOpened = true;

    const card = Array.from(document.querySelectorAll(".product_card[data-id]"))
        .find(item => item.dataset.id === id);

    if (!card) return;

    // Agotado: no se abre la ventana, se muestra la tarjeta con "Avisame cuando vuelva".

    if (card.classList.contains("is-sold-out")) {

        card.scrollIntoView({ block: "center" });

        return;

    }

    openProductDialog(card);

}


// ==========================================
// 23. INICIALIZAR
// ==========================================

syncCartWithPage();
renderCart();
showPrepaidPrices();
