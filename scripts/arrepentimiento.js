"use strict";

// El número de WhatsApp está en scripts/tienda-config.js.

const regretForm = document.getElementById("regret-form");

regretForm.addEventListener("submit", event => {

    event.preventDefault();

    const name = document.getElementById("regret-name").value.trim();
    const phone = document.getElementById("regret-phone").value.trim();
    const order = document.getElementById("regret-order").value.trim();

    const message =
        `¡Hola Movea! Quiero arrepentirme de mi compra.\n\nNombre: ${name}\nTeléfono: ${phone}\nPedido: ${order}`;

    location.href = window.MOVEA_TIENDA.whatsappUrl(message);

});
