import { useState, useEffect } from "react";
import "../styles/place-order.css";
import ConfirmDialog from "../components/ConfirmDialog";
import { getCustomers, getInventory, checkAvailability, placeOrder, deleteOrder, getShippingAddresses, getPriceHistory } from "../api";
import { useProductMaster } from "../hooks/useProductMaster";
import ComboInput from "../components/ComboInput";

function PriceInfoBtn({ skuType, skuSubtype, skuDim, costPrice, customerId }) {
    const [show, setShow] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastCustomer, setLastCustomer] = useState(customerId);

    // Reset cached data when customer changes
    if (customerId !== lastCustomer) {
        setData(null);
        setLastCustomer(customerId);
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await getPriceHistory(skuType, skuSubtype, skuDim, customerId);
            setData(result);
        } catch { setData({ stats: {}, customer_prices: [] }); }
        finally { setLoading(false); }
    };

    const handleHover = () => {
        setShow(true);
        if (!data) fetchData();
    };

    const fmtPrice = (sp, cp) => {
        if (!sp) return "—";
        cp = cp || parseFloat(costPrice) || 0;
        const margin = sp - cp;
        return (
            <span>
                <span style={{color:"#fff"}}>{cp.toFixed(2)}</span>
                {margin >= 0
                    ? <span style={{color:"#4caf50"}}> +{margin.toFixed(2)}</span>
                    : <span style={{color:"#f44336"}}> {margin.toFixed(2)}</span>}
            </span>
        );
    };

    return (
        <span className="price-info-wrap"
            onMouseEnter={handleHover} onMouseLeave={() => setShow(false)}>
            <button className="price-info-btn" type="button"
                onClick={handleHover}>ℹ</button>
            {show && (
                <div className="price-info-tooltip">
                    {loading ? <div>Loading…</div> : data ? (
                        <>
                            <div className="pit-section">
                                <strong>Last 3 Months (all customers)</strong>
                                <div>Min: {fmtPrice(data.stats.min_price, parseFloat(costPrice))}</div>
                                <div>Max: {fmtPrice(data.stats.max_price, parseFloat(costPrice))}</div>
                                <div>Avg: {fmtPrice(data.stats.avg_price, parseFloat(costPrice))}</div>
                            </div>
                            {data.customer_prices.length > 0 && (
                                <div className="pit-section">
                                    <strong>Last 3 to this customer</strong>
                                    {data.customer_prices.map((p, i) => (
                                        <div key={i}>{p.date}: {fmtPrice(p.selling_price, p.cost_price)}</div>
                                    ))}
                                </div>
                            )}
                            {data.customer_prices.length === 0 && (
                                <div className="pit-section"><em>No history for this customer</em></div>
                            )}
                        </>
                    ) : <div>No data</div>}
                </div>
            )}
        </span>
    );
}

function PlaceOrder({ isActive, closeCurrentTab, registerCloseGuard, cart, setCart, getCartReserved, onOrderSuccess, orderPrefill, clearOrderPrefill, editingOrder, clearEditingOrder })
{
    const [customers,      setCustomers]      = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerQuery,    setCustomerQuery]    = useState("");
    const [shippingAddress,  setShippingAddress]  = useState("");
    const [shippingOptions,  setShippingOptions]  = useState([]);
    const [customShip, setCustomShip] = useState({ address: "", pincode: "", city: "", state: "" });
    const [isCustomShip, setIsCustomShip] = useState(false);

    // Cascading selectors
    const [selType,    setSelType]    = useState("");
    const [selSubtype, setSelSubtype] = useState("");
    const [selDim,     setSelDim]     = useState("");

    // Product master for Type/SubType dropdowns
    const { types: productTypes, subtypes: productSubtypes, hasDimensions } = useProductMaster(selType);

    // Availability for current type+subtype+dim
    const [availSkus,    setAvailSkus]    = useState(null);
    const [availLoading, setAvailLoading] = useState(false);

    // Unit counts per sku_id — { [sku_id]: number }
    const [unitCounts, setUnitCounts] = useState({});

    const [sellingPrice, setSellingPrice] = useState("");
    const [rowPrices, setRowPrices] = useState({});
    const [deliveryCharge, setDeliveryCharge] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("30");

    const [submitConfirm, setSubmitConfirm] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [pendingClose,  setPendingClose]  = useState(null);
    const [fieldErrors,   setFieldErrors]   = useState({});
    const [productErrors, setProductErrors] = useState({});
    const [apiError,      setApiError]      = useState("");
    const [loading,       setLoading]       = useState(true);

    // ── Load on mount ────────────────────────────────────────
    useEffect(() =>
    {
        Promise.all([getCustomers(), getInventory()])
            .then(([c, inv]) => { setCustomers(c); setInventoryItems(inv); })
            .catch(err => setApiError(err.message || "Failed to load data"))
            .finally(() => setLoading(false));
    }, []);

    // Helper: display subtype → raw subtype for DB queries
    const toRawSub = (display) => {
        const m = productSubtypes.find(s => s.display_subtype === display || s.raw_subtype === display);
        return m ? m.raw_subtype : display;
    };
    // ── Refresh products ─────────────────────────────────────
    const refreshProducts = () =>
    {
        getInventory().then(inv => setInventoryItems(inv)).catch(() => {});
        if (selType && selSubtype && selDim)
        {
            setAvailLoading(true);
            checkAvailability(selType, toRawSub(selSubtype), selDim)
                .then(data => { setAvailSkus(data); setUnitCounts({}); })
                .catch(() => setAvailSkus({ skus: [], total_available: 0 }))
                .finally(() => setAvailLoading(false));
        }
    };

    // Auto-refresh when tab becomes active
    useEffect(() =>
    {
        if (isActive)
        {
            getInventory().then(inv => setInventoryItems(inv)).catch(() => {});
            getCustomers().then(c => setCustomers(c)).catch(() => {});
        }
    }, [isActive]);

    // ── Absorb prefill from Retrieval ────────────────────────
    useEffect(() =>
    {
        if (orderPrefill)
        {
            setSelType(orderPrefill.type);
            setSelSubtype(orderPrefill.subtype);
            setSelDim(orderPrefill.dim);
            if (clearOrderPrefill) clearOrderPrefill();
        }
    }, [orderPrefill]);

    // ── Absorb editing order from Order List ─────────────────
    useEffect(() =>
    {
        if (editingOrder && customers.length > 0)
        {
            const cust = customers.find(c => c.customer_id === editingOrder.customer_id);
            if (cust) {
                setSelectedCustomer(cust);
                setCustomerQuery(fullName(cust));
                setShippingAddress(editingOrder.shipping_address || fullAddress(cust));
            }
            setDeliveryCharge(editingOrder.delivery_charge ? String(editingOrder.delivery_charge) : "");
            setPaymentTerms(editingOrder.terms_of_payment ? String(editingOrder.terms_of_payment) : "30");
            // Pre-fill cart from order items — merge items with same sku_id + sellingPrice
            const mergedCart = [];
            for (const item of (editingOrder.items || [])) {
                const existing = mergedCart.find(c =>
                    c.sku_id === item.sku_id && c.sellingPrice === item.selling_price
                );
                if (existing) {
                    existing.quantity += item.units;
                    existing.skuUnits += item.units;
                } else {
                    mergedCart.push({
                        sku_type:     item.sku_type,
                        sku_subtype:  item.sku_subtype,
                        sku_dim:      item.sku_dim,
                        sku_id:       item.sku_id,
                        quantity:     item.units,
                        skuQuantity:  item.sku_quantity,
                        skuUnits:     item.units,
                        sellingPrice: item.selling_price,
                        fromEdit:     true
                    });
                }
            }
            setCart(mergedCart);
        }
    }, [editingOrder, customers]);

    // ── Fetch availability when all 3 filters set ────────────
    useEffect(() =>
    {
        if (!selType || !selSubtype || !selDim) { setAvailSkus(null); setUnitCounts({}); return; }
        // Find raw subtype directly from loaded subtypes list
        const match = productSubtypes.find(s => s.display_subtype === selSubtype || s.raw_subtype === selSubtype);
        const rawSub = match ? match.raw_subtype : selSubtype;
        setAvailLoading(true);
        checkAvailability(selType, rawSub, selDim)
            .then(data => { console.log('[AVAIL result]', data); setAvailSkus(data); setUnitCounts({}); })
            .catch(err => { console.log('[AVAIL error]', err); setAvailSkus({ skus: [], total_available: 0 }); })
            .finally(() => setAvailLoading(false));
    }, [selType, selSubtype, selDim, productSubtypes]);

    // ── Cascading options ────────────────────────────────────
    const unique = (arr) => [...new Set(arr)].sort();

    const dimOptions = unique(
        inventoryItems
            .filter(i => {
                if (!selType || i.sku_type !== selType) return !selType;
                if (!selSubtype) return true;
                return i.sku_subtype === toRawSub(selSubtype);
            })
            .map(i => i.sku_dim)
    );

    const handleTypeChange    = (v) => { setSelType(v); setSelSubtype(""); setSelDim(""); };
    const handleSubtypeChange = (v) => { setSelSubtype(v); if (!hasDimensions) setSelDim("-"); else setSelDim(""); };

    // Auto-set dim for dimensionless products (handles initial load / type switch)
    useEffect(() => {
        if (!hasDimensions && selType) setSelDim(d => d || "-");
        else if (hasDimensions && selDim === "-") setSelDim("");
    }, [hasDimensions, selType]);

    const resetProductFields = () =>
    {
        setSelType(""); setSelSubtype(""); setSelDim("");
        setSellingPrice(""); setAvailSkus(null); setUnitCounts({}); setRowPrices({});
    };

    // ── Stepper helpers ───────────────────────────────────────
    const totalUnitsSelected = Object.values(unitCounts).reduce((s, v) => s + v, 0);

    const stepUp = (skuId, maxUnits) =>
    {
        setUnitCounts(prev =>
        {
            const cur = prev[skuId] || 0;
            if (cur >= maxUnits) return prev;
            return { ...prev, [skuId]: cur + 1 };
        });
    };

    const stepDown = (skuId) =>
    {
        setUnitCounts(prev =>
        {
            const cur = prev[skuId] || 0;
            if (cur <= 0) return prev;
            return { ...prev, [skuId]: cur - 1 };
        });
    };

    // ── Helpers ──────────────────────────────────────────────
    const fullName    = (c) => [c.fname, c.mname, c.lname].filter(Boolean).join(" ");
    const fullAddress = (c) => [c.address, c.city, c.state, c.pincode].filter(Boolean).join(", ");

    const isDirty = () =>
        selectedCustomer !== null || customerQuery.trim() !== "" || cart.length > 0 ||
        selType !== "" || totalUnitsSelected > 0 || sellingPrice.trim() !== "";

    useEffect(() =>
    {
        registerCloseGuard((doClose) =>
        {
            if (!isDirty()) { doClose(); return; }
            setPendingClose(() => doClose);
            setCancelConfirm(true);
        });
    }, [selectedCustomer, customerQuery, cart, selType, selSubtype, selDim, totalUnitsSelected, sellingPrice]);

    const handleCustomerSelect = async (e) =>
    {
        const value = e.target.value;
        const found = customers.find(c => fullName(c) === value) || null;
        setCustomerQuery(value);
        setSelectedCustomer(found);
        if (found) {
            try {
                const addrs = await getShippingAddresses(found.customer_id);
                setShippingOptions(addrs);
                const defaultAddr = addrs.find(a => a.is_default) || addrs[0];
                if (defaultAddr) {
                    setShippingAddress([defaultAddr.address, defaultAddr.city, defaultAddr.state, defaultAddr.pincode].filter(Boolean).join(", "));
                } else {
                    setShippingAddress(fullAddress(found));
                }
            } catch {
                setShippingOptions([]);
                setShippingAddress(fullAddress(found));
            }
        } else {
            setShippingOptions([]);
            setShippingAddress("");
        }
    };

    const allFiltersSet   = selType && selSubtype && selDim;
    // Cart reserved is in units for the same type+subtype+dim
    const cartReservedUnits = allFiltersSet ? getCartReserved(selType, selSubtype, selDim) : 0;
    const totalUnits      = availSkus ? (availSkus.total_units ?? 0) : 0;
    const remainingUnits  = totalUnits - cartReservedUnits;

    // ── Add to cart ───────────────────────────────────────────
    // Each SKU row with units > 0 becomes a separate cart line (quantity = units × sku_units_per_piece)
    // But the backend works with raw qty, and we're passing units here.
    // quantity sent = units selected (the stepper value = number of units/pieces, not kg)
    const addToCart = () =>
    {
        const errors = {};
        if (!allFiltersSet)
            errors.filters = "Select Type, Sub Type and Dimensions";
        else if (totalUnitsSelected <= 0)
            errors.filters = "Select at least 1 unit using the + / − buttons";

        // Validate per-row prices
        const selectedSkus = availSkus.skus.filter(s => (unitCounts[s.sku_id] || 0) > 0);
        for (const s of selectedSkus) {
            const p = rowPrices[s.sku_id] || sellingPrice;
            if (!p || isNaN(parseFloat(p)) || parseFloat(p) <= 0) {
                errors.sellingPrice = "Enter a valid selling price for all selected items";
                break;
            }
        }

        setProductErrors(errors);
        if (Object.keys(errors).length > 0) return;

        const newItems = selectedSkus.map(s => ({
                sku_type:     selType,
                sku_subtype:  toRawSub(selSubtype),
                sku_dim:      selDim,
                sku_id:       s.sku_id,
                quantity:     unitCounts[s.sku_id],
                skuQuantity:  parseFloat(s.sku_quantity),
                skuUnits:     parseInt(s.sku_units) || 1,
                sellingPrice: parseFloat(rowPrices[s.sku_id] || sellingPrice)
            }));

        setProductErrors({});
        setCart(prev => {
            const updated = [...prev];
            for (const item of newItems) {
                const existing = updated.find(c =>
                    c.sku_id === item.sku_id && c.sellingPrice === item.sellingPrice
                );
                if (existing) {
                    existing.quantity += item.quantity;
                    existing.skuUnits = Math.max(existing.skuUnits, existing.quantity);
                } else {
                    updated.push(item);
                }
            }
            return updated;
        });
        resetProductFields();
    };

    // ── Cart totals ───────────────────────────────────────────
    const cartTotalUnits  = cart.reduce((s, i) => s + i.quantity, 0);
    const cartTotalQty    = cart.reduce((s, i) => s + i.quantity * (i.skuQuantity || 0), 0);
    const cartTotalAmount = cart.reduce((s, i) => s + i.sellingPrice * i.quantity * (i.skuQuantity || 0), 0);

    // ── Validate + submit ─────────────────────────────────────
    const validateOrder = () =>
    {
        const errors = {};
        if (!selectedCustomer)       errors.customer = "Customer is required";
        if (isCustomShip) {
            if (!customShip.address.trim()) errors.shipping = "Shipping address is required";
        } else {
            if (!shippingAddress.trim()) errors.shipping = "Shipping address is required";
        }
        if (cart.length === 0)       errors.cart     = "Add at least one item to the cart";
        if (!paymentTerms || parseInt(paymentTerms) <= 0) errors.paymentTerms = "Terms of payment is required";
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitClick = () => { if (!validateOrder()) return; setSubmitConfirm(true); };

    const confirmSubmit = async () =>
    {
        setSubmitConfirm(false);
        setApiError("");
        try {
            // If editing an existing order, delete it first (reverses inventory)
            if (editingOrder)
            {
                await deleteOrder(editingOrder.order_id);
            }

            // Build final shipping address
            const finalShipAddr = isCustomShip
                ? [customShip.address, customShip.city, customShip.state, customShip.pincode].filter(Boolean).join(", ")
                : shippingAddress;

            await placeOrder({
                customer_id:      selectedCustomer.customer_id,
                order_date:       new Date().toLocaleDateString("en-CA"),
                shipping_address: finalShipAddr,
                total_units:      cartTotalUnits,
                total_qty:        cartTotalQty,
                total_amount:     cartTotalAmount,
                delivery_charge:  parseFloat(deliveryCharge) || 0,
                terms_of_payment: parseInt(paymentTerms) || 30,
                lines: cart.map(item => ({
                    sku_type:      item.sku_type,
                    sku_subtype:   item.sku_subtype,
                    sku_dim:       item.sku_dim,
                    units:         item.quantity,
                    selling_price: item.sellingPrice
                }))
            });
            // If custom shipping address was used, save it for future use
            if (isCustomShip && selectedCustomer && customShip.address.trim()) {
                try {
                    const { updateShippingAddresses } = await import("../api");
                    const existing = shippingOptions.map(a => ({ address: a.address, pincode: a.pincode, city: a.city, state: a.state, is_default: a.is_default }));
                    existing.push({ address: customShip.address, pincode: customShip.pincode ? parseInt(customShip.pincode) : null, city: customShip.city, state: customShip.state, is_default: false });
                    await updateShippingAddresses(selectedCustomer.customer_id, existing);
                } catch {} // non-critical
            }
            if (clearEditingOrder) clearEditingOrder();
            if (onOrderSuccess) onOrderSuccess();
            resetAllState();
            closeCurrentTab();
        } catch (err) {
            setApiError(err.message || "Failed to place order");
        }
    };

    const resetAllState = () =>
    {
        setSelectedCustomer(null);
        setCustomerQuery("");
        setShippingAddress("");
        setSelType(""); setSelSubtype(""); setSelDim("");
        setAvailSkus(null); setUnitCounts({});
        setSellingPrice("");
        setDeliveryCharge("");
        setIsCustomShip(false);
        setCustomShip({ address: "", pincode: "", city: "", state: "" });
        setShippingOptions([]);
        setFieldErrors({}); setProductErrors({}); setApiError("");
        setCart([]);   // clear shared cart too
    };

    const handleCancelClick = () =>
    {
        if (!isDirty())
        {
            resetAllState();
            closeCurrentTab();
            return;
        }
        setPendingClose(() => () =>
        {
            resetAllState();
            closeCurrentTab();
        });
        setCancelConfirm(true);
    };

    const confirmCancel = () => { setCancelConfirm(false); if (pendingClose) pendingClose(); };

    if (loading) return <div className="place-order-container"><p>Loading…</p></div>;

    return (
        <div className="place-order-container">

            <ConfirmDialog
                open={submitConfirm}
                variant="success"
                title="Submit Order"
                message={
                    <>Submit order for <strong>{selectedCustomer ? fullName(selectedCustomer) : "this customer"}</strong>{" "}
                    with <strong>{cart.length}</strong> item{cart.length !== 1 ? "s" : ""}?</>
                }
                confirmLabel="Yes, Submit"
                cancelLabel="Go Back"
                onConfirm={confirmSubmit}
                onCancel={() => setSubmitConfirm(false)}
            />

            <ConfirmDialog
                open={cancelConfirm}
                variant="warning"
                title="Discard Order"
                message="Cancel and discard this order? All items in the cart will be lost."
                confirmLabel="Yes, Discard"
                cancelLabel="Keep Editing"
                onConfirm={confirmCancel}
                onCancel={() => { setCancelConfirm(false); setPendingClose(null); }}
            />

            {apiError && <div className="order-api-error">{apiError}</div>}

            {/* ── Customer Panel ── */}
            <div className="customer-panel">
                <h2>Customer Details</h2>
                <div className="customer-grid">

                    <label>Customer Name :</label>
                    <ComboInput
                        value={customerQuery}
                        onChange={handleCustomerSelect}
                        options={customers.map(c => fullName(c))}
                        placeholder="Customer Name..."
                        id="po-customer"
                    />

                    <label>Contact :</label>
                    <div className="multi-value-boxes">
                        {(selectedCustomer?.contact || "").split(",").filter(v => v.trim()).map((v, i) => (
                            <span key={i} className="value-chip">{v.trim()}</span>
                        ))}
                        {!(selectedCustomer?.contact) && <span className="value-chip empty">Contact</span>}
                    </div>

                    <label>GST :</label>
                    <input value={selectedCustomer?.gst || ""} placeholder="GST" readOnly />

                    <label>Email ID :</label>
                    <div className="multi-value-boxes">
                        {(selectedCustomer?.email || "").split(",").filter(v => v.trim()).map((v, i) => (
                            <span key={i} className="value-chip">{v.trim()}</span>
                        ))}
                        {!(selectedCustomer?.email) && <span className="value-chip empty">Email ID</span>}
                    </div>

                    <label>Billing Address :</label>
                    <input value={selectedCustomer ? fullAddress(selectedCustomer) : ""} placeholder="Billing Address" readOnly />

                    <label>Shipping Address :</label>
                    {shippingOptions.length > 0 ? (
                        <select value={isCustomShip ? "__custom__" : shippingAddress}
                            onChange={(e) => {
                                if (e.target.value === "__custom__") {
                                    setIsCustomShip(true);
                                    setShippingAddress("");
                                    setCustomShip({ address: "", pincode: "", city: "", state: "" });
                                } else {
                                    setIsCustomShip(false);
                                    setShippingAddress(e.target.value);
                                }
                            }}>
                            {shippingOptions.map((a, i) => {
                                const val = [a.address, a.city, a.state, a.pincode].filter(Boolean).join(", ");
                                return <option key={i} value={val}>{val}{a.is_default ? " (Default)" : ""}</option>;
                            })}
                            <option value="__custom__">-- Custom --</option>
                        </select>
                    ) : (
                        <input
                            value={shippingAddress}
                            placeholder="Shipping Address"
                            onChange={(e) => setShippingAddress(e.target.value)}
                        />
                    )}

                </div>
                {isCustomShip && (
                    <div className="custom-ship-fields">
                        <label className="custom-ship-label">Shipping Address</label>
                        <div className="custom-ship-row">
                            <input value={customShip.address} onChange={e => setCustomShip(p => ({ ...p, address: e.target.value }))} placeholder="Building / Area" style={{ flex: 2 }} />
                            <input value={customShip.pincode} onChange={e => setCustomShip(p => ({ ...p, pincode: e.target.value }))} placeholder="Pincode" style={{ flex: 1 }} />
                        </div>
                        <div className="custom-ship-row">
                            <input value={customShip.city} onChange={e => setCustomShip(p => ({ ...p, city: e.target.value }))} placeholder="City" />
                            <input value={customShip.state} onChange={e => setCustomShip(p => ({ ...p, state: e.target.value }))} placeholder="State" />
                        </div>
                    </div>
                )}
                {fieldErrors.customer && <p className="order-field-error">{fieldErrors.customer}</p>}
                {fieldErrors.shipping && <p className="order-field-error">{fieldErrors.shipping}</p>}
            </div>

            {/* ── Product Panel ── */}
            <div className="product-panel">
                <div className="product-panel-header">
                    <h2>Products</h2>
                    <button className="product-refresh-btn" onClick={refreshProducts} title="Refresh available products">
                        ↻ Refresh
                    </button>
                </div>

                {/* 3 cascading dropdowns */}
                <div className="sku-cascade-row sku-cascade-3">
                    <div className="sku-cascade-field">
                        <label>SKU Type :</label>
                        <ComboInput value={selType} onChange={(e) => handleTypeChange(e.target.value)}
                            options={productTypes} placeholder="Type..." id="po-type" />
                    </div>
                    <div className="sku-cascade-field">
                        <label>SKU Sub Type :</label>
                        <ComboInput value={selSubtype} onChange={(e) => handleSubtypeChange(e.target.value)}
                            options={productSubtypes.map(s => s.display_subtype)} placeholder="SubType..." id="po-subtype"
                            disabled={!selType} />
                    </div>
                    <div className="sku-cascade-field">
                        <label>Dimensions :</label>
                        {hasDimensions ? (
                            <ComboInput value={selDim} onChange={(e) => setSelDim(e.target.value)}
                                options={dimOptions} placeholder="Dimensions..." id="po-dim"
                                disabled={!selSubtype} />
                        ) : (
                            <input value="-" disabled />
                        )}
                    </div>
                </div>

                {/* Availability panel with unit steppers */}
                {allFiltersSet && (
                    <div className="avail-panel">
                        {availLoading && <div className="avail-loading">Checking availability…</div>}

                        {!availLoading && availSkus && availSkus.skus.length === 0 && (
                            <div className="avail-unavailable">
                                ✱ No stock available for <strong>{selType} / {selSubtype} / {selDim}</strong>.
                                This combination is currently out of stock.
                            </div>
                        )}

                        {!availLoading && availSkus && availSkus.skus.length > 0 && remainingUnits <= 0 && (
                            <div className="avail-unavailable">
                                ✱ All units of <strong>{selType} / {selSubtype} / {selDim}</strong> are already reserved in the cart.
                            </div>
                        )}

                        {!availLoading && availSkus && availSkus.skus.length > 0 && remainingUnits > 0 && (
                            <>
                                <div className="avail-summary">
                                    Total units in stock: <strong>{totalUnits}</strong>
                                    {" "} | Total qty: <strong>{parseFloat(availSkus.total_available).toFixed(3)} kgs</strong>
                                    {cartReservedUnits > 0 && <> — In cart: <strong>{cartReservedUnits}</strong> units — Remaining: <strong>{remainingUnits}</strong> units</>}
                                    {" "}across <strong>{availSkus.skus.length}</strong> batch{availSkus.skus.length !== 1 ? "es" : ""}
                                    {totalUnitsSelected > 0 && <> — <strong>{totalUnitsSelected}</strong> unit{totalUnitsSelected !== 1 ? "s" : ""} selected</>}
                                </div>
                                <table className="avail-table">
                                    <thead>
                                        <tr>
                                            <th>Dim</th>
                                            <th className="th-qty">Qty / Unit (kgs)</th>
                                            <th className="th-price">Cost Price (Rs.)</th>
                                            <th className="th-center">Units</th>
                                            <th>Location</th>
                                            <th>Description</th>
                                            <th className="th-center"></th>
                                            <th className="th-center">Units to Order</th>
                                            <th className="th-price">Selling Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...availSkus.skus].sort((a, b) => {
                                            const dimA = parseFloat(a.sku_dim) || 0;
                                            const dimB = parseFloat(b.sku_dim) || 0;
                                            if (dimA !== dimB) return dimA - dimB;
                                            return (parseFloat(b.sku_quantity) || 0) - (parseFloat(a.sku_quantity) || 0);
                                        }).map(s =>
                                        {
                                            const maxUnits = Math.max(0, (s.sku_units || 0) - cartReservedUnits);
                                            const cur      = unitCounts[s.sku_id] || 0;
                                            return (
                                                <tr key={s.sku_id}>
                                                    <td>{s.sku_dim}</td>
                                                    <td className="td-qty">{parseFloat(s.sku_quantity).toFixed(3)}</td>
                                                    <td className="td-price">{parseFloat(s.sku_cost_price).toFixed(2)}</td>
                                                    <td className="td-center">{maxUnits}</td>
                                                    <td style={{textAlign:"center"}}>{s.location || "M-Gram"}</td>
                                                    <td>{s.sku_desc || "—"}</td>
                                                    <td className="td-center">
                                                        <PriceInfoBtn skuType={selType} skuSubtype={toRawSub(selSubtype)} skuDim={s.sku_dim} costPrice={s.sku_cost_price} customerId={selectedCustomer?.customer_id} />
                                                    </td>
                                                    <td className="td-center">
                                                        <div className="unit-stepper">
                                                            <button className="stepper-btn stepper-minus"
                                                                onClick={() => stepDown(s.sku_id)} disabled={cur <= 0}>−</button>
                                                            <span className="stepper-val">{cur}</span>
                                                            <button className="stepper-btn stepper-plus"
                                                                onClick={() => stepUp(s.sku_id, maxUnits)} disabled={cur >= maxUnits}>+</button>
                                                        </div>
                                                    </td>
                                                    <td style={{textAlign:"right"}}>
                                                        <input type="number" min="0" step="1" className="row-price-input"
                                                            value={rowPrices[s.sku_id] ?? sellingPrice}
                                                            onChange={e => setRowPrices(p => ({...p, [s.sku_id]: e.target.value}))}
                                                            placeholder="0.00" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div className="avail-avg-cost">
                                    Avg Stock Cost: <strong>₹{(() => {
                                        const totalQty = availSkus.skus.reduce((s, sk) => s + (parseFloat(sk.sku_quantity) || 0) * (parseInt(sk.sku_units) || 0), 0);
                                        if (totalQty === 0) return "0.00";
                                        const weightedSum = availSkus.skus.reduce((s, sk) => s + (parseFloat(sk.sku_quantity) || 0) * (parseInt(sk.sku_units) || 0) * (parseFloat(sk.sku_cost_price) || 0), 0);
                                        return (weightedSum / totalQty).toFixed(2);
                                    })()}</strong> per kg
                                </div>
                            </>
                        )}
                    </div>
                )}

                {productErrors.filters && <p className="order-field-error">{productErrors.filters}</p>}

                {/* Selling price + Add to Cart */}
                {allFiltersSet && availSkus && availSkus.skus.length > 0 && remainingUnits > 0 && (
                    <div className="product-row" style={{justifyContent:"flex-end"}}>
                        {productErrors.sellingPrice && <span className="order-field-error" style={{marginRight:12}}>{productErrors.sellingPrice}</span>}
                        <div className="cart-button-row" style={{ marginTop: 0 }}>
                            <button className="add-cart-btn" onClick={addToCart}>
                                Add To Cart {totalUnitsSelected > 0 && `(${totalUnitsSelected} unit${totalUnitsSelected !== 1 ? "s" : ""})`}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Cart ── */}
            <div className="cart-panel">
                <h2>Cart</h2>
                {fieldErrors.cart && <p className="order-field-error">{fieldErrors.cart}</p>}

                {cart.length === 0 ? (
                    <div className="cart-empty">No items added yet.</div>
                ) : (
                    <table className="cart-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Sub Type</th>
                                <th>Dim (mm)</th>
                                <th className="th-qty">Units</th>
                                <th className="th-qty">Qty (kgs)</th>
                                <th className="th-price">Rate (Rs./kg)</th>
                                <th className="th-price">Subtotal (Rs.)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map((item, index) =>
                            {
                                const subtotal = item.sellingPrice * item.quantity * item.skuQuantity;
                                return (
                                <tr key={index}>
                                    <td>{item.sku_type}</td>
                                    <td>{item.sku_subtype}</td>
                                    <td>{item.sku_dim}</td>
                                    <td className="td-qty">{item.quantity}</td>
                                    <td className="td-qty">{(item.skuQuantity).toFixed(3)}</td>
                                    <td className="td-price">
                                        <input type="number" min="0" step="1.00"
                                            value={item.sellingPrice.toFixed(2)}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                if (!isNaN(val)) setCart(prev => prev.map((it, i) => i === index ? { ...it, sellingPrice: val } : it));
                                            }}
                                            style={{ width: 75, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4, textAlign: "right" }}
                                        />
                                    </td>
                                    <td className="td-price">{subtotal.toFixed(2)}</td>
                                    <td>
                                        <div className="cart-stepper">
                                            <button className="stepper-btn stepper-minus"
                                                onClick={() => {
                                                    if (item.quantity <= 1) {
                                                        setCart(prev => prev.filter((_, i) => i !== index));
                                                    } else {
                                                        setCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: it.quantity - 1 } : it));
                                                    }
                                                }}>−</button>
                                            <span className="stepper-val">{item.quantity}</span>
                                            <button className="stepper-btn stepper-plus"
                                                onClick={() => {
                                                    setCart(prev => prev.map((it, i) => i === index ? { ...it, quantity: it.quantity + 1 } : it));
                                                }} disabled={item.quantity >= item.skuUnits}>+</button>
                                            <button className="cart-remove-btn"
                                                onClick={() => setCart(prev => prev.filter((_, i) => i !== index))}>✕</button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="cart-totals-row">
                                <td colSpan={3}><strong>Total</strong></td>
                                <td className="td-qty"><strong>{cartTotalUnits}</strong></td>
                                <td className="td-qty"><strong>{cartTotalQty.toFixed(3)}</strong></td>
                                <td></td>
                                <td className="td-price"><strong>{cartTotalAmount.toFixed(2)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            <div className="place-order-buttons">
                <div className="delivery-charge-field">
                    <label>Delivery Charge (Rs.) :</label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0.00"
                        value={deliveryCharge}
                        onChange={(e) => setDeliveryCharge(e.target.value)}
                    />
                </div>
                <div className="delivery-charge-field">
                    <label>Terms of Payment (Days) * :</label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="30"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                    />
                    {fieldErrors.paymentTerms && <span className="order-field-error">{fieldErrors.paymentTerms}</span>}
                </div>
                <button className="cancel-btn" onClick={handleCancelClick}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmitClick}>Submit</button>
            </div>

        </div>
    );
}

export default PlaceOrder;
