const BASE = "/api";

async function request(method, path, body = null) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" }
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        if (Array.isArray(err.detail)) {
            throw new Error(err.detail.map(e => e.msg).join(", "));
        }
        throw new Error(err.detail || "Request failed");
    }
    return res.json();
}

// ── Inventory ──────────────────────────────────────────────
export const getInventory        = ()       => request("GET", "/inventory");
export const getNextSkuId        = ()       => request("GET", "/inventory/next-id");
export const addInventory        = (data)   => request("POST", "/inventory", data);
export const updateInventoryItem = (id, data) => request("PUT",  `/inventory/${id}`, data);
export const deleteInventoryItem = (id)     => request("DELETE", `/inventory/${id}`);

export const searchInventory = (params) => {
    const q = new URLSearchParams();
    if (params.sku_type)       q.set("sku_type",       params.sku_type);
    if (params.sku_subtype)    q.set("sku_subtype",    params.sku_subtype);
    if (params.sku_dim)        q.set("sku_dim",        params.sku_dim);
    if (params.tracking_id)    q.set("tracking_id",    params.tracking_id);
    if (params.cost_price_min) q.set("cost_price_min", params.cost_price_min);
    if (params.cost_price_max) q.set("cost_price_max", params.cost_price_max);
    if (params.date_from)      q.set("date_from",      params.date_from);
    if (params.date_to)        q.set("date_to",        params.date_to);
    return request("GET", `/inventory/search?${q}`);
};

export const getInventorySummary = (params = {}) => {
    const q = new URLSearchParams();
    if (params.sku_type)       q.set("sku_type",       params.sku_type);
    if (params.sku_subtype)    q.set("sku_subtype",    params.sku_subtype);
    if (params.sku_dim)        q.set("sku_dim",        params.sku_dim);
    if (params.tracking_id)    q.set("tracking_id",    params.tracking_id);
    if (params.cost_price_min) q.set("cost_price_min", params.cost_price_min);
    if (params.cost_price_max) q.set("cost_price_max", params.cost_price_max);
    if (params.date_from)      q.set("date_from",      params.date_from);
    if (params.date_to)        q.set("date_to",        params.date_to);
    return request("GET", `/inventory/summary?${q}`);
};

export const checkAvailability = (sku_type, sku_subtype, sku_dim) => {
    const q = new URLSearchParams({ sku_type, sku_subtype, sku_dim });
    return request("GET", `/inventory/available?${q}`);
};

// ── Customers ──────────────────────────────────────────────
export const getCustomers    = ()         => request("GET",    "/customers");
export const addCustomer     = (data)     => request("POST",   "/customers", data);
export const updateCustomer  = (id, data) => request("PUT",    `/customers/${id}`, data);
export const deleteCustomer  = (id)       => request("DELETE", `/customers/${id}`);
export const getShippingAddresses = (id)  => request("GET",    `/customers/${id}/shipping-addresses`);
export const updateShippingAddresses = (id, addrs) => request("PUT", `/customers/${id}/shipping-addresses`, addrs);

// ── Orders ─────────────────────────────────────────────────
export const placeOrder = (data) => request("POST", "/orders", data);

// ── Orders (extended) ──────────────────────────────────────
export const getOrders      = ()         => request("GET", "/orders");
export const getOrderFull   = (id)       => request("GET", `/orders/${id}`);

export const deleteOrder    = (id)       => request("DELETE", `/orders/${id}`);
export const getOrderItems  = (id)       => request("GET", `/orders/${id}/items`);

// ── Product Master (types/subtypes from CSV) ───────────────
export const getProductTypes    = ()     => request("GET", "/products/types");
export const getProductSubtypes = (type) => {
    const q = type ? `?product_type=${encodeURIComponent(type)}` : "";
    return request("GET", `/products/subtypes${q}`);
};

// ── Dispatches ─────────────────────────────────────────────
export const getDispatches         = ()     => request("GET", "/dispatches");
export const createDispatch        = (data) => request("POST", "/dispatches", data);
export const deleteDispatch        = (id)   => request("DELETE", `/dispatches/${id}`);
export const getDispatchItems      = (id)   => request("GET", `/dispatches/${id}/items`);
export const getOrderItemsForDispatch = (orderId) => request("GET", `/dispatches/order-items/${orderId}`);

// ── Payments ────────────────────────────────────────────────
export const getPayments = (params = {}) => {
    const q = new URLSearchParams();
    if (params.customer_id) q.set("customer_id", params.customer_id);
    if (params.date_from)   q.set("date_from",   params.date_from);
    if (params.date_to)     q.set("date_to",      params.date_to);
    if (params.amt_min)     q.set("amt_min",      params.amt_min);
    if (params.amt_max)     q.set("amt_max",      params.amt_max);
    return request("GET", `/payments?${q}`);
};
export const addPayment    = (data)   => request("POST",   "/payments",       data);
export const updatePayment = (id, data) => request("PUT",  `/payments/${id}`, data);
export const deletePayment = (id)     => request("DELETE", `/payments/${id}`);
export const getCustomerBalance = (id) => request("GET",   `/payments/balance/${id}`);

export const downloadLedger = (customerId, dateFrom, dateTo) => {
    const q = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    return fetch(`/api/payments/ledger/${customerId}?${q}`)
        .then(res => {
            if (!res.ok) return res.json().catch(() => null).then(err => { throw new Error(err?.detail || "Ledger failed"); });
            return res.blob();
        });
};

// ── Purchase Orders ──────────────────────────────────────────
export const getPurchaseOrders     = (status) => request("GET", `/purchase-orders${status ? `?status=${status}` : ""}`);
export const createPurchaseOrder   = (data)  => request("POST", "/purchase-orders", data);
export const deletePurchaseOrder   = (id)    => request("DELETE", `/purchase-orders/${id}`);
export const getPurchaseOrderItems = (id)    => request("GET", `/purchase-orders/${id}/items`);
export const togglePOItemArrived   = (poi_id, arrived) => request("POST", `/purchase-orders/items/${poi_id}/arrived`, { arrived });
export const getPOShippingAddresses = ()     => request("GET", "/purchase-orders/shipping-addresses");
export const getPOBillingAddresses  = ()     => request("GET", "/purchase-orders/billing-addresses");
export const savePOBillingAddress   = (address) => request("POST", "/purchase-orders/billing-addresses", { address });

export const toggleOrderItemReady = (orderId, itemId, isReady) =>
    request("POST", `/orders/${orderId}/items/${itemId}/ready`, { is_ready: isReady });


// ── Custom Invoice Generation ────────────────────────────────
export const generateCustomInvoice = (orderId, params) => {
    const q = new URLSearchParams();
    if (params.item_ids) q.set("item_ids", params.item_ids.join(","));
    return fetch(`/api/orders/${orderId}/invoice?${q}`)
        .then(res => {
            if (!res.ok) return res.json().catch(() => null).then(err => { throw new Error(err?.detail || "PDF failed"); });
            return res.blob();
        });
};
