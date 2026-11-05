"use strict";

// ==========================================
// DATOS DE LA TIENDA
// Para cambiar el WhatsApp, los horarios o la guía de talles,
// se edita solo este archivo: todas las páginas lo usan.
// ==========================================

window.MOVEA_TIENDA = {

    // WhatsApp de la tienda, solo números: 54 + 9 + código de área + número.
    whatsapp: "5491151227752",

    // Cómo se muestra el número en la página.
    whatsappVisible: "11 5122-7752",

    instagram: "moveafitt",

    // Se muestra en Contacto. Dejarlo vacío ("") para ocultarlo.
    horario: "Lunes a sábado de 9 a 20 h",

    // Guía de talles de la ventana de cada producto, en centímetros.
    // Dejar filas: [] para ocultar el enlace "¿Qué talle soy?".
    guiaDeTalles: {
        columnas: ["Talle", "Busto", "Cintura", "Cadera"],
        filas: [
            ["XS", "78-82", "58-62", "84-88"],
            ["S", "82-86", "62-66", "88-92"],
            ["M", "86-90", "66-70", "92-96"],
            ["L", "90-96", "70-76", "96-102"],
            ["XL", "96-102", "76-82", "102-108"],
            ["XXL", "102-108", "82-88", "108-114"]
        ],
        nota: "Si estás entre dos talles, te recomendamos el más grande. Ante cualquier duda, escribinos."
    }

};


// Enlace de WhatsApp con un mensaje ya escrito.

window.MOVEA_TIENDA.whatsappUrl = (message = "") => {

    const base = `https://wa.me/${window.MOVEA_TIENDA.whatsapp}`;

    return message ? `${base}?text=${encodeURIComponent(message)}` : base;

};


// Los enlaces y textos del HTML marcados con data-whatsapp
// toman el número de acá, así no hay que cambiarlo página por página.

document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href = window.MOVEA_TIENDA.whatsappUrl(link.dataset.whatsapp);
});

document.querySelectorAll("[data-whatsapp-text]").forEach(element => {
    element.textContent = window.MOVEA_TIENDA.whatsappVisible;
});

document.querySelectorAll("[data-whatsapp-label]").forEach(element => {
    element.setAttribute(
        "aria-label",
        `${element.dataset.whatsappLabel} ${window.MOVEA_TIENDA.whatsappVisible}`
    );
});

document.querySelectorAll("[data-horario]").forEach(element => {
    element.textContent = window.MOVEA_TIENDA.horario;
    element.hidden = !window.MOVEA_TIENDA.horario;
});
