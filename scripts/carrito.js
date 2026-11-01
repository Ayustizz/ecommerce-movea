
"use strict";

// ==========================================
// 1. CONFIGURACIÓN
// ==========================================

const WHATSAPP_NUMBER = "5491157368246";

const STORAGE_KEY = "movea-cart-v1";

// Datos provisionales: reemplazarlos cuando tengas
// el link y el alias definitivos de Movea.

const PAYMENT_CONFIG = {
    mercadoPagoLink: "https://link.mercadopago.com.ar/TU_NEGOCI",
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
const customerDetails = document.getElementById("customer-details");

const paymentInfo = document.getElementById("payment-info");

const checkoutSubtotal = document.getElementById("checkout-subtotal");
const checkoutDiscount = document.getElementById("checkout-discount");
const checkoutTotal = document.getElementById("checkout-total");
const checkoutDiscountRow = document.getElementById("checkout-discount-row");
const checkoutPending = document.getElementById("checkout-pending");


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
                typeof product.id === "string" &&
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
// 9. AGREGAR PRODUCTOS
// ==========================================

document.addEventListener("click", event => {

    const button = event.target.closest(".product-card__order");

    if (!button) return;

    const productCard = button.closest(".product_card");

    if (!productCard) return;

    const id = productCard.dataset.id;
    const name = productCard.dataset.name;
    const price = Number(productCard.dataset.price);

    if (
        !id ||
        !name ||
        !Number.isFinite(price) ||
        price < 0
    ) {

        console.error("Producto con datos incorrectos:", productCard);

        return;

    }

    const existingProduct = cart.find(product => {
        return product.id === id;
    });

    if (existingProduct) {

        if (existingProduct.quantity >= 99) {

            alert("Alcanzaste el máximo de unidades para este producto.");

            return;

        }

        existingProduct.quantity++;

    } else {

        cart.push({
            id,
            name,
            price,
            quantity: 1
        });

    }

    saveCart();
    renderCart();
    openCart();

});


// ==========================================
// 10. MODIFICAR CANTIDADES
// ==========================================

function changeQuantity(id, amount) {

    const product = cart.find(item => item.id === id);

    if (!product) return;

    const newQuantity = product.quantity + amount;

    if (newQuantity <= 0) {

        removeProduct(id);

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

function removeProduct(id) {

    cart = cart.filter(product => product.id !== id);

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

    info.append(name, price);

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
        changeQuantity(product.id, -1);
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
        changeQuantity(product.id, 1);
    });

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.textContent = "Eliminar";
    removeButton.classList.add("cart-item-remove");

    removeButton.addEventListener("click", () => {
        removeProduct(product.id);
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

    const firstInput = customerName;

    firstInput.focus();

}


function showCartView() {

    checkoutSection.hidden = true;

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

    if (paymentMethod === "mercado-pago") {

        title.textContent = "Pago mediante Mercado Pago";

        description.textContent =
            "Tenés un 15% de descuento por pagar antes de la entrega.";

        const link = document.createElement("a");

        link.href = PAYMENT_CONFIG.mercadoPagoLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Abrir link de Mercado Pago";

        paymentInfo.append(title, description, link);

    } else if (paymentMethod === "transferencia") {

        title.textContent = "Pago mediante transferencia";

        description.textContent =
            `Alias de transferencia: ${PAYMENT_CONFIG.alias}`;

        const alias = document.createElement("strong");

        alias.classList.add("payment-alias");
        alias.textContent = PAYMENT_CONFIG.alias;

        paymentInfo.append(title, description, alias);

    } else if (paymentMethod === "entrega") {

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

function generateWhatsAppMessage() {

    const name = customerName.value.trim();
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

    message += "DATOS DEL CLIENTE\n";
    message += `Nombre: ${name}\n\n`;

    message += "PRODUCTOS\n";

    cart.forEach(product => {

        message += `• ${product.quantity}x ${product.name}`;

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

    message += "\nDETALLES DEL PEDIDO\n";
    message += `${details}\n\n`;

    message += "MÉTODO DE PAGO\n";
    message += `${paymentNames[paymentMethod]}\n`;

    if (paymentMethod === "mercado-pago") {

        message +=
            `Link de pago: ${PAYMENT_CONFIG.mercadoPagoLink}\n`;

        message +=
            "El pago queda pendiente de verificación por Movea.\n";

    } else if (paymentMethod === "transferencia") {

        message +=
            `Alias: ${PAYMENT_CONFIG.alias}\n`;

        message +=
            "El pago queda pendiente de verificación por Movea.\n";

    } else {

        message +=
            "Abonaré al recibir el pedido.\n";

    }

    message += "\nQuedo a la espera de la confirmación de mi pedido.";

    return message;

}


// ==========================================
// 20. ENVIAR PEDIDO
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

    const message = generateWhatsAppMessage();

    const whatsappURL =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(
        whatsappURL,
        "_blank",
        "noopener,noreferrer"
    );

});


// ==========================================
// 21. INICIALIZAR
// ==========================================

renderCart();
