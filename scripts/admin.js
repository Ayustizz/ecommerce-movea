"use strict";

// Ocultar pantallas acá es solo comodidad:
// la seguridad real está en los permisos de supabase/schema.sql.

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
const viewProducts = document.getElementById("view-products");
const viewOrders = document.getElementById("view-orders");

const productNew = document.getElementById("product-new");
const productForm = document.getElementById("product-form");
const productFormTitle = document.getElementById("product-form-title");
const productFormError = document.getElementById("product-form-error");
const productName = document.getElementById("product-name");
const productDescription = document.getElementById("product-description");
const productCategory = document.getElementById("product-category");
const productPrice = document.getElementById("product-price");
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


// ==========================================
// 3. ESTADO
// ==========================================

const config = window.MOVEA_SUPABASE;

const client = config && config.url && config.anonKey
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

let products = [];
let orders = [];
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
    orders = [];

    productsList.replaceChildren();
    ordersList.replaceChildren();

    closeProductForm();

    showScreen(adminLogin);

});


// ==========================================
// 6. PESTAÑAS
// ==========================================

function selectTab(tab) {

    const isProducts = tab === tabProducts;

    tabProducts.classList.toggle("active", isProducts);
    tabOrders.classList.toggle("active", !isProducts);

    tabProducts.setAttribute("aria-selected", String(isProducts));
    tabOrders.setAttribute("aria-selected", String(!isProducts));

    viewProducts.hidden = !isProducts;
    viewOrders.hidden = isProducts;

}

tabProducts.addEventListener("click", () => selectTab(tabProducts));
tabOrders.addEventListener("click", () => selectTab(tabOrders));


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

    renderProducts();

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

    if (!product.active) {
        badges.append(createText("span", "Oculto", "admin-badge admin-badge--off"));
    }

    info.append(
        createText("h2", product.name),
        createText("p", product.price > 0 ? formatPrice(product.price) : "Consultar precio", "admin-row__price"),
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
        productActive.checked = product.active;
        productFeatured.checked = product.featured;

    }

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
            featured: productFeatured.checked
        };

        if (newImageUrl) {
            values.image_url = newImageUrl;
        }

        const { error } = editingProduct
            ? await client.from("products").update(values).eq("id", editingProduct.id)
            : await client.from("products").insert({
                ...values,
                id: createProductId(values.name)
            });

        if (error) throw error;

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

        showError(adminMessage, "No se pudo cambiar el estado del pedido.");

        return;

    }

    order.status = status;

    renderOrders();

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
            createText("li", `${item.quantity}x ${item.name} - ${price}`)
        );

    });

    const footer = document.createElement("div");
    footer.className = "admin-order__footer";

    footer.append(
        createText("span", PAYMENT_NAMES[order.payment_method]),
        createText("strong", formatPrice(order.total))
    );

    card.append(
        header,
        items,
        createText("p", order.details, "admin-order__details")
    );

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


// ==========================================
// 11. INICIALIZAR
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
