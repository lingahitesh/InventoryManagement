import { useState, useEffect, useCallback, useRef, Fragment, useLayoutEffect } from "react";
import "../styles/purchase-order.css";
import {
    getPurchaseOrders, createPurchaseOrder, deletePurchaseOrder,
    getPurchaseOrderItems, advancePOItemStatus, confirmPurchaseOrder,
    unconfirmPurchaseOrder, updatePurchaseOrder,
    getPOShippingAddresses, getPOBillingAddresses, savePOBillingAddress,
    getCustomers
} from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ModalOverlay from "../components/ModalOverlay";
import SelectInput from "../components/SelectInput";
import ComboInput from "../components/ComboInput";
import IOSToggle from "../components/IOSToggle";
import PasswordPrompt from "../components/PasswordPrompt";
import { useProductMaster } from "../hooks/useProductMaster";

const emptyQtyRow = (defaults = {}) => ({
    qty: "", sku_units: defaults.sku_units || 1,
    sku_cost_price: defaults.sku_cost_price || "",
    sku_desc: defaults.sku_desc || ""
});

const emptyItem = () => ({
    sku_type: "", sku_subtype: "", sku_dim: "",
    qtyRows: [emptyQtyRow()]
});

function isArrivedOver24h(arrivedAt) {
    if (!arrivedAt) return false;
    const diff = Date.now() - new Date(arrivedAt).getTime();
    return diff > 24 * 60 * 60 * 1000;
}

function POCartItemRow({ item, index, totalItems, onUpdate, onRemove }) {
    const { types, subtypes, hasDimensions } = useProductMaster(item.sku_type);

    useEffect(() => {
        if (!hasDimensions && item.sku_type) onUpdate(index, "sku_dim", "-");
        else if (hasDimensions && item.sku_dim === "-") onUpdate(index, "sku_dim", "");
    }, [hasDimensions, item.sku_type]);

    return (
        <div className="po-cart-item">
            <div className="po-cart-row">
                <div className="po-cart-field">
                    <label>Type</label>
                    <ComboInput value={item.sku_type}
                        onChange={e => onUpdate(index, "sku_type", e.target.value)}
                        options={types} placeholder="Type…" />
                </div>
                <div className="po-cart-field po-cart-field-wide">
                    <label>Sub Type</label>
                    <ComboInput value={item.sku_subtype}
                        onChange={e => onUpdate(index, "sku_subtype", e.target.value)}
                        options={subtypes.map(s => s.display_subtype)} placeholder="SubType…"
                        disabled={!item.sku_type} />
                </div>
                <div className="po-cart-field">
                    <label>Dimensions</label>
                    <input value={item.sku_dim === "-" ? "" : item.sku_dim}
                        disabled={!hasDimensions}
                        onChange={e => onUpdate(index, "sku_dim", e.target.value)}
                        placeholder={hasDimensions ? "e.g. 350" : "-"} />
                </div>
                <div className="po-cart-field" style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
                    <button className="cart-remove-btn" onClick={() => onRemove(index)}
                        disabled={totalItems <= 1} style={{ opacity: totalItems <= 1 ? 0.4 : 1 }}>
                        ✕ Remove
                    </button>
                </div>
            </div>
            <div className="po-qty-table">
                <div className="po-qty-header">
                    <span>Qty / Unit (kgs)</span><span>Units</span>
                    <span>Cost Price (₹/kg)</span><span>Description</span><span></span>
                </div>
                {item.qtyRows.map((row, qi) => (
                    <div key={qi} className="po-qty-data-row">
                        <input type="number" min="0" step="0.001" value={row.qty}
                            onChange={e => onUpdate(index, "qtyField", "qty", qi, e.target.value)}
                            placeholder="kgs" />
                        <input type="number" min="1" step="1" value={row.sku_units}
                            onChange={e => onUpdate(index, "qtyField", "sku_units", qi, e.target.value)} />
                        <input type="number" min="0" step="1" value={row.sku_cost_price}
                            onChange={e => onUpdate(index, "qtyField", "sku_cost_price", qi, e.target.value)}
                            placeholder="0" />
                        <input value={row.sku_desc}
                            onChange={e => onUpdate(index, "qtyField", "sku_desc", qi, e.target.value)}
                            placeholder="optional" />
                        <button className="multi-remove"
                            disabled={item.qtyRows.length <= 1}
                            style={{ opacity: item.qtyRows.length <= 1 ? 0.4 : 1 }}
                            onClick={() => onUpdate(index, "removeQtyRow", null, qi)}>✕</button>
                    </div>
                ))}
                <button className="multi-add-btn" style={{ marginTop: 4 }}
                    onClick={() => onUpdate(index, "addQtyRow")}>+ Add Qty</button>
            </div>
        </div>
    );
}

function POInvoicePreview({ po, onClose }) {
    const [deliveryDate, setDeliveryDate] = useState("As mentioned");
    const [freight, setFreight] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("As usual");

    const pdfUrl = `/api/purchase-orders/${po.po_id}/pdf?delivery_date=${encodeURIComponent(deliveryDate)}&freight=${encodeURIComponent(freight)}&payment_terms=${encodeURIComponent(paymentTerms)}`;

    return (
        <div className="po-invoice-preview">
            <div className="po-invoice-controls">
                <div className="po-invoice-inputs">
                    <label>Delivery Date:
                        <input value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                    </label>
                    <label>Freight & Insurance:
                        <input value={freight} onChange={e => setFreight(e.target.value)} placeholder="—" />
                    </label>
                    <label>Payment Terms:
                        <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} />
                    </label>
                </div>
            </div>
            <iframe
                title="PO Preview"
                src={pdfUrl}
                style={{ width: "100%", height: "500px", border: "1px solid #ddd", borderRadius: 8 }}
            />
            <div className="po-invoice-actions" style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="cancel-btn" onClick={onClose}>Close</button>
                <button className="submit-btn" onClick={() => window.open(pdfUrl, "_blank")}>📥 Download</button>
                <button className="submit-btn" style={{ background: "#2e7d32" }} onClick={() => {
                    const w = window.open(pdfUrl, "_blank");
                    setTimeout(() => { if (w) w.print(); }, 1000);
                }}>🖨 Print</button>
            </div>
        </div>
    );
}

function PlacePOForm({ onClose, onSuccess, editingPO, editingItems }) {
    const isEdit = !!editingPO;
    const [customers,       setCustomers]       = useState([]);
    const [supplierQuery,   setSupplierQuery]   = useState(editingPO?.supplier_name || "");
    const [selectedCust,    setSelectedCust]    = useState(null);
    const [supplierName,    setSupplierName]    = useState(editingPO?.supplier_name || "");
    const [supplierContact, setSupplierContact] = useState(editingPO?.supplier_contact || "");
    const [supplierGst,     setSupplierGst]     = useState(editingPO?.supplier_gst || "");
    const [supplierEmail,   setSupplierEmail]   = useState(editingPO?.supplier_email || "");

    const [billingAddress,   setBillingAddress]   = useState(editingPO?.billing_address || "3/B, PORTUGUESE CHURCH STREET 2ND FLOOR, KOLKATA 700001");
    const [billingOptions,   setBillingOptions]   = useState([]);
    const [isCustomBilling,  setIsCustomBilling]  = useState(false);
    const [customBilling,    setCustomBilling]    = useState({ address:"", pincode:"", city:"", state:"" });

    const [shippingAddress,  setShippingAddress]  = useState(editingPO?.shipping_address || "");
    const [shippingOptions,  setShippingOptions]  = useState([]);
    const [isCustomShipping, setIsCustomShipping] = useState(false);
    const [customShipping,   setCustomShipping]   = useState({ address:"", pincode:"", city:"", state:"" });

    const [trackingId, setTrackingId] = useState(editingPO?.tracking_id || "");
    const [orderDate,  setOrderDate]  = useState(editingPO?.order_date ? editingPO.order_date.slice(0,10) : new Date().toLocaleDateString("en-CA"));
    const [orderTime,  setOrderTime]  = useState(editingPO?.order_date ? editingPO.order_date.slice(11,16) : new Date().toTimeString().slice(0,5));
    const [notes,      setNotes]      = useState(editingPO?.notes || "");
    const [error,      setError]      = useState("");

    // Build initial cart from editing items - group by type/subtype/dim
    const buildCartFromItems = () => {
        if (!editingItems || editingItems.length === 0) return [emptyItem()];
        const grouped = {};
        for (const item of editingItems) {
            const key = `${item.sku_type}||${item.sku_subtype}||${item.sku_dim || "-"}`;
            if (!grouped[key]) {
                grouped[key] = {
                    sku_type: item.sku_type || "",
                    sku_subtype: item.sku_subtype || "",
                    sku_dim: item.sku_dim || "",
                    qtyRows: []
                };
            }
            grouped[key].qtyRows.push({
                qty: item.sku_quantity ? String(item.sku_quantity) : "",
                sku_units: item.sku_units || 1,
                sku_cost_price: item.sku_cost_price ? String(item.sku_cost_price) : "",
                sku_desc: item.sku_desc || ""
            });
        }
        return Object.values(grouped);
    };
    const [cartItems, setCartItems] = useState(buildCartFromItems);

    useEffect(() => {
        getCustomers().then(setCustomers).catch(() => {});
        getPOShippingAddresses().then(d => setShippingOptions(d.addresses || [])).catch(() => {});
        getPOBillingAddresses().then(d => setBillingOptions(d.map(a => a.address))).catch(() => {});
    }, []);

    const fullName = (c) => [c.fname, c.mname, c.lname].filter(Boolean).join(" ");

    const handleCustSelect = (e) => {
        const name = e.target.value;
        setSupplierQuery(name);
        const c = customers.find(x => fullName(x) === name);
        setSelectedCust(c || null);
        if (c) {
            setSupplierName(fullName(c));
            setSupplierContact(c.contact || "");
            setSupplierGst(c.gst || "");
            setSupplierEmail(c.email || "");
        }
    };

    const addCartItem  = () => setCartItems(p => [...p, emptyItem()]);
    const removeCartItem = (idx) => setCartItems(p => p.filter((_,i) => i !== idx));

    const updateCartItem = (idx, action, field, qi, val) => {
        setCartItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            if (action === "sku_type")    return { ...item, sku_type: field, sku_subtype: "", sku_dim: "" };
            if (action === "sku_subtype") return { ...item, sku_subtype: field };
            if (action === "sku_dim")     return { ...item, sku_dim: field };
            if (action === "qtyField") {
                const rows = item.qtyRows.map((r, ri) => ri === qi ? { ...r, [field]: val } : r);
                return { ...item, qtyRows: rows };
            }
            if (action === "addQtyRow") {
                const last = item.qtyRows[item.qtyRows.length - 1];
                return { ...item, qtyRows: [...item.qtyRows, emptyQtyRow(last)] };
            }
            if (action === "removeQtyRow") {
                return { ...item, qtyRows: item.qtyRows.filter((_,ri) => ri !== qi) };
            }
            return item;
        }));
    };

    const handleSubmit = async () => {
        if (!supplierName.trim()) { setError("Supplier name is required"); return; }
        for (const item of cartItems) {
            if (!item.sku_type || !item.sku_subtype) { setError("Type and subtype required"); return; }
            if (item.qtyRows.every(r => !r.qty || parseFloat(r.qty) <= 0)) { setError("At least one valid qty required per item"); return; }
        }
        setError("");
        const finalBilling  = isCustomBilling
            ? [customBilling.address, customBilling.city, customBilling.state, customBilling.pincode].filter(Boolean).join(", ")
            : billingAddress;
        const finalShipping = isCustomShipping
            ? [customShipping.address, customShipping.city, customShipping.state, customShipping.pincode].filter(Boolean).join(", ")
            : shippingAddress;

        const expandedItems = [];
        for (const item of cartItems) {
            const rawSub = item.sku_subtype.includes(" - ")
                ? item.sku_subtype.split(" - ").slice(1).join(" - ")
                : item.sku_subtype;
            for (const row of item.qtyRows.filter(r => r.qty && parseFloat(r.qty) > 0)) {
                expandedItems.push({
                    sku_type: item.sku_type, sku_subtype: rawSub,
                    sku_dim: item.sku_dim || "-",
                    sku_quantity: parseFloat(row.qty),
                    sku_units: parseInt(row.sku_units) || 1,
                    sku_cost_price: parseFloat(row.sku_cost_price) || null,
                    sku_desc: row.sku_desc || null,
                });
            }
        }
        const payload = {
            supplier_name: supplierName, supplier_contact: supplierContact || null,
            supplier_gst: supplierGst || null, supplier_email: supplierEmail || null,
            billing_address: finalBilling, shipping_address: finalShipping || null,
            tracking_id: trackingId || null,
            order_date: orderDate ? `${orderDate}T${orderTime}:00` : null,
            notes: notes || null, items: expandedItems,
        };
        try {
            if (isEdit) {
                await updatePurchaseOrder(editingPO.po_id, payload);
            } else {
                await createPurchaseOrder(payload);
            }
            if (isCustomBilling && customBilling.address.trim()) savePOBillingAddress(finalBilling).catch(() => {});
            onSuccess();
        } catch (err) { setError(err.message || "Failed to save"); }
    };

    const allBillingOpts = [...new Set(["3/B, PORTUGUESE CHURCH STREET 2ND FLOOR, KOLKATA 700001", ...billingOptions])];

    return (
        <div className="po-form">
            {error && <div className="api-error">{error}</div>}
            <div className="po-section">
                <h3 className="po-section-title">Supplier Details</h3>
                <div className="po-fields-grid">
                    <div className="po-field po-span2">
                        <label>Supplier Name *</label>
                        <ComboInput value={supplierQuery} onChange={handleCustSelect}
                            options={customers.map(fullName)} placeholder="Type to search or enter name…" id="po-cust" />
                    </div>
                    <div className="po-field">
                        <label>Contact</label>
                        <input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Phone" />
                    </div>
                    <div className="po-field">
                        <label>GST</label>
                        <input value={supplierGst} onChange={e => setSupplierGst(e.target.value)} placeholder="GSTIN" />
                    </div>
                    <div className="po-field po-span2">
                        <label>Email</label>
                        <input value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="Email" />
                    </div>
                </div>
            </div>

            <div className="po-section">
                <h3 className="po-section-title">Company Details</h3>
                <div className="po-fields-grid">
                    <div className="po-field po-span2">
                        <label>Billing Address</label>
                        <select value={isCustomBilling ? "__custom__" : billingAddress}
                            onChange={e => { if (e.target.value === "__custom__") setIsCustomBilling(true); else { setIsCustomBilling(false); setBillingAddress(e.target.value); } }}>
                            {allBillingOpts.map((a,i) => <option key={i} value={a}>{a}</option>)}
                            <option value="__custom__">-- Custom --</option>
                        </select>
                        {isCustomBilling && (<div className="custom-ship-fields" style={{marginTop:6}}>
                            <label className="custom-ship-label">Custom Billing Address</label>
                            <div className="custom-ship-row">
                                <input value={customBilling.address} onChange={e=>setCustomBilling(p=>({...p,address:e.target.value}))} placeholder="Building / Area" style={{flex:2}}/>
                                <input value={customBilling.pincode} onChange={e=>setCustomBilling(p=>({...p,pincode:e.target.value}))} placeholder="Pincode" style={{flex:1}}/>
                            </div>
                            <div className="custom-ship-row">
                                <input value={customBilling.city}  onChange={e=>setCustomBilling(p=>({...p,city:e.target.value}))}  placeholder="City"/>
                                <input value={customBilling.state} onChange={e=>setCustomBilling(p=>({...p,state:e.target.value}))} placeholder="State"/>
                            </div>
                        </div>)}
                    </div>
                    <div className="po-field po-span2">
                        <label>Shipping Address</label>
                        <select value={isCustomShipping ? "__custom__" : shippingAddress}
                            onChange={e => { if (e.target.value === "__custom__") { setIsCustomShipping(true); setShippingAddress(""); } else { setIsCustomShipping(false); setShippingAddress(e.target.value); } }}>
                            <option value="">-- Select --</option>
                            {shippingOptions.map((a,i) => <option key={i} value={a}>{a}</option>)}
                            <option value="__custom__">-- Custom --</option>
                        </select>
                        {isCustomShipping && (<div className="custom-ship-fields" style={{marginTop:6}}>
                            <label className="custom-ship-label">Custom Shipping Address</label>
                            <div className="custom-ship-row">
                                <input value={customShipping.address} onChange={e=>setCustomShipping(p=>({...p,address:e.target.value}))} placeholder="Building / Area" style={{flex:2}}/>
                                <input value={customShipping.pincode} onChange={e=>setCustomShipping(p=>({...p,pincode:e.target.value}))} placeholder="Pincode" style={{flex:1}}/>
                            </div>
                            <div className="custom-ship-row">
                                <input value={customShipping.city}  onChange={e=>setCustomShipping(p=>({...p,city:e.target.value}))}  placeholder="City"/>
                                <input value={customShipping.state} onChange={e=>setCustomShipping(p=>({...p,state:e.target.value}))} placeholder="State"/>
                            </div>
                        </div>)}
                    </div>
                </div>
            </div>

            <div className="po-section">
                <h3 className="po-section-title">Order Details</h3>
                <div className="po-fields-grid">
                    <div className="po-field">
                        <label>Tracking ID</label>
                        <input value={trackingId} onChange={e=>setTrackingId(e.target.value)} placeholder="optional"/>
                    </div>
                    <div className="po-field">
                        <label>Date &amp; Time</label>
                        <div style={{display:"flex",gap:6}}>
                            <input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)} style={{flex:2}}/>
                            <input type="time" value={orderTime} onChange={e=>setOrderTime(e.target.value)} style={{flex:1}}/>
                        </div>
                    </div>
                    <div className="po-field po-span2">
                        <label>Notes</label>
                        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="optional"/>
                    </div>
                </div>
            </div>

            <div className="po-section">
                <h3 className="po-section-title">Items to Order</h3>
                {cartItems.map((item, idx) => (
                    <POCartItemRow key={idx} item={item} index={idx} totalItems={cartItems.length}
                        onUpdate={updateCartItem} onRemove={removeCartItem} />
                ))}
                <button className="multi-add-btn" style={{marginTop:8}} onClick={addCartItem}>+ Add Item</button>
            </div>

            <div className="po-form-actions">
                <button className="cancel-btn" onClick={onClose}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmit}>{isEdit ? "Update Order" : "Place Order"}</button>
            </div>
        </div>
    );
}

function PurchaseOrder({ privileges, createTrigger }) {
    const [orders,    setOrders]    = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState("");
    const [expanded,  setExpanded]  = useState({});
    const [viewMode,  setViewMode]  = useState("all");
    const [showForm,  setShowForm]  = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [invoicePO, setInvoicePO] = useState(null);
    const [editingPO, setEditingPO] = useState(null);
    const [editingItems, setEditingItems] = useState([]);
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [arriveTarget, setArriveTarget] = useState(null);
    const [pwPrompt, setPwPrompt] = useState(null);
    const [searchSupplier, setSearchSupplier] = useState("");
    const [searchTracking, setSearchTracking] = useState("");
    const [searchDateFrom, setSearchDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toLocaleDateString("en-CA"); });
    const [searchDateTo,   setSearchDateTo]   = useState(() => new Date().toLocaleDateString("en-CA"));
    const [searchType, setSearchType] = useState("");
    const initialLoadDone = useRef(false);

    const fetchOrders = useCallback(async (showLoader = false) => {
        if (!initialLoadDone.current || showLoader) setLoading(true);
        try {
            const data = await getPurchaseOrders();
            setOrders(data); setError(""); initialLoadDone.current = true;
        } catch (err) { setError(err.message || "Failed to load"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Open form when triggered from quick actions
    useLayoutEffect(() => { if (createTrigger > 0) setShowForm(true); }, [createTrigger]);

    const toggleExpand = async (poId) => {
        const curr = expanded[poId];
        if (curr?.open) { setExpanded(p => ({...p,[poId]:{...p[poId],open:false}})); return; }
        setExpanded(p => ({...p,[poId]:{open:true,items:[],loading:true}}));
        try {
            const items = await getPurchaseOrderItems(poId);
            setExpanded(p => ({...p,[poId]:{open:true,items,loading:false}}));
        } catch { setExpanded(p => ({...p,[poId]:{open:true,items:[],loading:false}})); }
    };

    const handleAdvanceStatus = async (poId, poiId, newStatus) => {
        try {
            await advancePOItemStatus(poiId, newStatus);
            const items = await getPurchaseOrderItems(poId);
            setExpanded(p => ({...p,[poId]:{...p[poId],items}}));
            const freshOrders = await getPurchaseOrders();
            setOrders(freshOrders);
        } catch (err) { setError(err.message || "Failed"); }
    };

    const handleConfirmPO = async (poId) => {
        setConfirmTarget(null);
        try {
            await confirmPurchaseOrder(poId);
            const items = await getPurchaseOrderItems(poId);
            setExpanded(p => ({...p,[poId]:{...p[poId],items}}));
            const freshOrders = await getPurchaseOrders();
            setOrders(freshOrders);
        } catch (err) { setError(err.message || "Failed to confirm"); }
    };

    const handleToggleAllArrived = async (po) => {
        setArriveTarget(null);
        let items = expanded[po.po_id]?.items;
        if (!items || items.length === 0) {
            items = await getPurchaseOrderItems(po.po_id);
            setExpanded(p => ({...p,[po.po_id]:{open: p[po.po_id]?.open ?? false, items, loading: false}}));
        }
        try {
            for (const item of items) {
                if (item.item_status === "not_arrived") {
                    await advancePOItemStatus(item.poi_id, "arrived");
                }
            }
            const fresh = await getPurchaseOrderItems(po.po_id);
            setExpanded(p => ({...p,[po.po_id]:{...p[po.po_id],items:fresh}}));
            const freshOrders = await getPurchaseOrders();
            setOrders(freshOrders);
        } catch (err) { setError(err.message || "Failed"); }
    };

    const handleUnArrive = async (po, password) => {
        if (password !== "admin") {
            setError("Incorrect password");
            setPwPrompt(null);
            setTimeout(() => setError(""), 2000);
            return;
        }
        setPwPrompt(null);
        let items = expanded[po.po_id]?.items;
        if (!items || items.length === 0) {
            items = await getPurchaseOrderItems(po.po_id);
        }
        const reverted = [];
        try {
            for (const item of items) {
                if (item.item_status === "arrived") {
                    await advancePOItemStatus(item.poi_id, "not_arrived");
                    reverted.push(item.poi_id);
                }
            }
        } catch (err) {
            // Rollback: re-arrive items we already un-arrived
            for (const poiId of reverted) {
                try { await advancePOItemStatus(poiId, "arrived"); } catch {}
            }
            setError(err.message || "Failed — cannot revert, inventory would go negative");
            setTimeout(() => setError(""), 4000);
        }
        // Always refresh to reflect actual state
        const fresh = await getPurchaseOrderItems(po.po_id);
        setExpanded(p => ({...p,[po.po_id]:{...p[po.po_id],items:fresh}}));
        const freshOrders = await getPurchaseOrders();
        setOrders(freshOrders);
    };

    const handleUnArriveItem = async (po, poiId, password) => {
        if (password !== "admin") {
            setError("Incorrect password");
            setPwPrompt(null);
            setTimeout(() => setError(""), 2000);
            return;
        }
        setPwPrompt(null);
        try {
            await advancePOItemStatus(poiId, "not_arrived");
        } catch (err) {
            setError(err.message || "Failed — inventory would go negative");
            setTimeout(() => setError(""), 4000);
        }
        // Always refresh
        const fresh = await getPurchaseOrderItems(po.po_id);
        setExpanded(p => ({...p,[po.po_id]:{...p[po.po_id],items:fresh}}));
        const freshOrders = await getPurchaseOrders();
        setOrders(freshOrders);
    };

    const handleUnconfirm = async (po, password) => {
        if (password !== "admin") {
            setError("Incorrect password");
            setPwPrompt(null);
            setTimeout(() => setError(""), 2000);
            return;
        }
        setPwPrompt(null);
        try {
            await unconfirmPurchaseOrder(po.po_id);
        } catch (err) {
            setError(err.message || "Failed to revert confirmation");
            setTimeout(() => setError(""), 3000);
        }
        // Always refresh
        const items = await getPurchaseOrderItems(po.po_id);
        setExpanded(p => ({...p,[po.po_id]:{...p[po.po_id],items}}));
        const freshOrders = await getPurchaseOrders();
        setOrders(freshOrders);
    };

    const handleDelete = async () => {
        const id = deleteTarget; setDeleteTarget(null);
        try {
            await deletePurchaseOrder(id);
            setOrders(prev => prev.filter(o => o.po_id !== id));
            setExpanded(prev => { const n = {...prev}; delete n[id]; return n; });
        }
        catch (err) { setError(err.message || "Failed to delete"); }
    };

    const handleEditPO = async (po) => {
        let items = expanded[po.po_id]?.items;
        if (!items || items.length === 0) {
            items = await getPurchaseOrderItems(po.po_id);
            setExpanded(p => ({...p,[po.po_id]:{open: p[po.po_id]?.open ?? false, items, loading: false}}));
        }
        setEditingPO(po);
        setEditingItems(items);
        setShowForm(true);
    };

    const handleEditSuccess = async () => {
        setShowForm(false);
        const poId = editingPO?.po_id;
        setEditingPO(null);
        setEditingItems([]);
        // Inline refresh: re-fetch just the orders list and the expanded items for this PO
        const data = await getPurchaseOrders();
        setOrders(data);
        if (poId) {
            const items = await getPurchaseOrderItems(poId);
            setExpanded(p => ({...p,[poId]:{...p[poId], items, loading: false}}));
        }
    };

    const filtered = orders.filter(o => {
        const statusMatch = viewMode === "all" ? true :
            viewMode === "unconfirmed" ? o.all_confirm :
            viewMode === "pending" ? (o.status === "pending" && !o.all_confirm) :
            viewMode === "inprocess" ? o.status === "partial" :
            o.status === "completed";
        const supplierMatch = !searchSupplier.trim() || (o.supplier_name || "").toLowerCase().includes(searchSupplier.toLowerCase());
        const trackingMatch = !searchTracking.trim() || (o.tracking_id || "").toLowerCase().includes(searchTracking.toLowerCase());
        const dtFrom = !searchDateFrom || (o.order_date || "") >= searchDateFrom;
        const dtTo = !searchDateTo || (o.order_date || "").slice(0,10) <= searchDateTo;
        return statusMatch && supplierMatch && trackingMatch && dtFrom && dtTo;
    });
    const fmt = (v, d=2) => v != null ? parseFloat(v).toFixed(d) : "—";

    return (
        <div className="po-container">
            <ConfirmDialog open={!!deleteTarget} variant="danger" title="Delete Purchase Order"
                message="Delete this purchase order?" confirmLabel="Yes, Delete" cancelLabel="Cancel"
                onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

            <ConfirmDialog open={!!confirmTarget} title="Confirm Purchase Order"
                message="Are you sure you want to confirm this PO? Items will move to 'Not Arrived' state."
                confirmLabel="Yes, Confirm" cancelLabel="Cancel"
                onConfirm={() => handleConfirmPO(confirmTarget)} onCancel={() => setConfirmTarget(null)} />

            <ConfirmDialog open={!!arriveTarget} title="Mark as Arrived"
                message="Mark all items as arrived? They will be added to inventory."
                confirmLabel="Yes, Mark Arrived" cancelLabel="Cancel"
                onConfirm={() => handleToggleAllArrived(arriveTarget)} onCancel={() => setArriveTarget(null)} />

            <PasswordPrompt open={!!pwPrompt} title="Password Required"
                message={pwPrompt?.action === "unconfirm" ? "Enter password to revert confirmation." : "Enter password to revert arrival status."}
                onConfirm={(pw) => {
                    if (pwPrompt?.action === "unarrive") handleUnArrive(pwPrompt.po, pw);
                    else if (pwPrompt?.action === "unarrive_item") handleUnArriveItem(pwPrompt.po, pwPrompt.poiId, pw);
                    else if (pwPrompt?.action === "unconfirm") handleUnconfirm(pwPrompt.po, pw);
                    else setPwPrompt(null);
                }}
                onCancel={() => setPwPrompt(null)} />

            {invoicePO && (
                <ModalOverlay open={true} title="Purchase Order Invoice" onClose={() => setInvoicePO(null)}>
                    <POInvoicePreview po={invoicePO} onClose={() => setInvoicePO(null)} />
                </ModalOverlay>
            )}

            <div className="po-header-row">
                <h1>Purchase Orders</h1>
                <div className="ol-toggle">
                    <button className={`ol-toggle-btn${viewMode==="all"?" active":""}`} onClick={()=>setViewMode("all")}>All</button>
                    <button className={`ol-toggle-btn${viewMode==="unconfirmed"?" active":""}`} onClick={()=>setViewMode("unconfirmed")}>Unconfirmed</button>
                    <button className={`ol-toggle-btn${viewMode==="pending"?" active":""}`} onClick={()=>setViewMode("pending")}>Pending</button>
                    <button className={`ol-toggle-btn${viewMode==="inprocess"?" active":""}`} onClick={()=>setViewMode("inprocess")}>In-Process</button>
                    <button className={`ol-toggle-btn${viewMode==="completed"?" active":""}`} onClick={()=>setViewMode("completed")}>Completed</button>
                </div>
                <div className="order-list-toolbar">
                    <button className="ol-refresh-btn" onClick={()=>{setExpanded({});fetchOrders(true);}} disabled={loading}>↻</button>
                    <button className="ol-clear-btn" onClick={()=>{setViewMode("all");setSearchSupplier("");setSearchTracking("");setSearchType("");const d=new Date();d.setMonth(d.getMonth()-3);setSearchDateFrom(d.toLocaleDateString("en-CA"));setSearchDateTo(new Date().toLocaleDateString("en-CA"));}}>✕ Clear</button>
                </div>
            </div>
            <div className="po-search-row">
                <div className="po-search-field"><label>Supplier</label><input value={searchSupplier} onChange={e=>setSearchSupplier(e.target.value)} placeholder="Name…" className="po-search-input" /></div>
                <div className="po-search-field"><label>Tracking ID</label><input value={searchTracking} onChange={e=>setSearchTracking(e.target.value)} placeholder="ID…" className="po-search-input" /></div>
                <div className="po-search-field"><label>Date From</label><input type="date" value={searchDateFrom} onChange={e=>setSearchDateFrom(e.target.value)} className="po-search-input" /></div>
                <div className="po-search-field"><label>Date To</label><input type="date" value={searchDateTo} onChange={e=>setSearchDateTo(e.target.value)} className="po-search-input" /></div>
            </div>
            {error && <div className="api-error">{error}</div>}
            {showForm && (
                <ModalOverlay open={true} title={editingPO ? `Edit PO #${editingPO.po_id}` : "Place Purchase Order"} onClose={()=>{setShowForm(false);setEditingPO(null);setEditingItems([]);}}>
                    <PlacePOForm
                        onClose={()=>{setShowForm(false);setEditingPO(null);setEditingItems([]);}}
                        onSuccess={editingPO ? handleEditSuccess : ()=>{setShowForm(false);setEditingPO(null);setEditingItems([]);fetchOrders(true);setExpanded({});}}
                        editingPO={editingPO}
                        editingItems={editingItems}
                    />
                </ModalOverlay>
            )}
            {loading && <div className="ol-placeholder">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="ol-placeholder">No purchase orders found.</div>}
            {!loading && filtered.length > 0 && (
                <div className="ol-table-scroll">
                    <table className="ol-table">
                        <thead><tr>
                            <th>PO ID</th><th>Supplier</th><th>Tracking</th>
                            <th>Order Date</th><th style={{textAlign:"center"}}>Status</th><th className="col-actions"></th>
                        </tr></thead>
                        <tbody>
                            {filtered.map(po => {
                                const exp = expanded[po.po_id];
                                const isOpen = exp?.open ?? false;
                                const isConfirm = po.all_confirm;
                                const hasArrived = po.has_arrived;
                                const allArr = po.arrived_count === po.total_items && po.total_items > 0;
                                return (
                                    <Fragment key={po.po_id}>
                                        <tr>
                                            <td>{po.po_id}</td>
                                            <td>{po.supplier_name}</td>
                                            <td>{po.tracking_id || "—"}</td>
                                            <td>{po.order_date ? po.order_date.slice(0,10) : "—"}</td>
                                            <td style={{textAlign:"center"}}><span className={`ol-status ol-status--${po.status === "partial" ? "inprocess" : po.all_confirm ? "unconfirmed" : po.status}`}>{po.all_confirm ? "Unconfirmed" : po.status === "partial" ? "In-Process" : po.status}</span></td>
                                            <td className="col-actions" style={{textAlign:"right"}}>
                                                {/* PO Invoice - generate privilege */}
                                                {privileges?.generate !== false && <button className="po-invoice-btn" onClick={() => setInvoicePO(po)}
                                                    title="PO Invoice">📄</button>}
                                                {/* Confirm toggle - status privilege */}
                                                {privileges?.status !== false && <IOSToggle
                                                    checked={!isConfirm}
                                                    disabled={allArr}
                                                    label="Confirm"
                                                    onChange={(checked) => {
                                                        if (checked) setConfirmTarget(po.po_id);
                                                        else setPwPrompt({ action: "unconfirm", po });
                                                    }}
                                                />}
                                                {/* Arrived toggle - status privilege */}
                                                {privileges?.status !== false && <IOSToggle
                                                    checked={allArr}
                                                    disabled={isConfirm || (allArr && isArrivedOver24h(po.first_arrived_at))}
                                                    label="Arrived"
                                                    onChange={(checked) => {
                                                        if (checked) setArriveTarget(po);
                                                        else setPwPrompt({ action: "unarrive", po });
                                                    }}
                                                />}
                                                {/* Edit - disabled when arrived */}
                                                {privileges?.edit !== false && <button className="po-edit-btn" onClick={() => handleEditPO(po)}
                                                    disabled={hasArrived} title="Edit PO">✏️</button>}
                                                {/* Delete */}
                                                {privileges?.delete !== false && <button className="ol-delete-btn" onClick={()=>setDeleteTarget(po.po_id)}>🗑</button>}
                                                <button className="ol-details-btn" onClick={()=>toggleExpand(po.po_id)}>
                                                    {isOpen ? "▲ Hide" : "▼ Details"}</button>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr className="ol-items-row"><td colSpan={6} style={{padding:0}}>
                                                {exp.loading ? <div className="ol-items-loading">Loading…</div> : (
                                                    <table className="ol-items-table">
                                                        <thead><tr>
                                                            <th>Type</th><th>Sub Type</th><th>Dim</th>
                                                            <th>Qty/Unit</th><th>Units</th><th>Cost</th>
                                                            <th>Desc</th><th style={{textAlign:"center"}}>Arrived</th>
                                                        </tr></thead>
                                                        <tbody>
                                                            {exp.items.map(item => {
                                                                const status = item.item_status || "confirm";
                                                                const over24 = status === "arrived" && isArrivedOver24h(item.arrived_at);
                                                                return (
                                                                    <tr key={item.poi_id}>
                                                                        <td>{item.sku_type}</td>
                                                                        <td>{item.sku_subtype}</td>
                                                                        <td>{item.sku_dim || "-"}</td>
                                                                        <td>{fmt(item.sku_quantity,3)}</td>
                                                                        <td>{item.sku_units}</td>
                                                                        <td>{item.sku_cost_price?`₹${fmt(item.sku_cost_price)}`:"—"}</td>
                                                                        <td>{item.sku_desc||"—"}</td>
                                                                        <td style={{textAlign:"center"}}>
                                                                            <IOSToggle
                                                                                checked={status === "arrived"}
                                                                                disabled={status === "confirm" || over24}
                                                                                label="Arrived"
                                                                                onChange={(checked) => {
                                                                                    if (checked) handleAdvanceStatus(po.po_id, item.poi_id, "arrived");
                                                                                    else setPwPrompt({ action: "unarrive_item", po, poiId: item.poi_id });
                                                                                }}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </td></tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {privileges?.create !== false && <button className="ol-fab" onClick={()=>setShowForm(true)} title="New purchase order">+</button>}
        </div>
    );
}

export default PurchaseOrder;
