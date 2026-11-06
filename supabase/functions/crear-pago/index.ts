// Crea el pago en Mercado Pago para un pedido ya guardado.
// Recibe solo el código del pedido: el importe sale de la base.

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://moveafit.netlify.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

const ALLOWED_ORIGINS = [new URL(SITE_URL).origin, "http://localhost:5500"];

const dbHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json"
};

function corsHeaders(origin) {

    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "content-type, apikey",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin"
    };

}

function reply(origin, status, body) {

    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
    });

}

Deno.serve(async request => {

    const origin = request.headers.get("origin") ?? "";

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
        return reply(origin, 405, { error: "Método no permitido" });
    }

    const { code } = await request.json().catch(() => ({}));

    if (typeof code !== "string" || !/^[A-Z0-9]{8}$/.test(code)) {
        return reply(origin, 400, { error: "Pedido inválido" });
    }

    const orderResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?code=eq.${code}&select=id,total,status,payment_method,has_pending_prices,mp_init_point`,
        { headers: dbHeaders }
    );

    if (!orderResponse.ok) {

        console.error("Error al leer el pedido:", orderResponse.status);

        return reply(origin, 500, { error: "No se pudo leer el pedido" });

    }

    const [order] = await orderResponse.json();

    if (!order) {
        return reply(origin, 404, { error: "Pedido no encontrado" });
    }

    if (
        order.status !== "pendiente" ||
        order.payment_method !== "mercado-pago" ||
        order.has_pending_prices ||
        order.total <= 0
    ) {
        return reply(origin, 400, { error: "El pedido no se puede pagar online" });
    }

    if (order.mp_init_point) {
        return reply(origin, 200, { init_point: order.mp_init_point });
    }

    const returnUrl = `${SITE_URL}/Pages/pago.html?codigo=${code}`;

    const preferenceResponse = await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
                "X-Idempotency-Key": code
            },
            body: JSON.stringify({
                items: [{
                    title: `Pedido ${code} - Movea`,
                    quantity: 1,
                    unit_price: order.total,
                    currency_id: "ARS"
                }],
                external_reference: code,
                back_urls: {
                    success: `${returnUrl}&estado=aprobado`,
                    failure: `${returnUrl}&estado=rechazado`,
                    pending: `${returnUrl}&estado=rechazado`
                },
                auto_return: "approved",
                binary_mode: true,
                statement_descriptor: "MOVEA"
            })
        }
    );

    if (!preferenceResponse.ok) {

        console.error("Mercado Pago rechazó el pago:", preferenceResponse.status, await preferenceResponse.text());

        return reply(origin, 502, { error: "No se pudo conectar con Mercado Pago" });

    }

    const preference = await preferenceResponse.json();

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ mp_init_point: preference.init_point, mp_status: "iniciado" })
    });

    return reply(origin, 200, { init_point: preference.init_point });

});
