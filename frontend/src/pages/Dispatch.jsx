import { useState, useEffect, useCallback, Fragment } from "react";
import "../styles/dispatch.css";
import { getDispatches, createDispatch, deleteDispatch, getDispatchItems, getOrderItemsForDispatch, getOrders } from "../api";
import ModalOverlay from "../components/ModalOverlay";
import ConfirmDialog from "../components/ConfirmDialog";

// Helper: format order ID as CP/0654/26-27
function formatOrderRef(orderId) {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const year = now.getFullYear() % 100;
    // Financial year: Apr-Mar. If month >= 3 (April), FY starts this year, else last year
    const fyStart = month >= 3 ? year : year - 1;
    const fyEnd = fyStart + 1;
    return `CP/${String(orderId).padStart(4, "0")}/${fyStart}-${String(fyEnd).padStart(2, "0")}`;
}

// Validate Indian vehicle plate: e.g. WB12AB1234, WB-12-AB-1234, etc.
function isValidPlate(val) {
    const cleaned = val.replace(/[\s-]/g, "").toUpperCase();
    return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(cleaned);
}

function DispatchForm({ onClose, onSuccess })
{
    const [orders, setOrders]           = useState([]);
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [dispThrough, setDispThrough] = useState("");
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
                // Per-order metadata
                payment_mode: "",
                dispatch_doc_no: "",
                delivery_note_date: "",
                delivery_date: "",
                buyer_order_no: "",
                buyer_order_date: "",
                other_references: "",
                items: items.filter(i => i.remaining_units > 0).map(i => ({
                    ...i, selected: true, units_to_dispatch: i.remaining_units
                }))
            }]);
        } catch (err) { setError(err.message); }
    };

    const removeOrder = (orderId) =>
        setSelectedOrders(prev => prev.filter(o => o.order_id !== orderId));

    const updateOrderMeta = (orderId, field, value) => {
        setSelectedOrders(prev => prev.map(o =>
            o.order_id === orderId ? { ...o, [field]: value } : o
        ));
    };

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
        if (!dispThrough.trim()) { setError("Dispatched Through is required"); return; }
        if (dispThrough.trim().toLowerCase() !== "self pick up" && !isValidPlate(dispThrough)) {
            setError("Dispatched Through must be 'Self Pick Up' or a valid Indian vehicle number plate"); return;
        }
        if (totalQty <= 0) { setError("Select at least one item to dispatch"); return; }
        // Validate per-order payment_mode
        for (const o of selectedOrders) {
            if (o.items.some(i => i.selected && i.units_to_dispatch > 0) && !o.payment_mode.trim()) {
                setError(`Payment mode required for order ${formatOrderRef(o.order_id)}`); return;
            }
        }
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
                    units_dispatched: i.units_to_dispatch,
                    payment_mode: o.payment_mode || null,
                    dispatch_doc_no: o.dispatch_doc_no || null,
                    delivery_note_date: o.delivery_note_date || null,
                    delivery_date: o.delivery_date || null,
                    buyer_order_no: o.buyer_order_no || null,
                    buyer_order_date: o.buyer_order_date || null,
                    other_references: o.other_references || null,
                });
            });
        });
        try {
            await createDispatch({ dispatched_through: dispThrough, items: dispatchItems });
            onSuccess();
        } catch (err) { setError(err.message || "Failed to create dispatch"); }
    };

    const availableOrders = orders.filter(o =>
        !selectedOrders.find(s => s.order_id === o.order_id) && o.dispatch_status !== "completed"
    );

    return (
        <div className="dispatch-form">
            <ConfirmDialog open={submitConfirm} variant="success" title="Confirm Dispatch"
                message={<>Dispatch <strong>{totalQty}</strong> unit{totalQty !== 1 ? "s" : ""} across <strong>{selectedOrders.length}</strong> order{selectedOrders.length !== 1 ? "s" : ""}?</>}
                confirmLabel="Yes, Dispatch" cancelLabel="Go Back"
                onConfirm={confirmSubmit} onCancel={() => setSubmitConfirm(false)} />

            {error && <div className="dispatch-error">{error}</div>}

            <div className="dispatch-field-row">
                <div className="dispatch-field">
                    <label>Dispatched Through :</label>
                    <input value={dispThrough} onChange={e => setDispThrough(e.target.value)}
                        placeholder="Self Pick Up / Vehicle No." />
                </div>
            </div>

            {/* Order selector */}
            <div className="dispatch-field-row">
                <div className="dispatch-field">
                    <label>Add Order :</label>
                    <select onChange={e => { if (e.target.value) addOrder(parseInt(e.target.value)); e.target.value = ""; }}>
                        <option value="">-- Select Order --</option>
                        {availableOrders.map(o => (
                            <option key={o.order_id} value={o.order_id}>
                                {formatOrderRef(o.order_id)} — {o.customer_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Selected orders with per-order metadata */}
            {selectedOrders.map(o => (
                <div key={o.order_id} className="dispatch-order-card">
                    <div className="dispatch-order-header">
                        <strong>{formatOrderRef(o.order_id)}</strong> — {o.customer_name}
                        <button className="dispatch-remove-order" onClick={() => removeOrder(o.order_id)}>✕</button>
                    </div>

                    <div className="dispatch-meta-grid">
                        <div className="dm-field">
                            <label>Payment Mode *</label>
                            <input value={o.payment_mode} onChange={e => updateOrderMeta(o.order_id, "payment_mode", e.target.value)} placeholder="e.g. 15 Days" />
                        </div>
                        <div className="dm-field">
                            <label>Dispatch Doc No.</label>
                            <input value={o.dispatch_doc_no} onChange={e => updateOrderMeta(o.order_id, "dispatch_doc_no", e.target.value)} />
                        </div>
                        <div className="dm-field">
                            <label>Delivery Note Date</label>
                            <input type="date" value={o.delivery_note_date} onChange={e => updateOrderMeta(o.order_id, "delivery_note_date", e.target.value)} />
                        </div>
                        <div className="dm-field">
                            <label>Delivery Date</label>
                            <input type="date" value={o.delivery_date} onChange={e => updateOrderMeta(o.order_id, "delivery_date", e.target.value)} />
                        </div>
                        <div className="dm-field">
                            <label>Buyer's Order No.</label>
                            <input value={o.buyer_order_no} onChange={e => updateOrderMeta(o.order_id, "buyer_order_no", e.target.value)} />
                        </div>
                        <div className="dm-field">
                            <label>Buyer's Order Date</label>
                            <input type="date" value={o.buyer_order_date} onChange={e => updateOrderMeta(o.order_id, "buyer_order_date", e.target.value)} />
                        </div>
                        <div className="dm-field dm-field-wide">
                            <label>Other References</label>
                            <input value={o.other_references} onChange={e => updateOrderMeta(o.order_id, "other_references", e.target.value)} />
                        </div>
                    </div>

                    {/* Items table */}
                    <table className="dispatch-items-select-table">
                        <thead>
                            <tr>
                                <th></th><th>Type</th><th>Sub Type</th><th>Dim</th>
                                <th>Available</th><th>Units to Dispatch</th>
                            </tr>
                        </thead>
                        <tbody>
                            {o.items.map(item => (
                                <tr key={item.item_id} className={item.selected ? "" : "di-unselected"}>
                                    <td><input type="checkbox" checked={item.selected} onChange={() => toggleItem(o.order_id, item.item_id)} /></td>
                                    <td>{item.sku_type}</td>
                                    <td>{item.sku_subtype}</td>
                                    <td>{item.sku_dim}</td>
                                    <td>{item.remaining_units}</td>
                                    <td>
                                        <input type="number" min={0} max={item.remaining_units}
                                            value={item.units_to_dispatch}
                                            onChange={e => setItemUnits(o.order_id, item.item_id, parseInt(e.target.value) || 0)}
                                            disabled={!item.selected} style={{ width: 60 }} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            <div className="dispatch-form-footer">
                <span>Total Units: <strong>{totalQty}</strong></span>
                <div>
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="submit-btn" onClick={handleSubmit}>Submit</button>
                </div>
            </div>
        </div>
    );
}


function DispatchDetailGroup({ group })
{
    const [open, setOpen] = useState(false);
    const totalUnits = group.items.reduce((s, i) => s + (i.units_dispatched || 0), 0);
    return (
        <>
            <tr>
                <td>{formatOrderRef(group.order_id)}</td>
                <td>{group.customer_name}</td>
                <td>{group.payment_mode || "—"}</td>
                <td>{totalUnits}</td>
                <td><button className="ol-details-btn" onClick={() => setOpen(!open)}>{open ? "▲ Hide" : "▼ Details"}</button></td>
            </tr>
            {open && (
                <tr className="dispatch-tree-row">
                    <td colSpan={5} style={{ padding: 0 }}>
                        <div className="dispatch-tree-wrap">
                            <div className="dispatch-tree-line">
                                {group.items.map((_, idx) => (
                                    <div key={idx} className={`tree-node${idx === group.items.length - 1 ? " tree-node-last" : ""}`}></div>
                                ))}
                            </div>
                            <table className="dispatch-sub-table">
                                <thead>
                                    <tr><th>Type</th><th>Sub Type</th><th>Dim</th><th>Units</th></tr>
                                </thead>
                                <tbody>
                                    {group.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.sku_type}</td>
                                            <td>{item.sku_subtype}</td>
                                            <td>{item.sku_dim}</td>
                                            <td>{item.units_dispatched}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}


function Dispatch({ onDispatchSuccess })
{
    const [dispatches, setDispatches] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState("");
    const [expanded, setExpanded]     = useState({});
    const [showForm, setShowForm]     = useState(false);

    const fetchDispatches = useCallback(async () => {
        setLoading(true); setError("");
        try { setDispatches(await getDispatches()); }
        catch (err) { setError(err.message || "Failed to load dispatches"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

    const [deleteTarget, setDeleteTarget] = useState(null);

    const handleDeleteDispatch = (id) => setDeleteTarget(id);

    const confirmDeleteDispatch = async () => {
        const id = deleteTarget;
        setDeleteTarget(null);
        try {
            await deleteDispatch(id);
            fetchDispatches();
            if (onDispatchSuccess) onDispatchSuccess();
        } catch (err) { setError(err.message || "Failed to delete dispatch"); }
    };

    const toggleExpand = async (id) => {
        const curr = expanded[id];
        if (curr?.open) { setExpanded(prev => ({ ...prev, [id]: { ...prev[id], open: false } })); return; }
        setExpanded(prev => ({ ...prev, [id]: { open: true, items: [], loading: true } }));
        try {
            const items = await getDispatchItems(id);
            setExpanded(prev => ({ ...prev, [id]: { open: true, items, loading: false } }));
        } catch { setExpanded(prev => ({ ...prev, [id]: { open: true, items: [], loading: false } })); }
    };

    return (
        <div className="dispatch-container">
            <div className="dispatch-header-row">
                <h1>Dispatch</h1>
                <div className="dispatch-toolbar">
                    <button className="rtb-btn" onClick={() => { setExpanded({}); fetchDispatches(); }} disabled={loading}>↻</button>
                </div>
            </div>

            {error && <div className="dispatch-error">{error}</div>}

            <ConfirmDialog
                open={!!deleteTarget}
                variant="danger"
                title="Delete Dispatch"
                message={deleteTarget ? <>Delete Dispatch <strong>#{deleteTarget}</strong>? This will revert the dispatch record.</> : ""}
                confirmLabel="Yes, Delete"
                cancelLabel="Cancel"
                onConfirm={confirmDeleteDispatch}
                onCancel={() => setDeleteTarget(null)}
            />

            {showForm && (
                <ModalOverlay open={true} title="New Dispatch" onClose={() => setShowForm(false)}>
                    <DispatchForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); fetchDispatches(); if (onDispatchSuccess) onDispatchSuccess(); }} />
                </ModalOverlay>
            )}

            {loading && <div className="dispatch-placeholder">Loading…</div>}
            {!loading && dispatches.length === 0 && <div className="dispatch-placeholder">No dispatches yet.</div>}

            {!loading && dispatches.length > 0 && (
                <div className="dispatch-table-wrapper">
                <table className="dispatch-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Dispatched Through</th>
                            <th>Total Units</th><th>Created</th><th></th>
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
                                        <td>{d.dispatched_through}</td>
                                        <td>{d.total_units}</td>
                                        <td>{d.created_at ? d.created_at.slice(0, 10) : "—"}</td>
                                        <td>
                                            <button className="ol-delete-btn" onClick={() => handleDeleteDispatch(d.dispatch_id)}>🗑</button>
                                            <button className="ol-details-btn" onClick={() => toggleExpand(d.dispatch_id)}>
                                                {isOpen ? "▲ Hide" : "▼ Details"}
                                            </button>
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr><td colSpan={5} style={{ padding: 0 }}>
                                            {exp.loading ? <div style={{ padding: 12 }}>Loading…</div> : (() => {
                                                // Group items by order_id + customer
                                                const groups = {};
                                                exp.items.forEach(item => {
                                                    const key = item.order_id;
                                                    if (!groups[key]) groups[key] = { order_id: item.order_id, customer_name: item.customer_name, payment_mode: item.payment_mode, items: [] };
                                                    groups[key].items.push(item);
                                                });
                                                return (
                                                <table className="dispatch-items-table">
                                                    <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Units</th><th></th></tr></thead>
                                                    <tbody>
                                                        {Object.values(groups).map(g => (
                                                            <DispatchDetailGroup key={g.order_id} group={g} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                                );
                                            })()}
                                        </td></tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            )}

            <button className="retrieval-fab" onClick={() => setShowForm(true)} title="New Dispatch">+</button>
        </div>
    );
}

export default Dispatch;
