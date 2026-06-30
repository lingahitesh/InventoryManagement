import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import "../styles/order-list.css";
import { getOrders, getOrderItems, getOrderFull, deleteOrder, getCustomers, toggleOrderItemReady } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ModalOverlay from "../components/ModalOverlay";
import ComboInput from "../components/ComboInput";
import PurchaseOrder from "./PurchaseOrder";
function formatOrderNo(orderId)
{
    const now = new Date();
    const year = now.getFullYear() % 100;
    const month = now.getMonth() + 1;

    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = fyStart + 1;

    return `CP/${String(orderId).padStart(4, "0")}/${fyStart}-${String(fyEnd).padStart(2, "0")}`;
}
function SalesOrderList({ onEditOrder, onNewOrder, refreshKey, onOrderDelete, privileges })
{
    const [orders,   setOrders]   = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");
    const [expanded, setExpanded] = useState({});
    const [viewMode, setViewMode] = useState("all"); // "all" | "pending" | "completed"

    const [searchCustomer, setSearchCustomer] = useState("");
    const [searchOrderId,  setSearchOrderId]  = useState("");
    const [searchDateFrom, setSearchDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toLocaleDateString("en-CA"); });
    const [searchDateTo,   setSearchDateTo]   = useState(() => new Date().toLocaleDateString("en-CA"));
    const [searchContact,  setSearchContact]  = useState("");
    const [customersList,  setCustomersList]  = useState([]);
    const [deleteTarget,   setDeleteTarget]   = useState(null);
    const [showPiDialog,   setShowPiDialog]   = useState(false);
    const [piOrder,        setPiOrder]        = useState(null);
    const [piItems,        setPiItems]        = useState([]);
    const [piSelected,     setPiSelected]     = useState([]);
    const [piIncludeDelivery, setPiIncludeDelivery] = useState(true);

    const initialLoadDone = useRef(false);

    const fetchOrders = useCallback(async (showLoader = false) =>
    {
        if (!initialLoadDone.current || showLoader) setLoading(true);
        setError("");
        try {
            const [ordersData, custsData] = await Promise.all([getOrders(), getCustomers()]);
            setOrders(ordersData);
            setCustomersList(custsData);
            setError("");
            initialLoadDone.current = true;
        }
        catch (err) { setError(err.message || "Failed to load orders"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders, refreshKey]);

    // Auto-retry on focus if errored
    useEffect(() => {
        const retry = () => { if (error) fetchOrders(); };
        window.addEventListener("focus", retry);
        return () => window.removeEventListener("focus", retry);
    }, [error, fetchOrders]);

    const toggleExpand = async (orderId) =>
    {
        const curr = expanded[orderId];
        if (curr?.open) { setExpanded(prev => ({ ...prev, [orderId]: { ...prev[orderId], open: false } })); return; }
        setExpanded(prev => ({ ...prev, [orderId]: { open: true, items: [], loading: true, error: "" } }));
        try {
            const items = await getOrderItems(orderId);
            setExpanded(prev => ({ ...prev, [orderId]: { open: true, items, loading: false, error: "" } }));
        } catch (err) {
            setExpanded(prev => ({ ...prev, [orderId]: { open: true, items: [], loading: false, error: err.message } }));
        }
    };

    const handleEdit = async (order) =>
    {
        try {
            const full = await getOrderFull(order.order_id);
            onEditOrder(full);
        } catch (err) {
            setError(err.message || "Failed to load order for editing");
        }
    };

    const handleDelete = (order) => setDeleteTarget(order);

    const confirmDelete = async () =>
    {
        const order = deleteTarget;
        setDeleteTarget(null);
        try {
            await deleteOrder(order.order_id);
            fetchOrders();
            if (onOrderDelete) onOrderDelete();
        } catch (err) {
            setError(err.message || "Failed to delete order");
        }
    };

    const handleToggleReady = async (orderId, itemId, isReady) => {
        try {
            await toggleOrderItemReady(orderId, itemId, isReady);
            const items = await getOrderItems(orderId);
            setExpanded(prev => ({ ...prev, [orderId]: { ...prev[orderId], items, loading: false } }));
            fetchOrders(); // refresh is_all_ready in main row
        } catch (err) { setError(err.message || "Failed to toggle ready"); }
    };

    const filtered = orders.filter(o =>
    {
        // Status filter
        const statusMatch = viewMode === "all" ? true
            : viewMode === "pending"
                ? (o.dispatch_status === "pending")
                : viewMode === "inprocess"
                    ? (o.dispatch_status === "partial")
                    : (o.dispatch_status === "completed");
        const nm = !searchCustomer.trim() || (o.customer_name || "").toLowerCase().includes(searchCustomer.toLowerCase());
        const idMatch = !searchOrderId.trim() || String(o.order_id).includes(searchOrderId.trim());
        const dtFrom = !searchDateFrom || (o.order_date || "") >= searchDateFrom;
        const dtTo   = !searchDateTo   || (o.order_date || "").slice(0,10) <= searchDateTo;
        let contactMatch = true;
        if (searchContact.trim())
        {
            const matchingIds = customersList
                .filter(c => (c.contact||"").includes(searchContact))
                .map(c => c.customer_id);
            contactMatch = matchingIds.includes(o.customer_id);
        }
        return statusMatch && nm && idMatch && dtFrom && dtTo && contactMatch;
    });

    const fmt    = (v, d = 2) => v != null ? parseFloat(v).toFixed(d) : "—";
    const fmtInt = (v)        => v != null ? parseInt(v) : "—";

    return (
        <div className="order-list-container">
            <ConfirmDialog
                open={!!deleteTarget}
                variant="danger"
                title="Delete Order"
                message={deleteTarget ? <>Delete Order <strong>#{deleteTarget.order_id}</strong>? This will restore inventory. This cannot be undone.</> : ""}
                confirmLabel="Yes, Delete"
                cancelLabel="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* ── PI Dialog ── */}
            {showPiDialog && piOrder && (
                <ModalOverlay open={true} title={`Proforma Invoice — Order #${piOrder.order_id}`}
                    onClose={() => setShowPiDialog(false)}>
                    <div className="pi-dialog">
                        <div className="pi-dialog-body">
                            {/* Item selection */}
                            <div className="pi-items-section">
                                <h4>Select Items for Invoice</h4>
                                <div className="pi-select-all">
                                    <label>
                                        <input type="checkbox"
                                            checked={piSelected.length === piItems.length}
                                            onChange={e => setPiSelected(e.target.checked ? piItems.map(i => i.item_id) : [])} />
                                        Select All
                                    </label>
                                </div>
                                <table className="pi-items-table">
                                    <thead>
                                        <tr><th></th><th>Type</th><th>Sub Type</th><th>Dim</th><th>Units</th><th>Qty</th><th>Price</th></tr>
                                    </thead>
                                    <tbody>
                                        {piItems.map(item => (
                                            <tr key={item.item_id}>
                                                <td><input type="checkbox" checked={piSelected.includes(item.item_id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setPiSelected(p => [...p, item.item_id]);
                                                        else setPiSelected(p => p.filter(id => id !== item.item_id));
                                                    }} /></td>
                                                <td>{item.sku_type}</td>
                                                <td>{item.sku_subtype}</td>
                                                <td>{item.sku_dim}</td>
                                                <td>{item.units_ordered}</td>
                                                <td>{fmt(item.batch_qty_kg, 3)}</td>
                                                <td>{fmt(item.selling_price)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="pi-delivery-check">
                                    {piOrder.delivery_charge > 0 && (
                                        <label>
                                            <input type="checkbox" checked={piIncludeDelivery}
                                                onChange={e => setPiIncludeDelivery(e.target.checked)} />
                                            Include Delivery Charge
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Preview iframe */}
                            <div className="pi-preview">
                                <iframe
                                    title="PI Preview"
                                    src={`/api/orders/${piOrder.order_id}/invoice${(() => {
                                        const params = new URLSearchParams();
                                        if (piSelected.length < piItems.length) params.set("item_ids", piSelected.join(","));
                                        if (!piIncludeDelivery) params.set("no_delivery", "1");
                                        const qs = params.toString();
                                        return qs ? `?${qs}` : "";
                                    })()}`}
                                    style={{ width: "100%", height: "500px", border: "1px solid #ddd", borderRadius: 8 }}
                                />
                            </div>
                        </div>

                        <div className="pi-dialog-actions">
                            <button className="cancel-btn" onClick={() => setShowPiDialog(false)}>Close</button>
                            <button className="submit-btn" onClick={() => {
                                const params = new URLSearchParams();
                                if (piSelected.length < piItems.length) params.set("item_ids", piSelected.join(","));
                                if (!piIncludeDelivery) params.set("no_delivery", "1");
                                const qs = params.toString();
                                window.open(`/api/orders/${piOrder.order_id}/invoice${qs ? `?${qs}` : ""}`, "_blank");
                            }}>📥 Download</button>
                            <button className="submit-btn" style={{ background: "#2e7d32" }} onClick={() => {
                                const params = new URLSearchParams();
                                if (piSelected.length < piItems.length) params.set("item_ids", piSelected.join(","));
                                if (!piIncludeDelivery) params.set("no_delivery", "1");
                                const qs = params.toString();
                                const w = window.open(`/api/orders/${piOrder.order_id}/invoice${qs ? `?${qs}` : ""}`, "_blank");
                                setTimeout(() => { if (w) w.print(); }, 1000);
                            }}>🖨 Print</button>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            <div className="order-list-header">
                <h1>Sales Orders</h1>
                <div className="ol-toggle">
                    <button className={`ol-toggle-btn${viewMode === "all" ? " active" : ""}`}
                        onClick={() => setViewMode("all")}>All</button>
                    <button className={`ol-toggle-btn${viewMode === "pending" ? " active" : ""}`}
                        onClick={() => setViewMode("pending")}>Pending</button>
                    <button className={`ol-toggle-btn${viewMode === "inprocess" ? " active" : ""}`}
                        onClick={() => setViewMode("inprocess")}>In-Process</button>
                    <button className={`ol-toggle-btn${viewMode === "dispatched" ? " active" : ""}`}
                        onClick={() => setViewMode("dispatched")}>Dispatched</button>
                </div>
                <div className="order-list-toolbar">
                    <button className="ol-refresh-btn" onClick={() => { setExpanded({}); fetchOrders(true); }} disabled={loading}>↻</button>
                    <button className="ol-clear-btn" onClick={() => { setSearchCustomer(""); setSearchOrderId(""); setSearchDateFrom(""); setSearchDateTo(""); setSearchContact(""); }}>✕ Clear</button>
                </div>
            </div>

            {error && <div className="ol-error">{error}</div>}

            <div className="ol-search-bar">
                <div className="ol-search-field"><label>Order ID</label>
                    <input value={searchOrderId} onChange={e => setSearchOrderId(e.target.value)} placeholder="ID…" />
                </div>
                <div className="ol-search-field"><label>Customer</label>
                    <ComboInput value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)}
                        options={customersList.map(c => [c.fname, c.mname, c.lname].filter(Boolean).join(" "))}
                        placeholder="Name…" id="ol-cust" />
                </div>
                <div className="ol-search-field"><label>Contact</label>
                    <ComboInput value={searchContact} onChange={e => setSearchContact(e.target.value)}
                        options={[...new Set(customersList.map(c => c.contact).filter(Boolean))]}
                        placeholder="Phone…" id="ol-contact" />
                </div>
                <div className="ol-search-field"><label>Date From</label>
                    <input type="date" value={searchDateFrom} onChange={e => setSearchDateFrom(e.target.value)} />
                </div>
                <div className="ol-search-field"><label>Date To</label>
                    <input type="date" value={searchDateTo} onChange={e => setSearchDateTo(e.target.value)} />
                </div>
            </div>

            {loading && <div className="ol-placeholder">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="ol-placeholder">No orders found.</div>}

            {!loading && filtered.length > 0 && (
                <div className="ol-table-scroll">
                    <table className="ol-table">
                        <thead>
                            <tr>
                                <th>Invoice No.</th>
                                <th>Customer</th>
                                <th>Shipping Address</th>
                                <th>Order Date</th>
                                <th className="th-qty">Units</th>
                                <th className="th-qty">Qty (kgs)</th>
                                <th className="th-price">Subtotal (₹)</th>
                                <th className="th-price">Incl. GST (₹)</th>
                                <th style={{textAlign:"center"}}>Status</th>
                                <th className="col-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(o =>
                            {
                                const exp = expanded[o.order_id];
                                const isOpen = exp?.open ?? false;
                                return (
                                    <Fragment key={o.order_id}>
                                        <tr className={o.is_all_ready && o.dispatch_status !== "completed" ? "ol-row-ready" : ""}>
                                            <td>{formatOrderNo(o.order_id)}</td>
                                            <td>{o.customer_name}</td>
                                            <td>{o.shipping_address || "—"}</td>
                                            <td>{o.order_date ? o.order_date.slice(0, 10) : "—"}</td>
                                            <td className="td-qty">{fmtInt(viewMode === "pending" ? o.pending_units : viewMode === "completed" ? o.dispatched_units : o.total_units)}</td>
                                            <td className="td-qty">{fmt(viewMode === "pending" ? o.pending_qty : viewMode === "completed" ? o.dispatched_qty : o.total_qty, 3)}</td>
                                            <td className="td-price">{fmt(viewMode === "pending" ? o.pending_amount : viewMode === "completed" ? o.dispatched_amount : o.total_amount)}</td>
                                            <td className="td-price" style={{ fontWeight: 700 }}>{fmt(
                                                viewMode === "pending" ? (o.pending_amount + (o.delivery_charge || 0)) * 1.18 :
                                                viewMode === "completed" ? (o.dispatched_amount + (o.delivery_charge || 0)) * 1.18 :
                                                o.total_with_gst
                                            )}</td>
                                            <td style={{textAlign:"center"}}><span className={`ol-status ol-status--${o.dispatch_status === "partial" ? "inprocess" : o.dispatch_status === "completed" ? "dispatched" : (o.dispatch_status || "pending")}`}>{o.dispatch_status === "partial" ? "In-Process" : o.dispatch_status === "completed" ? "Dispatched" : (o.dispatch_status || "pending")}</span></td>
                                            <td className="col-actions">
                                                {privileges?.status !== false && <button className={`ol-ready-btn${o.is_all_ready || o.dispatch_status === "completed" ? " ready" : ""}`}
                                                    disabled={o.dispatch_status === "completed"}
                                                    onClick={async () => {
                                                        let items = expanded[o.order_id]?.items;
                                                        if (!items || items.length === 0) {
                                                            items = await getOrderItems(o.order_id);
                                                            setExpanded(prev=>({...prev,[o.order_id]:{open: prev[o.order_id]?.open ?? false, items, loading:false}}));
                                                        }
                                                        for (const item of items) {
                                                            if (item.is_ready === o.is_all_ready) await toggleOrderItemReady(o.order_id, item.item_id, !o.is_all_ready);
                                                        }
                                                        await fetchOrders();
                                                        if (expanded[o.order_id]?.open) {
                                                            const fresh = await getOrderItems(o.order_id);
                                                            setExpanded(prev=>({...prev,[o.order_id]:{...prev[o.order_id],items:fresh}}));
                                                        }
                                                    }}>
                                                    {o.is_all_ready || o.dispatch_status === "completed" ? "✓" : "✕"}
                                                </button>}
                                                {privileges?.generate !== false && <button className="ol-pi-btn" onClick={async () => {
                                                    // Load items for PI dialog
                                                    let items = expanded[o.order_id]?.items;
                                                    if (!items || items.length === 0) {
                                                        items = await getOrderItems(o.order_id);
                                                    }
                                                    // Pre-select based on viewMode
                                                    const preSelected = viewMode === "completed"
                                                        ? items.filter(i => i.units_dispatched > 0).map(i => i.item_id)
                                                        : viewMode === "pending"
                                                            ? items.filter(i => i.units_remaining > 0).map(i => i.item_id)
                                                            : items.map(i => i.item_id);
                                                    setPiOrder(o);
                                                    setPiItems(items);
                                                    setPiSelected(preSelected);
                                                    setShowPiDialog(true);
                                                }} title="Proforma Invoice">📄</button>}
                                                {privileges?.edit !== false && <button className="ol-edit-btn" disabled={o.dispatch_status === "completed"} onClick={() => handleEdit(o)}>✎</button>}
                                                {privileges?.delete !== false && <button className="ol-delete-btn" onClick={() => handleDelete(o)}>🗑</button>}
                                                <button className="ol-details-btn" onClick={() => toggleExpand(o.order_id)}>
                                                    {isOpen ? "▲ Hide" : "▼ Details"}
                                                </button>
                                            </td>
                                        </tr>

                                        {isOpen && (
                                            <tr className="ol-items-row">
                                                <td colSpan={10} style={{ padding: 0 }}>
                                                    {exp.loading && <div className="ol-items-loading">Loading items…</div>}
                                                    {exp.error && <div className="ol-items-error">{exp.error}</div>}
                                                    {!exp.loading && exp.items.length === 0 && <div className="ol-items-loading">No items.</div>}
                                                    {!exp.loading && exp.items.length > 0 && (() => {
                                                        const viewItems = viewMode === "completed"
                                                            ? exp.items.filter(i => i.units_dispatched > 0)
                                                            : viewMode === "pending"
                                                                ? exp.items.filter(i => i.units_remaining > 0)
                                                                : exp.items;
                                                        if (viewItems.length === 0) return <div className="ol-items-loading">No items for this view.</div>;
                                                        const subtotal = parseFloat(o.total_amount) || 0;
                                                        const dc = parseFloat(o.delivery_charge) || 0;
                                                        const taxable = subtotal + dc;
                                                        const gst = taxable * 0.18;
                                                        const totalWithGst = taxable + gst;
                                                        return (
                                                            <>
                                                            <table className="ol-items-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>SKU ID</th><th>Type</th><th>Sub Type</th><th>Dim</th>
                                                                        <th className="th-qty">Units</th>
                                                                        <th className="th-qty">Disp.</th>
                                                                        <th className="th-qty">Qty (kgs)</th>
                                                                        <th className="th-price">Price</th>
                                                                        <th className="th-price">Subtotal</th>
                                                                        <th></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {viewItems.map(item => {
                                                                        const displayUnits = viewMode === "completed" ? item.units_dispatched
                                                                            : viewMode === "pending" ? item.units_remaining
                                                                            : item.units_ordered;
                                                                        return (
                                                                        <tr key={item.item_id} className={item.is_ready ? "ol-item-ready" : ""}>
                                                                            <td>{item.sku_id}</td><td>{item.sku_type}</td>
                                                                            <td>{item.sku_subtype}</td><td>{item.sku_dim}</td>
                                                                            <td className="td-qty">{displayUnits}</td>
                                                                            <td className="td-qty">{item.units_dispatched}/{item.units_ordered}</td>
                                                                            <td className="td-qty">{fmt(item.batch_qty_kg, 3)}</td>
                                                                            <td className="td-price">{fmt(item.selling_price)}</td>
                                                                            <td className="td-price">{(displayUnits*(item.batch_qty_kg||0)*(item.selling_price||0)).toFixed(2)}</td>
                                                                            <td>
                                                                                {privileges?.status !== false ? (() => {
                                                                                    const fullyDispatched = item.units_dispatched >= item.units_ordered;
                                                                                    const orderDispatched = o.dispatch_status === "completed";
                                                                                    const forceGreen = fullyDispatched || orderDispatched;
                                                                                    return (
                                                                                        <button className={`ol-ready-btn${item.is_ready || forceGreen ? " ready" : ""}`}
                                                                                            disabled={forceGreen}
                                                                                            onClick={() => handleToggleReady(o.order_id, item.item_id, !item.is_ready)}>
                                                                                            {item.is_ready || forceGreen ? "✓ Ready" : "✕ Not Ready"}
                                                                                        </button>
                                                                                    );
                                                                                })() : (
                                                                                    <span className={`ol-ready-btn${item.is_ready ? " ready" : ""}`} style={{pointerEvents:"none"}}>
                                                                                        {item.is_ready ? "✓ Ready" : "✕ Not Ready"}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                            <table className="ol-summary-table">
                                                                <tbody>
                                                                    {dc > 0 && (
                                                                        <tr>
                                                                            <td colSpan={8} className="ol-summary-label">Delivery Charge</td>
                                                                            <td className="td-price ol-summary-val">+{dc.toFixed(2)}</td>
                                                                            <td></td>
                                                                        </tr>
                                                                    )}
                                                                    <tr>
                                                                        <td colSpan={8} className="ol-summary-label">GST (18%)</td>
                                                                        <td className="td-price ol-summary-val">+{gst.toFixed(2)}</td>
                                                                        <td></td>
                                                                    </tr>
                                                                    <tr className="ol-summary-total">
                                                                        <td colSpan={8} className="ol-summary-total">Total (incl. GST)</td>
                                                                        <td className="td-price ol-summary-val"><strong>{totalWithGst.toFixed(2)}</strong></td>
                                                                        <td></td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {privileges?.create !== false && <button className="ol-fab" onClick={onNewOrder} title="Place new order">+</button>}
        </div>
    );
}

// ── Wrapper with Sales / Purchase sub-tabs ────────────────────
function OrderList({ onEditOrder, onNewOrder, refreshKey, onOrderDelete, privileges, poCreateTrigger, salesSubTabTrigger })
{
    const hasSales = privileges?.view !== false;
    const hasPO = privileges?._po?.view !== false;
    const [subTab, setSubTab] = useState(hasSales ? "sales" : "purchase");
    const [pendingPoCreate, setPendingPoCreate] = useState(false);
    const lastPoCreateTrigger = useRef(poCreateTrigger);

    // Switch to PO tab and open form when triggered from quick actions
    useEffect(() => {
        if (poCreateTrigger > lastPoCreateTrigger.current) {
            lastPoCreateTrigger.current = poCreateTrigger;
            setPendingPoCreate(true);
            setSubTab("purchase");
        }
    }, [poCreateTrigger]);

    // Switch to Sales tab when triggered
    useEffect(() => {
        if (salesSubTabTrigger > 0) {
            setPendingPoCreate(false);
            setSubTab("sales");
        }
    }, [salesSubTabTrigger]);

    return (
        <div>
            {hasSales && hasPO && (
                <div className="ol-subtab-bar">
                    <button className={`ol-subtab-btn${subTab === "sales" ? " active" : ""}`}
                        onClick={() => { setPendingPoCreate(false); setSubTab("sales"); }}>Sales Orders</button>
                    <button className={`ol-subtab-btn${subTab === "purchase" ? " active" : ""}`}
                        onClick={() => { setPendingPoCreate(false); setSubTab("purchase"); }}>Purchase Orders</button>
                </div>
            )}
            {subTab === "sales" && hasSales ? (
                <SalesOrderList
                    onEditOrder={onEditOrder}
                    onNewOrder={onNewOrder}
                    refreshKey={refreshKey}
                    onOrderDelete={onOrderDelete}
                    privileges={privileges}
                />
            ) : hasPO ? (
                <PurchaseOrder privileges={privileges._po}
                    createTrigger={pendingPoCreate ? poCreateTrigger : 0} />
            ) : null}
        </div>
    );
}

export default OrderList;
