import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import "../styles/order-list.css";
import { getOrders, getOrderItems, getOrderFull, deleteOrder, getCustomers } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ComboInput from "../components/ComboInput";

function OrderList({ onEditOrder, onNewOrder, refreshKey, onOrderDelete })
{
    const [orders,   setOrders]   = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");
    const [expanded, setExpanded] = useState({});
    const [viewMode, setViewMode] = useState("all"); // "all" | "pending" | "completed"

    const [searchCustomer, setSearchCustomer] = useState("");
    const [searchDateFrom, setSearchDateFrom] = useState("");
    const [searchDateTo,   setSearchDateTo]   = useState("");
    const [searchContact,  setSearchContact]  = useState("");
    const [customersList,  setCustomersList]  = useState([]);
    const [deleteTarget,   setDeleteTarget]   = useState(null);

    const initialLoadDone = useRef(false);

    const fetchOrders = useCallback(async (showLoader = false) =>
    {
        if (!initialLoadDone.current || showLoader) setLoading(true);
        setError("");
        try {
            const [ordersData, custsData] = await Promise.all([getOrders(), getCustomers()]);
            setOrders(ordersData);
            setCustomersList(custsData);
            initialLoadDone.current = true;
        }
        catch (err) { setError(err.message || "Failed to load orders"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders, refreshKey]);

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

    const filtered = orders.filter(o =>
    {
        // Status filter: all shows everything, pending shows pending+partial, completed shows completed+partial
        const statusMatch = viewMode === "all" ? true
            : viewMode === "pending"
                ? (o.dispatch_status === "pending" || o.dispatch_status === "partial")
                : (o.dispatch_status === "completed" || o.dispatch_status === "partial");
        const nm = !searchCustomer.trim() || (o.customer_name || "").toLowerCase().includes(searchCustomer.toLowerCase());
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
        return statusMatch && nm && dtFrom && dtTo && contactMatch;
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
            <div className="order-list-header">
                <h1>Order List</h1>
                <div className="ol-toggle">
                    <button className={`ol-toggle-btn${viewMode === "all" ? " active" : ""}`}
                        onClick={() => setViewMode("all")}>All</button>
                    <button className={`ol-toggle-btn${viewMode === "pending" ? " active" : ""}`}
                        onClick={() => setViewMode("pending")}>Pending</button>
                    <button className={`ol-toggle-btn${viewMode === "completed" ? " active" : ""}`}
                        onClick={() => setViewMode("completed")}>Completed</button>
                </div>
                <div className="order-list-toolbar">
                    <button className="ol-refresh-btn" onClick={() => { setExpanded({}); fetchOrders(true); }} disabled={loading}>↻</button>
                    <button className="ol-clear-btn" onClick={() => { setSearchCustomer(""); setSearchDateFrom(""); setSearchDateTo(""); setSearchContact(""); }}>✕ Clear</button>
                </div>
            </div>

            {error && <div className="ol-error">{error}</div>}

            <div className="ol-search-bar">
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
                                <th>Order ID</th><th>Customer</th><th>Shipping Address</th><th>Order Date</th>
                                <th className="th-qty">Total Units</th>
                                <th className="th-qty">Total Qty (kgs)</th>
                                <th className="th-price">Total Amount (Rs.)</th>
                                <th>Status</th>
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
                                        <tr>
                                            <td>{o.order_id}</td>
                                            <td>{o.customer_name}</td>
                                            <td>{o.shipping_address || "—"}</td>
                                            <td>{o.order_date ? o.order_date.slice(0, 10) : "—"}</td>
                                            <td className="td-qty">{fmtInt(o.total_units)}</td>
                                            <td className="td-qty">{fmt(o.total_qty, 3)}</td>
                                            <td className="td-price">{fmt(o.total_amount)}</td>
                                            <td><span className={`ol-status ol-status--${o.dispatch_status || "pending"}`}>{o.dispatch_status || "pending"}</span></td>
                                            <td className="col-actions">
                                                <button className="ol-pi-btn" onClick={() => window.open(`/api/orders/${o.order_id}/invoice`, "_blank")} title="Download PI">📄</button>
                                                <button className="ol-edit-btn" onClick={() => handleEdit(o)}>✎</button>
                                                <button className="ol-delete-btn" onClick={() => handleDelete(o)}>🗑</button>
                                                <button className="ol-details-btn" onClick={() => toggleExpand(o.order_id)}>
                                                    {isOpen ? "▲ Hide" : "▼ Details"}
                                                </button>
                                            </td>
                                        </tr>

                                        {isOpen && (
                                            <tr className="ol-items-row">
                                                <td colSpan={9} style={{ padding: 0 }}>
                                                    {exp.loading && <div className="ol-items-loading">Loading items…</div>}
                                                    {exp.error && <div className="ol-items-error">{exp.error}</div>}
                                                    {!exp.loading && exp.items.length === 0 && <div className="ol-items-loading">No items.</div>}
                                                    {!exp.loading && exp.items.length > 0 && (() => {
                                                        // Filter items based on view mode
                                                        const viewItems = viewMode === "completed"
                                                            ? exp.items.filter(i => i.units_dispatched > 0)
                                                            : viewMode === "pending"
                                                                ? exp.items.filter(i => i.units_remaining > 0)
                                                                : exp.items;
                                                        if (viewItems.length === 0) return <div className="ol-items-loading">No items for this view.</div>;
                                                        return (
                                                        <table className="ol-items-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>SKU ID</th><th>Type</th><th>Sub Type</th><th>Dimensions</th>
                                                                    <th className="th-qty">Units</th>
                                                                    <th className="th-qty">Dispatched</th>
                                                                    <th className="th-qty">Batch Qty (kgs)</th>
                                                                    <th className="th-price">Selling Price</th>
                                                                    <th className="th-price">Subtotal</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {viewItems.map(item => {
                                                                    const displayUnits = viewMode === "completed" ? item.units_dispatched
                                                                        : viewMode === "pending" ? item.units_remaining
                                                                        : item.units_ordered;
                                                                    return (
                                                                    <tr key={item.item_id}>
                                                                        <td>{item.sku_id}</td><td>{item.sku_type}</td>
                                                                        <td>{item.sku_subtype}</td><td>{item.sku_dim}</td>
                                                                        <td className="td-qty">{displayUnits}</td>
                                                                        <td className="td-qty">{item.units_dispatched}/{item.units_ordered}</td>
                                                                        <td className="td-qty">{fmt(item.batch_qty_kg, 3)}</td>
                                                                        <td className="td-price">{fmt(item.selling_price)}</td>
                                                                        <td className="td-price">{(displayUnits*(item.batch_qty_kg||0)*(item.selling_price||0)).toFixed(2)}</td>
                                                                    </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
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

            <button className="ol-fab" onClick={onNewOrder} title="Place new order">+</button>
        </div>
    );
}

export default OrderList;
