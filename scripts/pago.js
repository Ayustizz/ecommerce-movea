"use strict";

// Página de vuelta desde Mercado Pago.
// Lo que viene en la dirección solo define el mensaje:
// el pedido se marca como pagado desde el servidor.

const WHATSAPP_NUMBER = "5491157368246";

// Misma clave que STORAGE_KEY en scripts/carrito.js
const STORAGE_KEY = "movea-cart-v2";

const parameters = new URLSearchParams(location.search);

const isApproved = parameters.get("estado") === "aprobado";

const rawCode = parameters.get("codigo") ?? "";
const orderCode = /^[A-Z0-9]{8}$/.test(rawCode) ? rawCode : "";

const title = document.getElementById("pago-titulo");
const text = document.getElementById("pago-texto");
const code = document.getElementById("pago-codigo");
const icon = document.getElementById("pago-icono");
const whatsapp = document.getElementById("pago-whatsapp");
const retry = document.getElementById("pago-reintentar");

code.textContent = `Pedido ${orderCode}`;
code.hidden = !orderCode;

if (isApproved) {

    title.textContent = "¡Gracias por tu compra!";

    text.textContent =
        "Recibimos tu pago. Escribinos por WhatsApp para coordinar la entrega.";

    retry.hidden = true;

    const message =
        `¡Hola Movea! Pagué mi pedido${orderCode ? ` ${orderCode}` : ""} por Mercado Pago. Quiero coordinar la entrega.`;

    whatsapp.href =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    try {

        localStorage.removeItem(STORAGE_KEY);

    } catch (error) {

        console.error("No se pudo vaciar el carrito:", error);

    }

} else {

    title.textContent = "El pago no se completó";

    text.textContent =
        "No se hizo ningún cobro. Tu carrito sigue guardado para que vuelvas a intentarlo.";

    icon.className = "fa-solid fa-circle-xmark pago-icono pago-icono--error";

    whatsapp.hidden = true;

}
