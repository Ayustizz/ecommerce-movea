// Recibe los avisos de Mercado Pago. El aviso solo dice "mirá este pago":
// el estado y el importe se consultan siempre a la API de Mercado Pago.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET");

const dbHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json"
};

async function isValidSignature(request, dataId) {

    const signature = request.headers.get("x-signature") ?? "";
    const requestId = request.headers.get("x-request-id") ?? "";

    const parts = Object.fromEntries(
        signature.split(",").map(part => part.trim().split("=", 2))
    );

    if (!parts.ts || !parts.v1 || !MP_WEBHOOK_SECRET) return false;

    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(MP_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));

    const expected = Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");

    if (expected.length !== parts.v1.length) return false;

    // Comparación de tiempo constante

    let difference = 0;

    for (let index = 0; index < expected.length; index++) {
        difference |= expected.charCodeAt(index) ^ parts.v1.charCodeAt(index);
    }

    return difference === 0;

}

function getOrderChanges(order, payment) {

    const changes = {
        mp_payment_id: String(payment.id),
        mp_status: payment.status
    };

    if (payment.status === "approved") {

        const isCorrect =
            payment.currency_id === "ARS" &&
            payment.transaction_amount >= order.total;

        if (!isCorrect) {

            changes.mp_status = "monto_incorrecto";

        } else if (order.status === "pendiente") {

            changes.status = "pagado";

        }

    }

    if (
        (payment.status === "refunded" || payment.status === "charged_back") &&
        order.status === "pagado"
    ) {
        changes.status = "cancelado";
    }

    return changes;

}

Deno.serve(async request => {

    if (request.method !== "POST") {
        return new Response("Método no permitido", { status: 405 });
    }

    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const type = url.searchParams.get("type") ?? body.type;
    const dataId = url.searchParams.get("data.id") ?? body.data?.id;

    if (type !== "payment" || !dataId) {
        return new Response("ok");
    }

    if (!(await isValidSignature(request, String(dataId)))) {

        console.error("Aviso con firma inválida");

        return new Response("Firma inválida", { status: 401 });

    }

    const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
        { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
    );

    // Las pruebas de Mercado Pago usan pagos que no existen.

    if (paymentResponse.status === 404) {
        return new Response("ok");
    }

    // Con error, Mercado Pago vuelve a enviar el aviso.

    if (!paymentResponse.ok) {

        console.error("Error al consultar el pago:", paymentResponse.status);

        return new Response("Error", { status: 500 });

    }

    const payment = await paymentResponse.json();
    const code = String(payment.external_reference ?? "");

    if (!/^[A-Z0-9]{8}$/.test(code)) {
        return new Response("ok");
    }

    const orderResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?code=eq.${code}&select=id,total,status`,
        { headers: dbHeaders }
    );

    if (!orderResponse.ok) {
        return new Response("Error", { status: 500 });
    }

    const [order] = await orderResponse.json();

    if (!order) {
        return new Response("ok");
    }

    const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`,
        {
            method: "PATCH",
            headers: dbHeaders,
            body: JSON.stringify(getOrderChanges(order, payment))
        }
    );

    if (!updateResponse.ok) {

        console.error("Error al actualizar el pedido:", updateResponse.status);

        return new Response("Error", { status: 500 });

    }

    return new Response("ok");

});
