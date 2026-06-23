import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import "../styles/purchase-order.css";
import {
    getPurchaseOrders, createPurchaseOrder, deletePurchaseOrder,
    getPurchaseOrderItems, togglePOItemArrived,
    getPOShippingAddresses, getPOBillingAddresses, savePOBillingAddress,
    getCustomers
} from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ModalOverlay from "../components/ModalOverlay";
import SelectInput from "../components/SelectInput";
import ComboInput from "../components/ComboInput";
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
                    <SelectInput value={item.sku_type}
                        onChange={e => onUpdate(index, "sku_type", e.target.value)}
                        options={types} placeholder="Type…" />
                </div>
                <div className="po-cart-field po-cart-field-wide">
                    <label>Sub Type</label>
                    <SelectInput value={item.sku_subtype}
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

function PlacePOForm({ onClose, onSuccess }) {
    const [customers,       setCustomers]       = useState([]);
    const [supplierQuery,   setSupplierQuery]   = useState("");
    const [selectedCust,    setSelectedCust]    = useState(null);
    const [supplierName,    setSupplierName]    = useState("");
    const [supplierContact, setSupplierContact] = useState("");
    const [supplierGst,     setSupplierGst]     = useState("");
    const [supplierEmail,   setSupplierEmail]   = useState("");

    const [billingAddress,   setBillingAddress]   = useState("3/B, PORTUGUESE CHURCH STREET 2ND FLOOR, KOLKATA 700001");
    const [billingOptions,   setBillingOptions]   = useState([]);
    const [isCustomBilling,  setIsCustomBilling]  = useState(false);
    const [customBilling,    setCustomBilling]    = useState({ address:"", pincode:"", city:"", state:"" });

    const [shippingAddress,  setShippingAddress]  = useState("");
    const [shippingOptions,  setShippingOptions]  = useState([]);
    const [isCustomShipping, setIsCustomShipping] = useState(false);
    const [customShipping,   setCustomShipping]   = useState({ address:"", pincode:"", city:"", state:"" });

    const [trackingId, setTrackingId] = useState("");
    const [orderDate,  setOrderDate]  = useState(new Date().toISOString().slice(0,10));
    const [orderTime,  setOrderTime]  = useState(new Date().toTimeString().slice(0,5));
    const [notes,      setNotes]      = useState("");
    const [cartItems,  setCartItems]  = useState([emptyItem()]);
    const [error,      setError]      = useState("");

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
            ? [customBilling.address,  customBilling.city,  customBilling.state,  customBilling.pincode ].filter(Boolean).join(", ")
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
        try {
            await createPurchaseOrder({
                supplier_name: supplierName, supplier_contact: supplierContact || null,
                supplier_gst: supplierGst || null, supplier_email: supplierEmail || null,
                billing_address: finalBilling, shipping_address: finalShipping || null,
                tracking_id: trackingId || null,
                order_date: orderDate ? `${orderDate}T${orderTime}:00` : null,
                notes: notes || null, items: expandedItems,
            });
            if (isCustomBilling && customBilling.address.trim()) savePOBillingAddress(finalBilling).catch(() => {});
            onSuccess();
        } catch (err) { setError(err.message || "Failed to place order"); }
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
                <button className="submit-btn" onClick={handleSubmit}>Place Order</button>
            </div>
        </div>
    );
}

function PurchaseOrder() {
    const [orders,    setOrders]    = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState("");
    const [expanded,  setExpanded]  = useState({});
    const [viewMode,  setViewMode]  = useState("all");
    const [showForm,  setShowForm]  = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
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

    const toggleExpand = async (poId) => {
        const curr = expanded[poId];
        if (curr?.open) { setExpanded(p => ({...p,[poId]:{...p[poId],open:false}})); return; }
        setExpanded(p => ({...p,[poId]:{open:true,items:[],loading:true}}));
        try {
            const items = await getPurchaseOrderItems(poId);
            setExpanded(p => ({...p,[poId]:{open:true,items,loading:false}}));
        } catch { setExpanded(p => ({...p,[poId]:{open:true,items:[],loading:false}})); }
    };

    const handleToggleArrived = async (poId, poiId, arrived) => {
        try {
            await togglePOItemArrived(poiId, arrived);
            const items = await getPurchaseOrderItems(poId);
            setExpanded(p => ({...p,[poId]:{...p[poId],items}}));
            fetchOrders();
        } catch (err) { setError(err.message || "Failed"); }
    };

    const handleToggleAllArrived = async (po) => {
        const items = expanded[po.po_id]?.items || [];
        const allArrived = items.length > 0 && items.every(i => i.arrived);
        try {
            for (const item of items) {
                if (item.arrived === allArrived) await togglePOItemArrived(item.poi_id, !allArrived);
            }
            const fresh = await getPurchaseOrderItems(po.po_id);
            setExpanded(p => ({...p,[po.po_id]:{...p[po.po_id],items:fresh}}));
            fetchOrders();
        } catch (err) { setError(err.message || "Failed"); }
    };

    const handleDelete = async () => {
        const id = deleteTarget; setDeleteTarget(null);
        try { await deletePurchaseOrder(id); fetchOrders(); }
        catch (err) { setError(err.message || "Failed to delete"); }
    };

    const filtered = orders.filter(o =>
        viewMode === "all" ? true :
        viewMode === "pending" ? (o.status === "pending" || o.status === "partial") :
        o.status === "completed"
    );
    const fmt = (v, d=2) => v != null ? parseFloat(v).toFixed(d) : "—";

    return (
        <div className="po-container">
            <ConfirmDialog open={!!deleteTarget} variant="danger" title="Delete Purchase Order"
                message="Delete this purchase order?" confirmLabel="Yes, Delete" cancelLabel="Cancel"
                onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
            <div className="po-header-row">
                <h1>Purchase Orders</h1>
                <div className="ol-toggle">
                    <button className={`ol-toggle-btn${viewMode==="all"?" active":""}`} onClick={()=>setViewMode("all")}>All</button>
                    <button className={`ol-toggle-btn${viewMode==="pending"?" active":""}`} onClick={()=>setViewMode("pending")}>Pending</button>
                    <button className={`ol-toggle-btn${viewMode==="completed"?" active":""}`} onClick={()=>setViewMode("completed")}>Completed</button>
                </div>
                <div className="order-list-toolbar">
                    <button className="ol-refresh-btn" onClick={()=>{setExpanded({});fetchOrders(true);}} disabled={loading}>↻</button>
                    <button className="ol-clear-btn" onClick={()=>setViewMode("all")}>✕ Clear</button>
                </div>
            </div>
            {error && <div className="api-error">{error}</div>}
            {showForm && (
                <ModalOverlay open={true} title="Place Purchase Order" onClose={()=>setShowForm(false)}>
                    <PlacePOForm onClose={()=>setShowForm(false)} onSuccess={()=>{setShowForm(false);fetchOrders(true);}} />
                </ModalOverlay>
            )}
            {loading && <div className="ol-placeholder">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="ol-placeholder">No purchase orders found.</div>}
            {!loading && filtered.length > 0 && (
                <div className="ol-table-scroll">
                    <table className="ol-table">
                        <thead><tr>
                            <th>PO ID</th><th>Supplier</th><th>Tracking</th>
                            <th>Order Date</th><th>Status</th><th className="col-actions"></th>
                        </tr></thead>
                        <tbody>
                            {filtered.map(po => {
                                const exp = expanded[po.po_id];
                                const isOpen = exp?.open ?? false;
                                const allArrived = exp?.items?.length > 0 && exp.items.every(i => i.arrived);
                                return (
                                    <Fragment key={po.po_id}>
                                        <tr>
                                            <td>{po.po_id}</td>
                                            <td>{po.supplier_name}</td>
                                            <td>{po.tracking_id || "—"}</td>
                                            <td>{po.order_date ? po.order_date.slice(0,10) : "—"}</td>
                                            <td><span className={`ol-status ol-status--${po.status}`}>{po.status}</span></td>
                                            <td className="col-actions">
                                                <button className={`po-arrive-all-btn${po.status==="completed"?" arrived":""}`}
                                                    onClick={async ()=>{
                                                        let items = expanded[po.po_id]?.items;
                                                        if (!items || items.length === 0) {
                                                            items = await getPurchaseOrderItems(po.po_id);
                                                            setExpanded(p=>({...p,[po.po_id]:{open:p[po.po_id]?.open??false,items,loading:false}}));
                                                        }
                                                        const allArr = items.every(i=>i.arrived);
                                                        for (const item of items) {
                                                            if (item.arrived === allArr) await togglePOItemArrived(item.poi_id, !allArr);
                                                        }
                                                        const fresh = await getPurchaseOrderItems(po.po_id);
                                                        setExpanded(p=>({...p,[po.po_id]:{...p[po.po_id],items:fresh}}));
                                                        fetchOrders();
                                                    }}>
                                                    {po.status==="completed" ? "✓ Arrived" : "✕ Not Arrived"}</button>
                                                <button className="ol-delete-btn" onClick={()=>setDeleteTarget(po.po_id)}>🗑</button>
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
                                                            <th>Desc</th><th>Status</th><th></th>
                                                        </tr></thead>
                                                        <tbody>
                                                            {exp.items.map(item => (
                                                                <tr key={item.poi_id}>
                                                                    <td>{item.sku_type}</td>
                                                                    <td>{item.sku_subtype}</td>
                                                                    <td>{item.sku_dim}</td>
                                                                    <td>{fmt(item.sku_quantity,3)}</td>
                                                                    <td>{item.sku_units}</td>
                                                                    <td>{item.sku_cost_price?`₹${fmt(item.sku_cost_price)}`:"—"}</td>
                                                                    <td>{item.sku_desc||"—"}</td>
                                                                    <td><span className={`ol-status ol-status--${item.arrived?"completed":"pending"}`}>
                                                                        {item.arrived?"Arrived":"Pending"}</span></td>
                                                                    <td>
                                                                        <button className={`po-arrive-btn${item.arrived?" arrived":""}`}
                                                                            onClick={()=>handleToggleArrived(po.po_id,item.poi_id,!item.arrived)}>
                                                                            {item.arrived?"✓ Delivered":"✕ Not delivered"}</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
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
            <button className="ol-fab" onClick={()=>setShowForm(true)} title="New purchase order">+</button>
        </div>
    );
}

export default PurchaseOrder;
