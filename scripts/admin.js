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
    orders = [];

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
        [tabAccounts, viewAccounts]
    ].forEach(([item, view]) => {

        item.classList.toggle("active", item === tab);
        item.setAttribute("aria-selected", String(item === tab));

        view.hidden = item !== tab;

    });

    if (tab === tabAccounts) {
        loadAccounts();
    }

}

tabProducts.addEventListener("click", () => selectTab(tabProducts));
tabOrders.addEventListener("click", () => selectTab(tabOrders));
tabAccounts.addEventListener("click", () => selectTab(tabAccounts));


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

    await loadProductCosts();

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
        createText("p", getCostText(product), "admin-row__options"),
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
        productCost.value = productCosts.get(product.id) ?? "";
        productActive.checked = product.active;
        productFeatured.checked = product.featured;
        productColors.value = product.colors.join(", ");

        productSizes.forEach(input => {
            input.checked = product.sizes.includes(input.value);
        });

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
            sizes: Array.from(productSizes)
                .filter(input => input.checked)
                .map(input => input.value)
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

    if (order.details) {
        card.append(createText("p", order.details, "admin-order__details"));
    }

    if (order.status === "pendiente" && order.payment_method !== "entrega") {

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
// 12. INICIALIZAR
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
