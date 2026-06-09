import { useState, useEffect, useCallback, Fragment } from "react";
import "../styles/order-list.css";
import { getOrders, getOrderItems, getOrderFull, deleteOrder, getCustomers } from "../api";

import ComboInput from "../components/ComboInput";

function OrderList({ onEditOrder, onNewOrder })
{
    const [orders,   setOrders]   = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");
    const [expanded, setExpanded] = useState({});

    const [searchCustomer, setSearchCustomer] = useState("");
    const [searchDateFrom, setSearchDateFrom] = useState("");
    const [searchDateTo,   setSearchDateTo]   = useState("");
    const [searchContact,  setSearchContact]  = useState("");
    const [customersList,  setCustomersList]  = useState([]);

    const fetchOrders = useCallback(async () =>
    {
        setLoading(true); setError("");
        try {
            const [ordersData, custsData] = await Promise.all([getOrders(), getCustomers()]);
            setOrders(ordersData);
            setCustomersList(custsData);
        }
        catch (err) { setError(err.message || "Failed to load orders"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

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

    const handleDelete = async (order) =>
    {
        if (!window.confirm(`Delete Order #${order.order_id}? This will restore inventory.`)) return;
        try {
            await deleteOrder(order.order_id);
            setOrders(prev => prev.filter(o => o.order_id !== order.order_id));
        } catch (err) {
            setError(err.message || "Failed to delete order");
        }
    };

    const filtered = orders.filter(o =>
    {
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
        return nm && dtFrom && dtTo && contactMatch;
    });

    const fmt    = (v, d = 2) => v != null ? parseFloat(v).toFixed(d) : "—";
    const fmtInt = (v)        => v != null ? parseInt(v) : "—";

    return (
        <div className="order-list-container">
            <div className="order-list-header">
                <h1>Order List</h1>
                <div className="order-list-toolbar">
                    <button className="ol-refresh-btn" onClick={fetchOrders} disabled={loading}>↻</button>
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
                                                <td colSpan={8} style={{ padding: 0 }}>
                                                    {exp.loading && <div className="ol-items-loading">Loading items…</div>}
                                                    {exp.error && <div className="ol-items-error">{exp.error}</div>}
                                                    {!exp.loading && exp.items.length === 0 && <div className="ol-items-loading">No items.</div>}
                                                    {!exp.loading && exp.items.length > 0 && (
                                                        <table className="ol-items-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>SKU ID</th><th>Type</th><th>Sub Type</th><th>Dimensions</th>
                                                                    <th className="th-qty">Units</th>
                                                                    <th className="th-qty">Batch Qty (kgs)</th>
                                                                    <th className="th-price">Selling Price</th>
                                                                    <th className="th-price">Subtotal</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {exp.items.map(item => (
                                                                    <tr key={item.item_id}>
                                                                        <td>{item.sku_id}</td><td>{item.sku_type}</td>
                                                                        <td>{item.sku_subtype}</td><td>{item.sku_dim}</td>
                                                                        <td className="td-qty">{item.units_ordered}</td>
                                                                        <td className="td-qty">{fmt(item.batch_qty_kg, 3)}</td>
                                                                        <td className="td-price">{fmt(item.selling_price)}</td>
                                                                        <td className="td-price">{((item.units_ordered||0)*(item.batch_qty_kg||0)*(item.selling_price||0)).toFixed(2)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
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
