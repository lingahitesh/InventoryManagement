import { useState, useEffect, useCallback, Fragment } from "react";
import "../styles/dispatch.css";
import { getDispatches, createDispatch, getDispatchItems, getOrderItemsForDispatch, getOrders } from "../api";
import ModalOverlay from "../components/ModalOverlay";
import ConfirmDialog from "../components/ConfirmDialog";

function DispatchForm({ onClose, onSuccess })
{
    const [orders, setOrders]           = useState([]);
    const [selectedOrders, setSelectedOrders] = useState([]);  // [{order_id, items: [{item_id, total_units, remaining_units, sku_type, ..., selected: bool, units_to_dispatch: int}]}]
    const [trackingId, setTrackingId]   = useState("");
    const [dispThrough, setDispThrough] = useState("");
    const [docNo, setDocNo]             = useState("");
    const [delNoteDate, setDelNoteDate] = useState("");
    const [buyerOrderNo, setBuyerOrderNo] = useState("");
    const [buyerOrderDate, setBuyerOrderDate] = useState("");
    const [otherRefs, setOtherRefs]     = useState("");
    const [paymentMode, setPaymentMode] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [error, setError]             = useState("");
    const [submitConfirm, setSubmitConfirm] = useState(false);

    useEffect(() => { getOrders().then(setOrders).catch(() => {}); }, []);

    const addOrder = async (orderId) =>
    {
        if (selectedOrders.find(o => o.order_id === orderId)) return;
        try {
            const items = await getOrderItemsForDispatch(orderId);
            const order = orders.find(o => o.order_id === orderId);
            setSelectedOrders(prev => [...prev, {
                order_id: orderId,
                customer_name: order?.customer_name || "",
                items: items.filter(i => i.remaining_units > 0).map(i => ({
                    ...i, selected: true, units_to_dispatch: i.remaining_units
                }))
            }]);
        } catch (err) { setError(err.message); }
    };

    const removeOrder = (orderId) =>
        setSelectedOrders(prev => prev.filter(o => o.order_id !== orderId));

    const toggleItem = (orderId, itemId) =>
    {
        setSelectedOrders(prev => prev.map(o =>
            o.order_id === orderId
                ? { ...o, items: o.items.map(i => i.item_id === itemId ? { ...i, selected: !i.selected } : i) }
                : o
        ));
    };

    const setItemUnits = (orderId, itemId, units) =>
    {
        setSelectedOrders(prev => prev.map(o =>
            o.order_id === orderId
                ? { ...o, items: o.items.map(i => i.item_id === itemId ? { ...i, units_to_dispatch: Math.min(Math.max(0, units), i.remaining_units) } : i) }
                : o
        ));
    };

    const totalQty = selectedOrders.reduce((s, o) =>
        s + o.items.filter(i => i.selected).reduce((ss, i) => ss + i.units_to_dispatch, 0), 0);

    const handleSubmit = () =>
    {
        if (!trackingId.trim()) { setError("Tracking ID is required"); return; }
        if (!dispThrough.trim()) { setError("Dispatched Through is required"); return; }
        if (!paymentMode.trim()) { setError("Payment Mode is required"); return; }
        if (totalQty <= 0) { setError("Select at least one item to dispatch"); return; }
        setError("");
        setSubmitConfirm(true);
    };

    const confirmSubmit = async () =>
    {
        setSubmitConfirm(false);
        const dispatchItems = [];
        selectedOrders.forEach(o => {
            o.items.filter(i => i.selected && i.units_to_dispatch > 0).forEach(i => {
                dispatchItems.push({
                    order_id: o.order_id,
                    order_item_id: i.item_id,
                    units_dispatched: i.units_to_dispatch
                });
            });
        });
        try {
            await createDispatch({
                tracking_id: trackingId,
                dispatched_through: dispThrough,
                dispatch_doc_no: docNo || null,
                delivery_note_date: delNoteDate || null,
                buyer_order_no: buyerOrderNo || null,
                buyer_order_date: buyerOrderDate || null,
                other_references: otherRefs || null,
                payment_mode: paymentMode,
                delivery_date: deliveryDate || null,
                items: dispatchItems
            });
            onSuccess();
        } catch (err) { setError(err.message || "Failed to create dispatch"); }
    };

    return (
        <div className="dispatch-form">
            <ConfirmDialog open={submitConfirm} variant="success" title="Create Dispatch"
                message={<>Dispatch <strong>{totalQty}</strong> units across <strong>{selectedOrders.length}</strong> order(s)?</>}
                confirmLabel="Yes, Dispatch" cancelLabel="Go Back"
                onConfirm={confirmSubmit} onCancel={() => setSubmitConfirm(false)} />

            {error && <div className="dispatch-error">{error}</div>}

            <div className="dispatch-fields">
                <div className="df-row">
                    <div className="df-field"><label>Tracking ID *</label><input value={trackingId} onChange={e => setTrackingId(e.target.value)} /></div>
                    <div className="df-field"><label>Dispatched Through *</label>
                        <input list="disp-through-list" value={dispThrough} onChange={e => setDispThrough(e.target.value)} placeholder="Self Pick Up / ..." />
                        <datalist id="disp-through-list"><option value="Self Pick Up" /></datalist>
                    </div>
                    <div className="df-field"><label>Payment Mode *</label>
                        <input value={paymentMode} onChange={e => setPaymentMode(e.target.value)} placeholder="To be specified" />
                    </div>
                </div>
                <div className="df-row">
                    <div className="df-field"><label>Dispatch Doc No</label><input value={docNo} onChange={e => setDocNo(e.target.value)} /></div>
                    <div className="df-field"><label>Delivery Note Date</label><input type="date" value={delNoteDate} onChange={e => setDelNoteDate(e.target.value)} /></div>
                    <div className="df-field"><label>Delivery Date</label><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
                </div>
                <div className="df-row">
                    <div className="df-field"><label>Buyer's Order No</label><input value={buyerOrderNo} onChange={e => setBuyerOrderNo(e.target.value)} /></div>
                    <div className="df-field"><label>Buyer's Order Date</label><input type="date" value={buyerOrderDate} onChange={e => setBuyerOrderDate(e.target.value)} /></div>
                    <div className="df-field"><label>Other References</label><input value={otherRefs} onChange={e => setOtherRefs(e.target.value)} /></div>
                </div>
            </div>

            {/* Order selector */}
            <div className="dispatch-order-select">
                <h3>Select Orders to Dispatch</h3>
                <select onChange={e => { if (e.target.value) addOrder(parseInt(e.target.value)); e.target.value = ""; }}>
                    <option value="">-- Add Order --</option>
                    {orders.filter(o => !selectedOrders.find(s => s.order_id === o.order_id)).map(o => (
                        <option key={o.order_id} value={o.order_id}>#{o.order_id} — {o.customer_name}</option>
                    ))}
                </select>
            </div>

            {/* Selected orders with item checkboxes */}
            {selectedOrders.map(o => (
                <div key={o.order_id} className="dispatch-order-card">
                    <div className="doc-header">
                        <strong>Order #{o.order_id}</strong> — {o.customer_name}
                        <button className="doc-remove" onClick={() => removeOrder(o.order_id)}>✕ Remove</button>
                    </div>
                    <table className="dispatch-items-table">
                        <thead>
                            <tr><th></th><th>Type</th><th>Sub Type</th><th>Dim</th><th>Remaining</th><th>Units to Dispatch</th></tr>
                        </thead>
                        <tbody>
                            {o.items.map(i => (
                                <tr key={i.item_id}>
                                    <td><input type="checkbox" checked={i.selected} onChange={() => toggleItem(o.order_id, i.item_id)} /></td>
                                    <td>{i.sku_type}</td><td>{i.sku_subtype}</td><td>{i.sku_dim}</td>
                                    <td>{i.remaining_units}</td>
                                    <td><input type="number" min={0} max={i.remaining_units} value={i.units_to_dispatch}
                                        onChange={e => setItemUnits(o.order_id, i.item_id, parseInt(e.target.value)||0)}
                                        disabled={!i.selected} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            <div className="dispatch-footer">
                <span className="dispatch-total">Total Units: <strong>{totalQty}</strong></span>
                <div>
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="submit-btn" onClick={handleSubmit}>Create Dispatch</button>
                </div>
            </div>
        </div>
    );
}

function Dispatch()
{
    const [dispatches, setDispatches] = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState("");
    const [expanded,   setExpanded]   = useState({});
    const [showForm,   setShowForm]   = useState(false);

    const fetchDispatches = useCallback(async () =>
    {
        setLoading(true); setError("");
        try { setDispatches(await getDispatches()); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

    const toggleExpand = async (id) =>
    {
        const curr = expanded[id];
        if (curr?.open) { setExpanded(prev => ({ ...prev, [id]: { open: false } })); return; }
        setExpanded(prev => ({ ...prev, [id]: { open: true, items: [], loading: true } }));
        try {
            const items = await getDispatchItems(id);
            setExpanded(prev => ({ ...prev, [id]: { open: true, items, loading: false } }));
        } catch { setExpanded(prev => ({ ...prev, [id]: { open: true, items: [], loading: false } })); }
    };

    return (
        <div className="dispatch-container">
            <div className="dispatch-header">
                <h1>Dispatch</h1>
                <div className="dispatch-toolbar">
                    <button className="rtb-btn" onClick={fetchDispatches} disabled={loading}>↻</button>
                </div>
            </div>

            {error && <div className="dispatch-error">{error}</div>}

            {showForm && (
                <ModalOverlay open={true} title="New Dispatch" onClose={() => setShowForm(false)}>
                    <DispatchForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); fetchDispatches(); }} />
                </ModalOverlay>
            )}

            {loading && <div className="dispatch-placeholder">Loading…</div>}
            {!loading && dispatches.length === 0 && <div className="dispatch-placeholder">No dispatches yet.</div>}

            {!loading && dispatches.length > 0 && (
                <table className="dispatch-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Tracking ID</th><th>Dispatched Through</th>
                            <th>Payment Mode</th><th>Total Units</th><th>Created</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {dispatches.map(d =>
                        {
                            const exp = expanded[d.dispatch_id];
                            const isOpen = exp?.open ?? false;
                            return (
                                <Fragment key={d.dispatch_id}>
                                    <tr>
                                        <td>{d.dispatch_id}</td>
                                        <td>{d.tracking_id}</td>
                                        <td>{d.dispatched_through}</td>
                                        <td>{d.payment_mode}</td>
                                        <td>{d.total_quantity}</td>
                                        <td>{d.created_at ? d.created_at.slice(0, 10) : "—"}</td>
                                        <td>
                                            <button className="ol-details-btn" onClick={() => toggleExpand(d.dispatch_id)}>
                                                {isOpen ? "▲ Hide" : "▼ Details"}
                                            </button>
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr><td colSpan={7} style={{ padding: 0 }}>
                                            {exp.loading ? <div style={{ padding: 12 }}>Loading…</div> : (
                                                <table className="dispatch-items-table">
                                                    <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Sub Type</th><th>Dim</th><th>Units</th></tr></thead>
                                                    <tbody>
                                                        {exp.items.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td>#{item.order_id}</td>
                                                                <td>{item.customer_name}</td>
                                                                <td>{item.sku_type}</td>
                                                                <td>{item.sku_subtype}</td>
                                                                <td>{item.sku_dim}</td>
                                                                <td>{item.units_dispatched}</td>
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
            )}

            <button className="retrieval-fab" onClick={() => setShowForm(true)} title="New Dispatch">+</button>
        </div>
    );
}

export default Dispatch;
