"use strict";

// ==========================================
// DATOS DE LA TIENDA
// Todo lo que cambia de un negocio a otro está acá:
// nombre, contacto, cobro, opciones de los productos y entregas.
// Los colores y tipografías están en styles/tema.css.
// ==========================================

window.TIENDA = {

    // Identificador corto, sin espacios: se usa para guardar el carrito
    // y en el nombre de los archivos que se descargan desde el panel.
    id: "movea",

    nombre: "Movea",

    // WhatsApp de la tienda, solo números: 54 + 9 + código de área + número.
    whatsapp: "5491151227752",

    // Cómo se muestra el número en la página.
    whatsappVisible: "11 5122-7752",

    instagram: "moveafitt",

    // Se muestra en Contacto. Dejarlo vacío ("") para ocultarlo.
    horario: "Lunes a sábado de 9 a 20 h",

    // Datos para la transferencia. Titular vacío ("") para no mostrarlo.
    transferencia: {
        alias: "Martuu.rocio",
        titular: "Martina Rocio Bugallo Zak"
    },

    // Descuento (%) por medio de pago. El que vale es el que se carga en el
    // panel (Ajustes); estos números se usan solo si el panel no responde.
    descuentos: {
        "mercado-pago": 10,
        transferencia: 10
    },

    // Opciones que elige el cliente en cada producto.
    // "talle" son botones fijos que se marcan en el panel; "color" se escribe libre.
    // Para un rubro sin talles: opciones: []. Para cambiar el nombre: nombre y plural.
    variantes: {
        talle: {
            nombre: "Talle",
            plural: "Talles",
            opciones: ["XS", "S", "M", "L", "XL", "XXL", "Único"],
            // Con estas opciones no se muestra la guía de talles.
            sinGuia: ["Único"]
        },
        color: {
            nombre: "Color",
            plural: "Colores",
            ejemplo: "Negro, Blanco, Marrón"
        }
    },

    // Formas de entrega del checkout. El id no lleva espacios ni mayúsculas
    // y no se cambia una vez que hay pedidos (los pedidos lo guardan).
    // nombre y detalle: se ven al elegir. mensaje: va en el WhatsApp del pedido.
    // dato y ejemplo: el campo que se pide (zona, dirección...).
    entregas: [
        {
            id: "encuentro",
            nombre: "Punto de encuentro",
            detalle: "Coordinamos el lugar con vos",
            mensaje: "Punto de encuentro",
            dato: "Tu zona o barrio",
            ejemplo: "Ej.: Tortuguitas"
        },
        {
            id: "uber",
            nombre: "Envío por Uber",
            detalle: "Coordinamos el envío y su costo con vos",
            mensaje: "Envío a coordinar",
            dato: "Dirección de entrega",
            ejemplo: "Ej.: Av. Siempre Viva 123, Tortuguitas"
        }
    ],

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

window.TIENDA.whatsappUrl = (message = "") => {

    const base = `https://wa.me/${window.TIENDA.whatsapp}`;

    return message ? `${base}?text=${encodeURIComponent(message)}` : base;

};


// Saludo con el que empiezan los mensajes de WhatsApp.

window.TIENDA.saludo = () => `¡Hola ${window.TIENDA.nombre}!`;


// Los enlaces y textos del HTML marcados con data-* toman los datos de acá,
// así no hay que cambiarlos página por página.

document.querySelectorAll("[data-whatsapp]").forEach(link => {
    link.href = window.TIENDA.whatsappUrl(link.dataset.whatsapp);
});

document.querySelectorAll("[data-whatsapp-text]").forEach(element => {
    element.textContent = window.TIENDA.whatsappVisible;
});

document.querySelectorAll("[data-whatsapp-label]").forEach(element => {
    element.setAttribute(
        "aria-label",
        `${element.dataset.whatsappLabel} ${window.TIENDA.whatsappVisible}`
    );
});

document.querySelectorAll("[data-horario]").forEach(element => {
    element.textContent = window.TIENDA.horario;
    element.hidden = !window.TIENDA.horario;
});

document.querySelectorAll("[data-tienda-nombre]").forEach(element => {
    element.textContent = window.TIENDA.nombre;
});


// Descuentos en los textos: <span data-descuento="transferencia">10</span>.
// "mejor" muestra el más alto de los dos; "mejor-texto" agrega "hasta" si son distintos.

window.TIENDA.mostrarDescuentos = () => {

    const discounts = window.TIENDA.descuentos;

    const best = Math.max(discounts["mercado-pago"], discounts.transferencia);

    const values = {
        "mercado-pago": discounts["mercado-pago"],
        transferencia: discounts.transferencia,
        mejor: best,
        // "hasta 15" si cada medio tiene un descuento distinto
        "mejor-texto": discounts["mercado-pago"] === discounts.transferencia ? best : `hasta ${best}`
    };

    document.querySelectorAll("[data-descuento]").forEach(element => {
        element.textContent = values[element.dataset.descuento] ?? "";
    });

};

window.TIENDA.mostrarDescuentos();


// Los descuentos que valen son los que se cargan en el panel (tabla "ajustes").
// Si no responde, quedan los de arriba.

document.addEventListener("DOMContentLoaded", async () => {

    const config = window.TIENDA_SUPABASE;

    if (!config || !config.url || !config.anonKey) return;

    try {

        const response = await fetch(
            `${config.url}/rest/v1/ajustes?select=descuento_mercado_pago,descuento_transferencia&id=eq.1`,
            { headers: { apikey: config.anonKey } }
        );

        if (!response.ok) {
            throw new Error(`Respuesta ${response.status}`);
        }

        const [settings] = await response.json();

        if (!settings) return;

        window.TIENDA.descuentos = {
            "mercado-pago": settings.descuento_mercado_pago,
            transferencia: settings.descuento_transferencia
        };

        window.TIENDA.mostrarDescuentos();

        document.dispatchEvent(
            new CustomEvent("tienda:descuentos", { detail: window.TIENDA.descuentos })
        );

    } catch (error) {

        console.warn("Se usan los descuentos de tienda-config.js:", error);

    }

});
