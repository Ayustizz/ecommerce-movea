"use strict";

// Ocultar pantallas acá es solo comodidad:
// la seguridad real está en los permisos de supabase/schema.sql.

// El panel nunca se muestra dentro de otra página.

if (window.top !== window.self) {

    document.body.replaceChildren();

    throw new Error("Panel bloqueado dentro de un marco");

}


// ==========================================
// 1. CONFIGURACIÓN
// ==========================================

const IMAGE_BUCKET = "product-images";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ORDERS_LIMIT = 1000;

const siteRoot = new URL("../", location.href);

const STATUS_NAMES = {
    pendiente: "Pendiente",
    pagado: "Pagado",
    entregado: "Entregado",
    cancelado: "Cancelado"
};

const PAYMENT_NAMES = {
    "mercado-pago": "Mercado Pago",
    transferencia: "Transferencia bancaria",
    entrega: "Efectivo al recibir"
};

const EXPENSE_CATEGORY_NAMES = {
    envios: "Envíos",
    publicidad: "Publicidad",
    packaging: "Packaging",
    comisiones: "Comisiones",
    otros: "Otros"
};

const DELIVERY_NAMES = {
    encuentro: "Punto de encuentro",
    uber: "Envío por Uber"
};

const MP_STATUS_NAMES = {
    iniciado: "Esperando pago en Mercado Pago.",
    approved: "Pago aprobado por Mercado Pago.",
    rejected: "Mercado Pago rechazó el pago.",
    cancelled: "El pago se canceló en Mercado Pago.",
    refunded: "El pago se devolvió en Mercado Pago.",
    charged_back: "El cliente desconoció el pago en su tarjeta.",
    monto_incorrecto: "Atención: el importe pagado no coincide con el pedido."
};

const CATEGORY_NAMES = {
    buzos: "Buzos",
    joggers: "Joggers",
    tops: "Tops",
    shorts: "Shorts"
};


// ==========================================
// 2. ELEMENTOS DEL DOM
// ==========================================

const adminSetup = document.getElementById("admin-setup");
const adminLogin = document.getElementById("admin-login");
const adminPanel = document.getElementById("admin-panel");
const adminLogout = document.getElementById("admin-logout");
const adminMessage = document.getElementById("admin-message");

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginSubmit = document.getElementById("login-submit");

const tabProducts = document.getElementById("tab-products");
const tabOrders = document.getElementById("tab-orders");
const tabAccounts = document.getElementById("tab-accounts");
const tabBanners = document.getElementById("tab-banners");
const viewBanners = document.getElementById("view-banners");
const viewProducts = document.getElementById("view-products");
const viewOrders = document.getElementById("view-orders");
const viewAccounts = document.getElementById("view-accounts");

const productNew = document.getElementById("product-new");
const productForm = document.getElementById("product-form");
const productFormTitle = document.getElementById("product-form-title");
const productFormError = document.getElementById("product-form-error");
const productName = document.getElementById("product-name");
const productDescription = document.getElementById("product-description");
const productCategory = document.getElementById("product-category");
const productPrice = document.getElementById("product-price");
const productCost = document.getElementById("product-cost");
const productComparePrice = document.getElementById("product-compare-price");
const productTrackStock = document.getElementById("product-track-stock");
const productStockGrid = document.getElementById("product-stock-grid");
const productOffer = document.getElementById("product-offer");
const productColors = document.getElementById("product-colors");
const productSizes = document.querySelectorAll('input[name="productSize"]');
const productImage = document.getElementById("product-image");
const productImagePreview = document.getElementById("product-image-preview");
const productActive = document.getElementById("product-active");
const productFeatured = document.getElementById("product-featured");
const productCancel = document.getElementById("product-cancel");
const productSave = document.getElementById("product-save");
const productsList = document.getElementById("products-list");
const productsCount = document.getElementById("products-count");

const ordersFilter = document.getElementById("orders-filter");
const ordersList = document.getElementById("orders-list");
const ordersCount = document.getElementById("orders-count");
const statMonth = document.getElementById("stat-month");
const statPending = document.getElementById("stat-pending");
const statCount = document.getElementById("stat-count");

const ordersExport = document.getElementById("orders-export");
const expensesExport = document.getElementById("expenses-export");

const bannerForm = document.getElementById("banner-form");
const bannerImage = document.getElementById("banner-image");
const bannerAlt = document.getElementById("banner-alt");
const bannerError = document.getElementById("banner-error");
const bannerSave = document.getElementById("banner-save");
const bannersList = document.getElementById("banners-list");

const accountsMonth = document.getElementById("accounts-month");
const accountIncome = document.getElementById("account-income");
const accountCost = document.getElementById("account-cost");
const accountExpenses = document.getElementById("account-expenses");
const accountProfit = document.getElementById("account-profit");
const accountProfitCard = document.getElementById("account-profit-card");
const accountMargin = document.getElementById("account-margin");
const accountWarning = document.getElementById("account-warning");
const accountProducts = document.getElementById("account-products");

const expenseForm = document.getElementById("expense-form");
const expenseConcept = document.getElementById("expense-concept");
const expenseCategory = document.getElementById("expense-category");
const expenseAmount = document.getElementById("expense-amount");
const expenseDate = document.getElementById("expense-date");
const expenseError = document.getElementById("expense-error");
const expenseSave = document.getElementById("expense-save");
const expensesList = document.getElementById("expenses-list");


// ==========================================
// 3. ESTADO
// ==========================================

const config = window.MOVEA_SUPABASE;

const client = config && config.url && config.anonKey
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

let products = [];
let productCosts = new Map();
let productStock = new Map();
let orders = [];
let banners = [];
let monthExpenses = [];
let editingProduct = null;


// ==========================================
// 4. UTILIDADES
// ==========================================

function formatPrice(price) {

    return price.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    });

}

function formatDate(value) {

    return new Date(value).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short"
    });

}

function showError(element, text) {

    element.textContent = text;
    element.hidden = !text;

}

function createButton(text, className, onClick) {

    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.textContent = text;
    button.addEventListener("click", onClick);

    return button;

}

function createText(tag, text, className) {

    const element = document.createElement(tag);

    element.textContent = text;

    if (className) {
        element.className = className;
    }

    return element;

}

function createProductId(name) {

    const slug = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return `${slug || "producto"}-${Date.now().toString(36)}`;

}

function parseColors(value) {

    const colors = value
        .split(",")
        .map(color => color.trim().replace(/\|/g, ""))
        .filter(Boolean);

    return [...new Set(colors)];

}

function getPhoneChatUrl(phone) {

    const digits = phone.replace(/\D/g, "").replace(/^0/, "");

    return `https://wa.me/${digits.startsWith("54") ? digits : `549${digits}`}`;

}

function getVariantText(item) {

    const variant = [
        item.size && `Talle ${item.size}`,
        item.color
    ].filter(Boolean).join(", ");

    return variant ? ` (${variant})` : "";

}

function getStorageFilePath(imageUrl) {

    const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
    const position = imageUrl.indexOf(marker);

    return position === -1
        ? null
        : decodeURIComponent(imageUrl.slice(position + marker.length));

}


// ==========================================
// 5. SESIÓN
// ==========================================

function showScreen(screen) {

    adminSetup.hidden = screen !== adminSetup;
    adminLogin.hidden = screen !== adminLogin;
    adminPanel.hidden = screen !== adminPanel;

    adminLogout.hidden = screen !== adminPanel;

}

async function isCurrentUserAdmin(userId) {

    const { data, error } = await client
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

    return !error && Boolean(data);

}

async function openPanelForUser(user) {

    if (!(await isCurrentUserAdmin(user.id))) {

        await client.auth.signOut();

        showScreen(adminLogin);

        showError(loginError, "Esta cuenta no tiene permisos de administración.");

        return;

    }

    showScreen(adminPanel);

    await Promise.all([loadProducts(), loadOrders()]);

}

loginForm.addEventListener("submit", async event => {

    event.preventDefault();

    showError(loginError, "");

    loginSubmit.disabled = true;

    const { data, error } = await client.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginPassword.value
    });

    loginSubmit.disabled = false;
    loginPassword.value = "";

    if (error) {

        showError(loginError, "Email o contraseña incorrectos.");

        return;

    }

    await openPanelForUser(data.user);

});

adminLogout.addEventListener("click", async () => {

    await client.auth.signOut();

    products = [];
    productCosts = new Map();
    productStock = new Map();
    orders = [];
    banners = [];
    monthExpenses = [];

    bannersList.replaceChildren();
    productsList.replaceChildren();
    ordersList.replaceChildren();
    accountProducts.replaceChildren();
    expensesList.replaceChildren();

    selectTab(tabProducts);

    closeProductForm();

    showScreen(adminLogin);

});


// ==========================================
// 6. PESTAÑAS
// ==========================================

function selectTab(tab) {

    [
        [tabProducts, viewProducts],
        [tabOrders, viewOrders],
        [tabAccounts, viewAccounts],
        [tabBanners, viewBanners]
    ].forEach(([item, view]) => {

        item.classList.toggle("active", item === tab);
        item.setAttribute("aria-selected", String(item === tab));

        view.hidden = item !== tab;

    });

    if (tab === tabAccounts) {
        loadAccounts();
    }

    if (tab === tabBanners) {
        loadBanners();
    }

}

tabProducts.addEventListener("click", () => selectTab(tabProducts));
tabOrders.addEventListener("click", () => selectTab(tabOrders));
tabAccounts.addEventListener("click", () => selectTab(tabAccounts));
tabBanners.addEventListener("click", () => selectTab(tabBanners));


// ==========================================
// 7. PRODUCTOS: LISTADO
// ==========================================

async function loadProducts() {

    const { data, error } = await client
        .from("products")
        .select("*")
        .order("sort_order")
        .order("created_at");

    if (error) {

        console.error("Error al cargar productos:", error);

        showError(adminMessage, "No se pudieron cargar los productos.");

        return;

    }

    products = data;

    await Promise.all([loadProductCosts(), loadProductStock()]);

    renderProducts();

}

async function loadProductCosts() {

    const { data, error } = await client
        .from("product_costs")
        .select("product_id, cost");

    if (error) {

        console.error("Error al cargar costos:", error);

        showError(adminMessage, "No se pudieron cargar los costos.");

        return;

    }

    productCosts = new Map(data.map(item => [item.product_id, item.cost]));

}

async function loadProductStock() {

    const { data, error } = await client
        .from("product_stock")
        .select("*");

    if (error) {

        console.error("Error al cargar el stock:", error);

        showError(adminMessage, "No se pudo cargar el stock.");

        return;

    }

    productStock = new Map();

    data.forEach(item => {

        const rows = productStock.get(item.product_id) ?? [];

        rows.push(item);

        productStock.set(item.product_id, rows);

    });

}

function getStockText(product) {

    if (!product.track_stock) return "Sin control de stock";

    const total = (productStock.get(product.id) ?? [])
        .reduce((sum, item) => sum + item.quantity, 0);

    return total === 0 ? "Agotado" : `Stock: ${total}`;

}

function getCostText(product) {

    const cost = productCosts.get(product.id);

    if (cost === undefined) return "Sin costo cargado";

    if (product.price === 0) return `Costo: ${formatPrice(cost)}`;

    const margin = Math.round((product.price - cost) / product.price * 100);

    return `Costo: ${formatPrice(cost)} · Margen: ${margin}%`;

}

function createProductRow(product) {

    const row = document.createElement("article");
    row.className = "admin-row";

    const image = document.createElement("img");
    image.className = "admin-row__image";
    image.src = new URL(product.image_url, siteRoot).href;
    image.alt = "";

    const info = document.createElement("div");
    info.className = "admin-row__info";

    const badges = document.createElement("div");
    badges.className = "admin-badges";

    badges.append(
        createText("span", CATEGORY_NAMES[product.category], "admin-badge")
    );

    if (product.featured) {
        badges.append(createText("span", "Destacado", "admin-badge"));
    }

    if (product.on_offer) {
        badges.append(createText("span", "Oferta", "admin-badge"));
    }

    if (!product.active) {
        badges.append(createText("span", "Oculto", "admin-badge admin-badge--off"));
    }

    const options = [
        product.sizes.length > 0 && `Talles: ${product.sizes.join(", ")}`,
        product.colors.length > 0 && `Colores: ${product.colors.join(", ")}`
    ].filter(Boolean).join(" · ");

    info.append(
        createText("h2", product.name),
        createText("p", product.price > 0 ? formatPrice(product.price) : "Consultar precio", "admin-row__price"),
        createText("p", options, "admin-row__options"),
        createText("p", `${getStockText(product)} · ${getCostText(product)}`, "admin-row__options"),
        badges
    );

    const actions = document.createElement("div");
    actions.className = "admin-row__actions";

    const deleteButton = createButton("Eliminar", "admin-link admin-link--danger", () => {

        // Primer clic: pide confirmación. Segundo clic: elimina.

        if (deleteButton.dataset.confirm) {

            deleteProduct(product);

            return;

        }

        deleteButton.dataset.confirm = "true";
        deleteButton.textContent = "¿Confirmar?";

    });

    actions.append(
        createButton("Editar", "admin-link", () => openProductForm(product)),
        createButton(product.active ? "Ocultar" : "Mostrar", "admin-link", () => toggleProduct(product)),
        deleteButton
    );

    row.append(image, info, actions);

    return row;

}

function renderProducts() {

    productsList.replaceChildren(...products.map(createProductRow));

    productsCount.textContent =
        `${products.length} ${products.length === 1 ? "producto" : "productos"}`;

}


// ==========================================
// 8. PRODUCTOS: FORMULARIO
// ==========================================

function getSelectedSizes() {

    return Array.from(productSizes)
        .filter(input => input.checked)
        .map(input => input.value);

}

function renderStockGrid() {

    // Conserva lo que ya estaba escrito al cambiar talles o colores.

    const typed = new Map(
        Array.from(productStockGrid.querySelectorAll("input"), input => {
            return [`${input.dataset.size}|${input.dataset.color}`, input.value];
        })
    );

    const saved = editingProduct
        ? productStock.get(editingProduct.id) ?? []
        : [];

    const sizes = getSelectedSizes();
    const colors = parseColors(productColors.value);

    const combinations = (sizes.length ? sizes : [""]).flatMap(size => {
        return (colors.length ? colors : [""]).map(color => ({ size, color }));
    });

    productStockGrid.hidden = !productTrackStock.checked;

    productStockGrid.replaceChildren(...combinations.map(({ size, color }) => {

        const key = `${size}|${color}`;

        const label = document.createElement("label");
        const input = document.createElement("input");

        const savedRow = saved.find(item => {
            return item.size === size && item.color === color;
        });

        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.inputMode = "numeric";
        input.required = true;
        input.dataset.size = size;
        input.dataset.color = color;
        input.value = typed.get(key) ?? savedRow?.quantity ?? 0;

        label.append(
            createText("span", [size, color].filter(Boolean).join(" · ") || "Cantidad"),
            input
        );

        return label;

    }));

}

async function saveProductStock(productId) {

    const existing = productStock.get(productId) ?? [];

    if (!productTrackStock.checked) {

        const { error } = await client
            .from("product_stock")
            .delete()
            .eq("product_id", productId);

        if (error) throw error;

        return;

    }

    const rows = Array.from(productStockGrid.querySelectorAll("input"), input => ({
        product_id: productId,
        size: input.dataset.size,
        color: input.dataset.color,
        quantity: Number(input.value)
    }));

    const { error } = await client.from("product_stock").upsert(rows);

    if (error) throw error;

    const removed = existing.filter(item => {

        return !rows.some(row => {
            return row.size === item.size && row.color === item.color;
        });

    });

    for (const item of removed) {

        const { error: deleteError } = await client
            .from("product_stock")
            .delete()
            .eq("product_id", productId)
            .eq("size", item.size)
            .eq("color", item.color);

        if (deleteError) throw deleteError;

    }

}

productTrackStock.addEventListener("change", renderStockGrid);
productColors.addEventListener("input", renderStockGrid);

productSizes.forEach(input => {
    input.addEventListener("change", renderStockGrid);
});

function openProductForm(product = null) {

    editingProduct = product;

    productForm.reset();

    showError(productFormError, "");

    productFormTitle.textContent = product ? "Editar producto" : "Nuevo producto";

    if (product) {

        productName.value = product.name;
        productDescription.value = product.description;
        productCategory.value = product.category;
        productPrice.value = product.price;
        productCost.value = productCosts.get(product.id) ?? "";
        productActive.checked = product.active;
        productFeatured.checked = product.featured;
        productColors.value = product.colors.join(", ");
        productOffer.checked = product.on_offer;
        productComparePrice.value = product.compare_price ?? "";
        productTrackStock.checked = product.track_stock;

        productSizes.forEach(input => {
            input.checked = product.sizes.includes(input.value);
        });

    }

    productStockGrid.replaceChildren();

    renderStockGrid();

    productImagePreview.hidden = !product || !product.image_url;

    if (!productImagePreview.hidden) {
        productImagePreview.src = new URL(product.image_url, siteRoot).href;
    }

    productForm.hidden = false;

    productName.focus();

}

function closeProductForm() {

    editingProduct = null;

    productForm.hidden = true;

}

async function saveProductCost(productId) {

    const { error } = productCost.value === ""
        ? await client.from("product_costs").delete().eq("product_id", productId)
        : await client.from("product_costs").upsert({
            product_id: productId,
            cost: Number(productCost.value)
        });

    if (error) throw error;

}

async function uploadProductImage(file) {

    const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    }[file.type];

    const path = `${crypto.randomUUID()}.${extension}`;

    const { error } = await client.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type });

    if (error) throw error;

    return client.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;

}

async function removeStoredImage(imageUrl) {

    const path = getStorageFilePath(imageUrl);

    if (!path) return;

    const { error } = await client.storage.from(IMAGE_BUCKET).remove([path]);

    if (error) {
        console.error("No se pudo borrar la foto:", error);
    }

}

productForm.addEventListener("submit", async event => {

    event.preventDefault();

    showError(productFormError, "");

    const file = productImage.files[0];

    if (file && !IMAGE_TYPES.includes(file.type)) {

        showError(productFormError, "La foto debe ser JPG, PNG o WebP.");

        return;

    }

    if (file && file.size > MAX_IMAGE_SIZE) {

        showError(productFormError, "La foto no puede superar los 5 MB.");

        return;

    }

    if (!file && !editingProduct) {

        showError(productFormError, "Agregá una foto del producto.");

        return;

    }

    productSave.disabled = true;

    let newImageUrl = null;

    try {

        if (file) {
            newImageUrl = await uploadProductImage(file);
        }

        const values = {
            name: productName.value.trim(),
            description: productDescription.value.trim(),
            category: productCategory.value,
            price: Number(productPrice.value),
            active: productActive.checked,
            featured: productFeatured.checked,
            colors: parseColors(productColors.value),
            sizes: getSelectedSizes(),
            on_offer: productOffer.checked,
            compare_price: productComparePrice.value === ""
                ? null
                : Number(productComparePrice.value),
            track_stock: productTrackStock.checked
        };

        if (newImageUrl) {
            values.image_url = newImageUrl;
        }

        const productId = editingProduct
            ? editingProduct.id
            : createProductId(values.name);

        const { error } = editingProduct
            ? await client.from("products").update(values).eq("id", productId)
            : await client.from("products").insert({ ...values, id: productId });

        if (error) throw error;

        await saveProductCost(productId);
        await saveProductStock(productId);

        if (newImageUrl && editingProduct) {
            await removeStoredImage(editingProduct.image_url);
        }

        closeProductForm();

        await loadProducts();

    } catch (error) {

        console.error("Error al guardar el producto:", error);

        if (newImageUrl) {
            await removeStoredImage(newImageUrl);
        }

        showError(productFormError, "No se pudo guardar el producto. Probá de nuevo.");

    } finally {

        productSave.disabled = false;

    }

});

productNew.addEventListener("click", () => openProductForm());
productCancel.addEventListener("click", closeProductForm);


// ==========================================
// 9. PRODUCTOS: ACCIONES
// ==========================================

async function toggleProduct(product) {

    const { error } = await client
        .from("products")
        .update({ active: !product.active })
        .eq("id", product.id);

    if (error) {

        console.error("Error al cambiar la visibilidad:", error);

        showError(adminMessage, "No se pudo actualizar el producto.");

        return;

    }

    await loadProducts();

}

async function deleteProduct(product) {

    const { error } = await client
        .from("products")
        .delete()
        .eq("id", product.id);

    if (error) {

        console.error("Error al eliminar el producto:", error);

        showError(adminMessage, "No se pudo eliminar el producto.");

        return;

    }

    await removeStoredImage(product.image_url);

    if (editingProduct && editingProduct.id === product.id) {
        closeProductForm();
    }

    await loadProducts();

}


// ==========================================
// 10. VENTAS
// ==========================================

async function loadOrders() {

    const { data, error } = await client
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(ORDERS_LIMIT);

    if (error) {

        console.error("Error al cargar ventas:", error);

        showError(adminMessage, "No se pudieron cargar las ventas.");

        return;

    }

    orders = data;

    renderOrders();

}

function updateStats() {

    const now = new Date();

    const monthSales = orders.filter(order => {

        const date = new Date(order.created_at);

        return (
            (order.status === "pagado" || order.status === "entregado") &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
        );

    });

    const monthTotal = monthSales.reduce((total, order) => {
        return total + order.total;
    }, 0);

    statMonth.textContent = formatPrice(monthTotal);
    statCount.textContent = monthSales.length;

    statPending.textContent = orders.filter(order => {
        return order.status === "pendiente";
    }).length;

}

async function changeOrderStatus(order, status, select) {

    const { error } = await client
        .from("orders")
        .update({ status })
        .eq("id", order.id);

    if (error) {

        console.error("Error al cambiar el estado:", error);

        select.value = order.status;

        showError(
            adminMessage,
            /Sin stock/.test(error.message)
                ? "No hay stock suficiente para reactivar este pedido."
                : "No se pudo cambiar el estado del pedido."
        );

        return;

    }

    order.status = status;

    renderOrders();

    // Cancelar o reactivar cambia el stock.

    await loadProducts();

}

function createOrderCard(order) {

    const card = document.createElement("article");
    card.className = `admin-order admin-order--${order.status}`;

    const header = document.createElement("div");
    header.className = "admin-order__header";

    const heading = document.createElement("div");

    heading.append(
        createText("h2", `Pedido ${order.code}`),
        createText("p", `${formatDate(order.created_at)} · ${order.customer_name}`)
    );

    if (order.customer_phone) {

        const phone = createText("a", order.customer_phone, "admin-order__phone");

        phone.href = getPhoneChatUrl(order.customer_phone);
        phone.target = "_blank";
        phone.rel = "noopener noreferrer";

        heading.append(phone);

    }

    const select = document.createElement("select");

    select.className = "admin-order__status";
    select.setAttribute("aria-label", `Estado del pedido ${order.code}`);

    Object.entries(STATUS_NAMES).forEach(([value, name]) => {
        select.add(new Option(name, value));
    });

    select.value = order.status;

    select.addEventListener("change", () => {
        changeOrderStatus(order, select.value, select);
    });

    header.append(heading, select);

    const items = document.createElement("ul");
    items.className = "admin-order__items";

    order.order_items.forEach(item => {

        const price = item.unit_price > 0
            ? formatPrice(item.unit_price * item.quantity)
            : "Precio a confirmar";

        items.append(
            createText("li", `${item.quantity}x ${item.name}${getVariantText(item)} - ${price}`)
        );

    });

    const footer = document.createElement("div");
    footer.className = "admin-order__footer";

    footer.append(
        createText("span", PAYMENT_NAMES[order.payment_method]),
        createText("strong", formatPrice(order.total))
    );

    card.append(header, items);

    if (order.delivery_method) {

        card.append(createText(
            "p",
            `${DELIVERY_NAMES[order.delivery_method]}: ${order.delivery_zone}`,
            "admin-order__delivery"
        ));

    }

    if (order.details) {
        card.append(createText("p", order.details, "admin-order__details"));
    }

    if (order.mp_status) {

        const operation = order.mp_payment_id
            ? ` Operación ${order.mp_payment_id}.`
            : "";

        card.append(
            createText(
                "p",
                `${MP_STATUS_NAMES[order.mp_status] ?? order.mp_status}${operation}`,
                "cart-pending"
            )
        );

    } else if (order.status === "pendiente" && order.payment_method !== "entrega") {

        card.append(
            createText("p", "Esperando comprobante de pago.", "cart-pending")
        );

    }

    if (order.has_pending_prices) {

        card.append(
            createText("p", "Tiene productos con precio a confirmar.", "cart-pending")
        );

    }

    card.append(footer);

    return card;

}

function renderOrders() {

    updateStats();

    const status = ordersFilter.value;

    const visibleOrders = status
        ? orders.filter(order => order.status === status)
        : orders;

    ordersList.replaceChildren(...visibleOrders.map(createOrderCard));

    if (visibleOrders.length === 0) {
        ordersList.append(createText("p", "No hay pedidos para mostrar.", "product-filter__empty"));
    }

    ordersCount.textContent =
        `${visibleOrders.length} ${visibleOrders.length === 1 ? "pedido" : "pedidos"}`;

}

ordersFilter.addEventListener("change", renderOrders);


// Descargas para Excel

function toCsvCell(value) {

    const text = String(value ?? "");

    // Evita que Excel ejecute como fórmula lo que escribió un cliente.

    const safeText = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

    return `"${safeText.replace(/"/g, '""')}"`;

}

function downloadCsv(fileName, rows) {

    const content = rows
        .map(row => row.map(toCsvCell).join(";"))
        .join("\r\n");

    const file = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });

    const link = document.createElement("a");

    link.href = URL.createObjectURL(file);
    link.download = fileName;

    link.click();

    URL.revokeObjectURL(link.href);

}

ordersExport.addEventListener("click", () => {

    downloadCsv("ventas-movea.csv", [
        ["Pedido", "Fecha", "Cliente", "Teléfono", "Productos", "Entrega", "Zona", "Pago", "Estado", "Total"],
        ...orders.map(order => [
            order.code,
            formatDate(order.created_at),
            order.customer_name,
            order.customer_phone,
            order.order_items
                .map(item => `${item.quantity}x ${item.name}${getVariantText(item)}`)
                .join(", "),
            DELIVERY_NAMES[order.delivery_method] ?? "",
            order.delivery_zone,
            PAYMENT_NAMES[order.payment_method],
            STATUS_NAMES[order.status],
            order.total
        ])
    ]);

});

expensesExport.addEventListener("click", () => {

    downloadCsv(`gastos-movea-${accountsMonth.value}.csv`, [
        ["Fecha", "Concepto", "Categoría", "Importe"],
        ...monthExpenses.map(expense => [
            expense.spent_on,
            expense.concept,
            EXPENSE_CATEGORY_NAMES[expense.category],
            expense.amount
        ])
    ]);

});


// ==========================================
// 11. CUENTAS
// ==========================================

function getCurrentMonth() {

    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

}

function getToday() {

    const now = new Date();

    return `${getCurrentMonth()}-${String(now.getDate()).padStart(2, "0")}`;

}

function getMonthRange(month) {

    const [year, monthNumber] = month.split("-").map(Number);

    const end = new Date(year, monthNumber, 1);

    return {
        start: new Date(year, monthNumber - 1, 1),
        end,
        firstDay: `${month}-01`,
        nextMonth: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-01`
    };

}

function summarizeSales(sales) {

    const summary = {
        income: 0,
        cost: 0,
        itemsWithoutCost: 0,
        byProduct: new Map()
    };

    sales.forEach(order => {

        // El descuento se reparte entre los productos del pedido.

        const paidShare = order.subtotal > 0
            ? order.total / order.subtotal
            : 1;

        summary.income += order.total;

        order.order_items.forEach(item => {

            // Pedidos anteriores a cargar costos: se usa el costo actual.

            const unitCost = item.unit_cost ?? productCosts.get(item.product_id);

            const row = summary.byProduct.get(item.name) || {
                name: item.name,
                units: 0,
                income: 0,
                cost: 0
            };

            row.units += item.quantity;
            row.income += item.unit_price * item.quantity * paidShare;

            if (unitCost === undefined) {

                summary.itemsWithoutCost += item.quantity;

            } else {

                row.cost += unitCost * item.quantity;
                summary.cost += unitCost * item.quantity;

            }

            summary.byProduct.set(item.name, row);

        });

    });

    return summary;

}

function createProductAccountRow(row) {

    const tableRow = document.createElement("tr");

    tableRow.append(
        createText("th", row.name),
        createText("td", row.units),
        createText("td", formatPrice(Math.round(row.income))),
        createText("td", formatPrice(row.cost)),
        createText("td", formatPrice(Math.round(row.income - row.cost)))
    );

    tableRow.firstChild.scope = "row";

    return tableRow;

}

function createExpenseRow(expense) {

    const row = document.createElement("article");
    row.className = "admin-expense";

    const info = document.createElement("div");

    const date = new Date(`${expense.spent_on}T12:00:00`);

    info.append(
        createText("h3", expense.concept),
        createText("p", `${date.toLocaleDateString("es-AR")} · ${EXPENSE_CATEGORY_NAMES[expense.category]}`)
    );

    const deleteButton = createButton("Eliminar", "admin-link admin-link--danger", () => {

        if (deleteButton.dataset.confirm) {

            deleteExpense(expense);

            return;

        }

        deleteButton.dataset.confirm = "true";
        deleteButton.textContent = "¿Confirmar?";

    });

    row.append(
        info,
        createText("strong", formatPrice(expense.amount)),
        deleteButton
    );

    return row;

}

function renderAccounts(summary, expenses) {

    const expensesTotal = expenses.reduce((total, expense) => {
        return total + expense.amount;
    }, 0);

    const profit = summary.income - summary.cost - expensesTotal;

    accountIncome.textContent = formatPrice(summary.income);
    accountCost.textContent = formatPrice(summary.cost);
    accountExpenses.textContent = formatPrice(expensesTotal);
    accountProfit.textContent = formatPrice(profit);

    accountProfitCard.classList.toggle("admin-stat--loss", profit < 0);

    accountMargin.textContent = summary.income > 0
        ? `${Math.round(profit / summary.income * 100)}% de los ingresos`
        : "";

    accountWarning.textContent =
        `${summary.itemsWithoutCost} ${summary.itemsWithoutCost === 1 ? "unidad vendida no tiene" : "unidades vendidas no tienen"} costo cargado: la ganancia real es menor a la que se muestra.`;

    accountWarning.hidden = summary.itemsWithoutCost === 0;

    const rows = [...summary.byProduct.values()]
        .sort((a, b) => (b.income - b.cost) - (a.income - a.cost));

    accountProducts.replaceChildren(...rows.map(createProductAccountRow));

    if (rows.length === 0) {

        const emptyRow = document.createElement("tr");
        const emptyCell = createText("td", "No hay ventas cobradas en este mes.");

        emptyCell.colSpan = 5;

        emptyRow.append(emptyCell);
        accountProducts.append(emptyRow);

    }

    expensesList.replaceChildren(...expenses.map(createExpenseRow));

    if (expenses.length === 0) {
        expensesList.append(createText("p", "No hay gastos en este mes.", "product-filter__empty"));
    }

}

async function loadAccounts() {

    const month = accountsMonth.value;

    if (!month) return;

    showError(adminMessage, "");

    const range = getMonthRange(month);

    const [sales, expenses] = await Promise.all([
        client
            .from("orders")
            .select("subtotal, total, order_items(product_id, name, unit_price, unit_cost, quantity)")
            .in("status", ["pagado", "entregado"])
            .gte("created_at", range.start.toISOString())
            .lt("created_at", range.end.toISOString()),
        client
            .from("expenses")
            .select("*")
            .gte("spent_on", range.firstDay)
            .lt("spent_on", range.nextMonth)
            .order("spent_on", { ascending: false })
    ]);

    // Si cambió el mes mientras cargaba, vale la consulta nueva.

    if (accountsMonth.value !== month) return;

    if (sales.error || expenses.error) {

        console.error("Error al cargar cuentas:", sales.error || expenses.error);

        showError(adminMessage, "No se pudieron cargar las cuentas.");

        return;

    }

    monthExpenses = expenses.data;

    renderAccounts(summarizeSales(sales.data), expenses.data);

}

async function deleteExpense(expense) {

    const { error } = await client
        .from("expenses")
        .delete()
        .eq("id", expense.id);

    if (error) {

        console.error("Error al eliminar el gasto:", error);

        showError(adminMessage, "No se pudo eliminar el gasto.");

        return;

    }

    await loadAccounts();

}

expenseForm.addEventListener("submit", async event => {

    event.preventDefault();

    showError(expenseError, "");

    expenseSave.disabled = true;

    const { error } = await client.from("expenses").insert({
        concept: expenseConcept.value.trim(),
        category: expenseCategory.value,
        amount: Number(expenseAmount.value),
        spent_on: expenseDate.value
    });

    expenseSave.disabled = false;

    if (error) {

        console.error("Error al guardar el gasto:", error);

        showError(expenseError, "No se pudo guardar el gasto. Probá de nuevo.");

        return;

    }

    expenseConcept.value = "";
    expenseAmount.value = "";

    await loadAccounts();

});

accountsMonth.addEventListener("change", loadAccounts);

accountsMonth.value = getCurrentMonth();
expenseDate.value = getToday();


// ==========================================
// 12. BANNERS
// ==========================================

async function loadBanners() {

    const { data, error } = await client
        .from("banners")
        .select("*")
        .order("sort_order")
        .order("created_at");

    if (error) {

        console.error("Error al cargar banners:", error);

        showError(adminMessage, "No se pudieron cargar los banners.");

        return;

    }

    banners = data;

    renderBanners();

}

async function updateBanner(banner, values) {

    const { error } = await client
        .from("banners")
        .update(values)
        .eq("id", banner.id);

    if (error) {

        console.error("Error al actualizar el banner:", error);

        showError(adminMessage, "No se pudo actualizar el banner.");

    }

    return !error;

}

async function moveBanner(banner, direction) {

    const position = banners.indexOf(banner);
    const other = banners[position + direction];

    if (!other) return;

    // Se reenumera todo: los banners nuevos comparten el mismo orden.

    const ordered = [...banners];

    ordered[position] = other;
    ordered[position + direction] = banner;

    await Promise.all(ordered.map((item, index) => {
        return updateBanner(item, { sort_order: index + 1 });
    }));

    await loadBanners();

}

async function deleteBanner(banner) {

    const { error } = await client
        .from("banners")
        .delete()
        .eq("id", banner.id);

    if (error) {

        console.error("Error al eliminar el banner:", error);

        showError(adminMessage, "No se pudo eliminar el banner.");

        return;

    }

    await removeStoredImage(banner.image_url);
    await loadBanners();

}

function createBannerRow(banner, index) {

    const row = document.createElement("article");
    row.className = "admin-banner";

    const image = document.createElement("img");

    image.src = new URL(banner.image_url, siteRoot).href;
    image.alt = "";

    const info = document.createElement("div");
    info.className = "admin-row__info";

    info.append(createText("h2", banner.alt));

    if (!banner.active) {
        info.append(createText("span", "Oculto", "admin-badge admin-badge--off"));
    }

    const actions = document.createElement("div");
    actions.className = "admin-row__actions";

    const upButton = createButton("Subir", "admin-link", () => moveBanner(banner, -1));
    const downButton = createButton("Bajar", "admin-link", () => moveBanner(banner, 1));

    upButton.disabled = index === 0;
    downButton.disabled = index === banners.length - 1;

    const deleteButton = createButton("Eliminar", "admin-link admin-link--danger", () => {

        if (deleteButton.dataset.confirm) {

            deleteBanner(banner);

            return;

        }

        deleteButton.dataset.confirm = "true";
        deleteButton.textContent = "¿Confirmar?";

    });

    actions.append(
        upButton,
        downButton,
        createButton(banner.active ? "Ocultar" : "Mostrar", "admin-link", async () => {

            await updateBanner(banner, { active: !banner.active });
            await loadBanners();

        }),
        deleteButton
    );

    row.append(image, info, actions);

    return row;

}

function renderBanners() {

    bannersList.replaceChildren(...banners.map(createBannerRow));

    if (banners.length === 0) {

        bannersList.append(
            createText("p", "No hay banners. La tienda muestra los que vienen por defecto.", "product-filter__empty")
        );

    }

}

bannerForm.addEventListener("submit", async event => {

    event.preventDefault();

    showError(bannerError, "");

    const file = bannerImage.files[0];

    if (!IMAGE_TYPES.includes(file.type)) {

        showError(bannerError, "La imagen debe ser JPG, PNG o WebP.");

        return;

    }

    if (file.size > MAX_IMAGE_SIZE) {

        showError(bannerError, "La imagen no puede superar los 5 MB.");

        return;

    }

    bannerSave.disabled = true;

    let imageUrl = null;

    try {

        imageUrl = await uploadProductImage(file);

        const { error } = await client.from("banners").insert({
            image_url: imageUrl,
            alt: bannerAlt.value.trim(),
            sort_order: banners.length + 1
        });

        if (error) throw error;

        bannerForm.reset();

        await loadBanners();

    } catch (error) {

        console.error("Error al guardar el banner:", error);

        if (imageUrl) {
            await removeStoredImage(imageUrl);
        }

        showError(bannerError, "No se pudo guardar el banner. Probá de nuevo.");

    } finally {

        bannerSave.disabled = false;

    }

});


// ==========================================
// 13. INICIALIZAR
// ==========================================

async function init() {

    if (!client) {

        showScreen(adminSetup);

        return;

    }

    const { data } = await client.auth.getSession();

    if (data.session) {

        await openPanelForUser(data.session.user);

    } else {

        showScreen(adminLogin);

    }

}

init();
