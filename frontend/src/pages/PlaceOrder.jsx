import { useState, useEffect } from "react";
import "../styles/place-order.css";
import ConfirmDialog from "../components/ConfirmDialog";
import { getCustomers, getInventory, checkAvailability, placeOrder, deleteOrder } from "../api";
import { useProductMaster } from "../hooks/useProductMaster";
import ComboInput from "../components/ComboInput";

function PlaceOrder({ isActive, closeCurrentTab, registerCloseGuard, cart, setCart, getCartReserved, onOrderSuccess, orderPrefill, clearOrderPrefill, editingOrder, clearEditingOrder })
{
    const [customers,      setCustomers]      = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [shippingAddress,  setShippingAddress]  = useState("");

    // Cascading selectors
    const [selType,    setSelType]    = useState("");
    const [selSubtype, setSelSubtype] = useState("");
    const [selDim,     setSelDim]     = useState("");

    // Product master for Type/SubType dropdowns
    const { types: productTypes, subtypes: productSubtypes } = useProductMaster(selType);

    // Availability for current type+subtype+dim
    const [availSkus,    setAvailSkus]    = useState(null);
    const [availLoading, setAvailLoading] = useState(false);

    // Unit counts per sku_id — { [sku_id]: number }
    const [unitCounts, setUnitCounts] = useState({});

    const [sellingPrice, setSellingPrice] = useState("");

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

    // ── Refresh products ─────────────────────────────────────
    const refreshProducts = () =>
    {
        getInventory().then(inv => setInventoryItems(inv)).catch(() => {});
        if (selType && selSubtype && selDim)
        {
            setAvailLoading(true);
            checkAvailability(selType, selSubtype, selDim)
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
                setShippingAddress(editingOrder.shipping_address || fullAddress(cust));
            }
            // Pre-fill cart from order items
            const cartItems = (editingOrder.items || []).map(item => ({
                sku_type:     item.sku_type,
                sku_subtype:  item.sku_subtype,
                sku_dim:      item.sku_dim,
                sku_id:       item.sku_id,
                quantity:     item.quantity,
                skuQuantity:  item.sku_quantity,
                skuUnits:     item.quantity,
                sellingPrice: item.selling_price
            }));
            setCart(cartItems);
        }
    }, [editingOrder, customers]);

    // ── Fetch availability when all 3 filters set ────────────
    useEffect(() =>
    {
        if (!selType || !selSubtype || !selDim) { setAvailSkus(null); setUnitCounts({}); return; }
        setAvailLoading(true);
        checkAvailability(selType, selSubtype, selDim)
            .then(data => { setAvailSkus(data); setUnitCounts({}); })
            .catch(() => setAvailSkus({ skus: [], total_available: 0 }))
            .finally(() => setAvailLoading(false));
    }, [selType, selSubtype, selDim]);

    // ── Cascading options ────────────────────────────────────
    const unique = (arr) => [...new Set(arr)].sort();

    const typeOptions = unique(inventoryItems.map(i => i.sku_type));
    const subtypeOptions = unique(
        inventoryItems.filter(i => !selType || i.sku_type === selType).map(i => i.sku_subtype)
    );
    const dimOptions = unique(
        inventoryItems
            .filter(i => (!selType || i.sku_type === selType) && (!selSubtype || i.sku_subtype === selSubtype))
            .map(i => i.sku_dim)
    );

    const handleTypeChange    = (v) => { setSelType(v); setSelSubtype(""); setSelDim(""); };
    const handleSubtypeChange = (v) => { setSelSubtype(v); setSelDim(""); };

    const resetProductFields = () =>
    {
        setSelType(""); setSelSubtype(""); setSelDim("");
        setSellingPrice(""); setAvailSkus(null); setUnitCounts({});
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
        selectedCustomer !== null || cart.length > 0 ||
        selType !== "" || totalUnitsSelected > 0 || sellingPrice.trim() !== "";

    useEffect(() =>
    {
        registerCloseGuard((doClose) =>
        {
            if (!isDirty()) { doClose(); return; }
            setPendingClose(() => doClose);
            setCancelConfirm(true);
        });
    }, [selectedCustomer, cart, selType, selSubtype, selDim, totalUnitsSelected, sellingPrice]);

    const handleCustomerSelect = (e) =>
    {
        const id = parseInt(e.target.value, 10);
        const found = customers.find(c => c.customer_id === id) || null;
        setSelectedCustomer(found);
        setShippingAddress(found ? fullAddress(found) : "");
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

        if (!sellingPrice.trim() || isNaN(parseFloat(sellingPrice)) || parseFloat(sellingPrice) <= 0)
            errors.sellingPrice = "Enter a valid selling price";

        setProductErrors(errors);
        if (Object.keys(errors).length > 0) return;

        // Build cart entries — one per SKU row that has units > 0
        // kg_per_unit comes from the backend — no division on frontend
        const newItems = availSkus.skus
            .filter(s => (unitCounts[s.sku_id] || 0) > 0)
            .map(s => ({
                sku_type:     selType,
                sku_subtype:  selSubtype,
                sku_dim:      selDim,
                sku_id:       s.sku_id,
                quantity:     unitCounts[s.sku_id],
                skuQuantity:  parseFloat(s.sku_quantity),
                skuUnits:     parseInt(s.sku_units) || 1,
                sellingPrice: parseFloat(sellingPrice)
            }));

        setProductErrors({});
        setCart(prev => [...prev, ...newItems]);
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
        if (!shippingAddress.trim()) errors.shipping = "Shipping address is required";
        if (cart.length === 0)       errors.cart     = "Add at least one item to the cart";
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

            await placeOrder({
                customer_id:      selectedCustomer.customer_id,
                order_date:       new Date().toISOString().split("T")[0],
                shipping_address: shippingAddress,
                total_units:      cartTotalUnits,
                total_qty:        cartTotalQty,
                total_amount:     cartTotalAmount,
                lines: cart.map(item => ({
                    sku_type:      item.sku_type,
                    sku_subtype:   item.sku_subtype,
                    sku_dim:       item.sku_dim,
                    quantity:      item.quantity,
                    selling_price: item.sellingPrice
                }))
            });
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
        setShippingAddress("");
        setSelType(""); setSelSubtype(""); setSelDim("");
        setAvailSkus(null); setUnitCounts({});
        setSellingPrice("");
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
                    <select value={selectedCustomer ? selectedCustomer.customer_id : ""} onChange={handleCustomerSelect}>
                        <option value="">-- Select Customer --</option>
                        {customers.map(c => (
                            <option key={c.customer_id} value={c.customer_id}>{fullName(c)}</option>
                        ))}
                    </select>

                    <label>Contact :</label>
                    <input value={selectedCustomer?.contact || ""} placeholder="Contact" readOnly />

                    <label>GST :</label>
                    <input value={selectedCustomer?.gst || ""} placeholder="GST" readOnly />

                    <label>Email ID :</label>
                    <input value={selectedCustomer?.email || ""} placeholder="Email ID" readOnly />

                    <label>Billing Address :</label>
                    <input value={selectedCustomer ? fullAddress(selectedCustomer) : ""} placeholder="Billing Address" readOnly />

                    <label>Shipping Address :</label>
                    <input
                        value={shippingAddress}
                        placeholder="Shipping Address"
                        onChange={(e) => setShippingAddress(e.target.value)}
                    />

                </div>
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
                            options={productTypes} placeholder="Type…" id="po-type" />
                    </div>
                    <div className="sku-cascade-field">
                        <label>SKU Sub Type :</label>
                        <ComboInput value={selSubtype} onChange={(e) => handleSubtypeChange(e.target.value)}
                            options={productSubtypes.map(s => s.display_subtype)} placeholder="SubType…" id="po-subtype" />
                    </div>
                    <div className="sku-cascade-field">
                        <label>Dimensions :</label>
                        <select value={selDim} onChange={(e) => setSelDim(e.target.value)} disabled={!selSubtype}>
                            <option value="">-- Select --</option>
                            {dimOptions.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
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
                                            <th>SKU ID</th>
                                            <th className="th-qty">Quantity / Unit (kgs)</th>
                                            <th className="th-price">Cost Price (Rs.)</th>
                                            <th className="th-center">Units</th>
                                            <th>Description</th>
                                            <th className="th-center">Units to Order</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {availSkus.skus.map(s =>
                                        {
                                            const maxUnits = Math.max(0, (s.sku_units || 0) - cartReservedUnits);
                                            const cur      = unitCounts[s.sku_id] || 0;
                                            return (
                                                <tr key={s.sku_id}>
                                                    <td>{s.sku_id}</td>
                                                    <td className="td-qty">{parseFloat(s.sku_quantity).toFixed(3)}</td>
                                                    <td className="td-price">{parseFloat(s.sku_cost_price).toFixed(2)}</td>
                                                    <td className="td-center">{maxUnits}</td>
                                                    <td>{s.sku_desc || "—"}</td>
                                                    <td className="td-center">
                                                        <div className="unit-stepper">
                                                            <button className="stepper-btn stepper-minus"
                                                                onClick={() => stepDown(s.sku_id)} disabled={cur <= 0}>−</button>
                                                            <span className="stepper-val">{cur}</span>
                                                            <button className="stepper-btn stepper-plus"
                                                                onClick={() => stepUp(s.sku_id, maxUnits)} disabled={cur >= maxUnits}>+</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                )}

                {productErrors.filters && <p className="order-field-error">{productErrors.filters}</p>}

                {/* Selling price + Add to Cart */}
                {allFiltersSet && availSkus && availSkus.skus.length > 0 && remainingUnits > 0 && (
                    <div className="product-row">
                        <label>Selling Price (per unit) :</label>
                        <div className="field-col">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={sellingPrice}
                                onChange={(e) => setSellingPrice(e.target.value)}
                            />
                            {productErrors.sellingPrice && <span className="order-field-error">{productErrors.sellingPrice}</span>}
                        </div>

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
                                <th>Dimensions (mm)</th>
                                <th className="th-qty">Units</th>
                                <th className="th-qty">Quantity / Unit (kgs)</th>
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
                                    <td className="td-price">{item.sellingPrice.toFixed(2)}</td>
                                    <td className="td-price">{subtotal.toFixed(2)}</td>
                                    <td>
                                        <button className="cart-remove-btn"
                                            onClick={() => setCart(prev => prev.filter((_, i) => i !== index))}>✕</button>
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
                <button className="cancel-btn" onClick={handleCancelClick}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmitClick}>Submit</button>
            </div>

        </div>
    );
}

export default PlaceOrder;
