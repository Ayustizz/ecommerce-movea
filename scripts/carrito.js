
"use strict";

// ==========================================
// 1. CONFIGURACIÓN
// ==========================================

const WHATSAPP_NUMBER = "5491157368246";

const STORAGE_KEY = "movea-cart-v2";

// Datos provisionales: reemplazarlos cuando tengas
// el link y el alias definitivos de Movea.

const PAYMENT_CONFIG = {
    // Si queda vacío, el link se envía por WhatsApp.
    mercadoPagoLink: "",
    alias: "Martuu.rocio",
    discount: 15
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

const paymentInfo = document.getElementById("payment-info");

const checkoutSubtotal = document.getElementById("checkout-subtotal");
const checkoutDiscount = document.getElementById("checkout-discount");
const checkoutTotal = document.getElementById("checkout-total");
const checkoutDiscountRow = document.getElementById("checkout-discount-row");
const checkoutPending = document.getElementById("checkout-pending");

const orderDone = document.getElementById("order-done");
const orderDoneCode = document.getElementById("order-done-code");
const orderDoneProof = document.getElementById("order-done-proof");
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
const productQuantityLess = document.getElementById("product-quantity-less");
const productQuantityMore = document.getElementById("product-quantity-more");
const productQuantityValue = document.getElementById("product-quantity-value");

const cartToast = document.getElementById("cart-toast");
const cartToastText = document.getElementById("cart-toast-text");
const cartToastOpen = document.getElementById("cart-toast-open");


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

function formatPrice(price) {

    return price.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    });

}


// ==========================================
// 6. CALCULAR IMPORTES
// ==========================================

function calculateTotals(paymentMethod = "") {

    const subtotal = cart.reduce((total, product) => {

        return total + product.price * product.quantity;

    }, 0);

    const hasPendingPrices = cart.some(product => {
        return product.price === 0;
    });

    const isPrepaid =
        paymentMethod === "mercado-pago" ||
        paymentMethod === "transferencia";

    const discount = isPrepaid
        ? Math.round(subtotal * PAYMENT_CONFIG.discount / 100)
        : 0;

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

        text.textContent = option;

        label.append(input, text);
        list.appendChild(label);

    });

}


function setSelectedQuantity(quantity) {

    selectedQuantity = Math.min(Math.max(quantity, 1), 99);

    productQuantityValue.textContent = selectedQuantity;

    productQuantityLess.disabled = selectedQuantity === 1;
    productQuantityMore.disabled = selectedQuantity === 99;

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
    productDialogPrice.textContent = product.priceText;
    productDialogDescription.textContent = product.description;

    renderProductOptions(productDialogSizes, product.sizes, "productSize");
    renderProductOptions(productDialogColors, product.colors, "productColor");

    setSelectedQuantity(1);

    productDialogError.hidden = true;

    productDialog.showModal();
    productDialog.scrollTop = 0;

    document.body.classList.add("cart-open");

}


document.addEventListener("click", event => {

    const trigger = event.target.closest(
        ".product_card .product-card__order, .product_card figure, .product_card h2"
    );

    if (trigger) {
        openProductDialog(trigger.closest(".product_card"));
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

        if (!(price > 0) || card.querySelector(".product-card__prepaid")) return;

        const prepaid = document.createElement("p");

        const prepaidPrice =
            price - Math.round(price * PAYMENT_CONFIG.discount / 100);

        prepaid.classList.add("product-card__prepaid");
        prepaid.textContent = `${formatPrice(prepaidPrice)} pagando antes`;

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


function updateCheckoutSummary() {

    const paymentMethod = getSelectedPaymentMethod();

    const totals = calculateTotals(paymentMethod);

    checkoutSubtotal.textContent = formatPrice(totals.subtotal);

    checkoutDiscount.textContent =
        `-${formatPrice(totals.discount)}`;

    checkoutTotal.textContent = formatPrice(totals.total);

    // Si elige pago al recibir, no hay descuento.

    checkoutDiscountRow.hidden =
        paymentMethod === "entrega";

    // Aviso por productos sin precio.

    checkoutPending.hidden = !totals.hasPendingPrices;

}


// ==========================================
// 18. INFORMACIÓN DEL MÉTODO DE PAGO
// ==========================================

function isPrepaidMethod(paymentMethod) {

    return (
        paymentMethod === "mercado-pago" ||
        paymentMethod === "transferencia"
    );

}


async function copyAlias(button) {

    try {

        await navigator.clipboard.writeText(PAYMENT_CONFIG.alias);

        button.textContent = "¡Copiado!";

    } catch (error) {

        console.error("No se pudo copiar el alias:", error);

        button.textContent = "Copialo a mano";

    }

}


function createPaymentAccess(paymentMethod) {

    const access = [];

    if (paymentMethod === "transferencia") {

        const alias = document.createElement("strong");

        alias.classList.add("payment-alias");
        alias.textContent = PAYMENT_CONFIG.alias;

        const copyButton = document.createElement("button");

        copyButton.type = "button";
        copyButton.classList.add("payment-copy");
        copyButton.textContent = "Copiar alias";

        copyButton.addEventListener("click", () => copyAlias(copyButton));

        access.push(alias, copyButton);

    } else if (PAYMENT_CONFIG.mercadoPagoLink) {

        const link = document.createElement("a");

        link.href = PAYMENT_CONFIG.mercadoPagoLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Abrir link de Mercado Pago";

        access.push(link);

    } else {

        const linkNote = document.createElement("p");

        linkNote.textContent =
            "Te enviaremos el link de pago por WhatsApp.";

        access.push(linkNote);

    }

    return access;

}


function renderPaymentInfo() {

    const paymentMethod = getSelectedPaymentMethod();

    paymentInfo.innerHTML = "";
    paymentInfo.hidden = true;

    if (!paymentMethod) {

        updateCheckoutSummary();

        return;

    }

    paymentInfo.hidden = false;

    const title = document.createElement("strong");
    const description = document.createElement("p");

    if (isPrepaidMethod(paymentMethod)) {

        title.textContent = paymentMethod === "mercado-pago"
            ? "Pago mediante Mercado Pago"
            : "Pago mediante transferencia";

        description.textContent =
            "Tenés un 15% de descuento por pagar antes de la entrega. Después de pagar, envianos el comprobante por WhatsApp.";

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


checkoutForm.addEventListener("change", event => {

    if (event.target.name === "paymentMethod") {
        renderPaymentInfo();
    }

});


// ==========================================
// 19. GENERAR MENSAJE DE WHATSAPP
// ==========================================

function generateWhatsAppMessage(orderCode) {

    const name = customerName.value.trim();
    const phone = customerPhone.value.trim();
    const details = customerDetails.value.trim();

    const paymentMethod = getSelectedPaymentMethod();

    const totals = calculateTotals(paymentMethod);

    const paymentNames = {
        "mercado-pago": "Mercado Pago",
        "transferencia": "Transferencia bancaria",
        "entrega": "Efectivo al momento de la entrega"
    };

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

    if (paymentMethod === "mercado-pago" ||
        paymentMethod === "transferencia") {

        message +=
            `Descuento por pago anticipado (${PAYMENT_CONFIG.discount}%): -${formatPrice(totals.discount)}\n`;

    } else {

        message += "Descuento: No aplica\n";

    }

    message += `Total estimado: ${formatPrice(totals.total)}\n`;

    if (totals.hasPendingPrices) {

        message +=
            "IMPORTANTE: Hay productos con precio pendiente. El total final debe confirmarse.\n";

    }

    if (details) {

        message += "\nACLARACIONES\n";
        message += `${details}\n`;

    }

    message += "\n";

    message += "MÉTODO DE PAGO\n";
    message += `${paymentNames[paymentMethod]}\n`;

    if (paymentMethod === "mercado-pago") {

        message += PAYMENT_CONFIG.mercadoPagoLink
            ? `Link de pago: ${PAYMENT_CONFIG.mercadoPagoLink}\n`
            : "Espero el link de pago por WhatsApp.\n";

        message +=
            "Después de pagar, envío el comprobante por este chat.\n";

    } else if (paymentMethod === "transferencia") {

        message +=
            `Alias: ${PAYMENT_CONFIG.alias}\n`;

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


// No se espera la respuesta: el navegador bloquea
// abrir WhatsApp si no es inmediato al clic.

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
                    p_payment_method: paymentMethod,
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
            throw new Error(`Respuesta ${response.status}`);
        }

    } catch (error) {

        console.error("No se pudo guardar el pedido:", error);

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

    const orderCode = isOrderSavingEnabled() ? createOrderCode() : "";

    if (orderCode) {
        saveOrder(orderCode, paymentMethod);
    }

    const message = generateWhatsAppMessage(orderCode);

    const whatsappURL =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(
        whatsappURL,
        "_blank",
        "noopener,noreferrer"
    );

    showOrderDone(orderCode, paymentMethod, whatsappURL);

});


function showOrderDone(orderCode, paymentMethod, whatsappURL) {

    checkoutSection.hidden = true;
    orderDone.hidden = false;

    orderDoneCode.textContent = `Pedido ${orderCode}`;
    orderDoneCode.hidden = !orderCode;

    orderDoneProof.hidden = !isPrepaidMethod(paymentMethod);

    orderDonePayment.replaceChildren(
        ...(isPrepaidMethod(paymentMethod)
            ? createPaymentAccess(paymentMethod)
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
            (item.colors.length === 0 || item.colors.includes(product.color))
        );

    };

    cart = cart.filter(isAvailable);

    cart.forEach(product => {

        product.name = catalog.get(product.id).name;
        product.price = catalog.get(product.id).price;

    });

    saveCart();
    renderCart();
    showPrepaidPrices();

});


// ==========================================
// 23. INICIALIZAR
// ==========================================

syncCartWithPage();
renderCart();
showPrepaidPrices();
