import { useState, useEffect, useCallback, useRef, Fragment, useLayoutEffect } from "react";
import "../styles/payment.css";
import { getPayments, addPayment, updatePayment, deletePayment, getCustomers, getOrders, downloadLedger, getPaymentDues, getCustomerDuesDetail, getOrderDuesItems } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ModalOverlay from "../components/ModalOverlay";
import ComboInput from "../components/ComboInput";

/* ═══════════════════════════════════════════════════════════════
   Payment Form (add / edit)
   ═══════════════════════════════════════════════════════════════ */
function PaymentForm({ editRecord, customers, orders, onClose, onSuccess }) {
    const [customerId, setCustomerId] = useState(editRecord?.customer_id || "");
    const [amtPaid, setAmtPaid] = useState(editRecord ? String(editRecord.amt_paid) : "");
    const [paymentDate, setPaymentDate] = useState(editRecord?.payment_date || new Date().toLocaleDateString("en-CA"));
    const [notes, setNotes] = useState(editRecord?.notes || "");
    const [duesDetail, setDuesDetail] = useState(null);
    const [error, setError] = useState("");

    const fullName = (c) => [c.fname, c.mname, c.lname].filter(Boolean).join(" ");

    // Format order ID as invoice number
    const formatInvoiceNo = (orderId) => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear() % 100;
        const fyStart = month >= 3 ? year : year - 1;
        const fyEnd = fyStart + 1;
        return `CP/${String(orderId).padStart(4, "0")}/${fyStart}-${String(fyEnd).padStart(2, "0")}`;
    };

    useEffect(() => {
        if (customerId) {
            getCustomerDuesDetail(customerId).then(setDuesDetail).catch(() => setDuesDetail(null));
        } else {
            setDuesDetail(null);
        }
    }, [customerId]);

    const handleSubmit = async () => {
        if (!customerId) { setError("Customer is required"); return; }
        if (!amtPaid || isNaN(parseFloat(amtPaid)) || parseFloat(amtPaid) <= 0) { setError("Enter a valid amount"); return; }
        if (!paymentDate) { setError("Payment date is required"); return; }
        setError("");
        const payload = { customer_id: parseInt(customerId), amt_paid: parseFloat(amtPaid), payment_date: paymentDate, order_id: null, notes: notes || null };
        try {
            if (editRecord) await updatePayment(editRecord.payment_id, payload);
            else await addPayment(payload);
            onSuccess();
        } catch (err) { setError(err.message || "Failed to save"); }
    };

    const totalDue = duesDetail ? duesDetail.reduce((s, od) => s + od.remaining, 0) : 0;

    return (
        <div className="payment-form">
            {error && <div className="pay-error">{error}</div>}
            <div className="pf-grid">
                <div className="pf-field pf-span2">
                    <label>Customer *</label>
                    <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                        <option value="">-- Select Customer --</option>
                        {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{fullName(c)}</option>)}
                    </select>
                </div>

                {/* Due breakdown table */}
                {duesDetail && duesDetail.length > 0 && (
                    <div className="pf-dues-breakdown pf-span2">
                        <table className="pf-dues-table">
                            <thead><tr><th>Invoice No.</th><th className="th-right">Amount Due (₹)</th></tr></thead>
                            <tbody>
                                {duesDetail.filter(od => od.remaining > 0.01).map(od => (
                                    <tr key={od.order_id}>
                                        <td>{formatInvoiceNo(od.order_id)}</td>
                                        <td className="td-right">{od.remaining.toFixed(2)}</td>
                                    </tr>
                                ))}
                                <tr className="pf-dues-total-row">
                                    <td><strong>Total Due</strong></td>
                                    <td className="td-right pay-debit"><strong>₹{totalDue.toFixed(2)}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
                {duesDetail && duesDetail.length === 0 && customerId && (
                    <div className="pf-dues-breakdown pf-span2" style={{color:"#2e7d32", fontWeight:600, padding:"8px 0"}}>No outstanding dues for this customer.</div>
                )}

                <div className="pf-field"><label>Amount (₹) *</label><input type="number" min="0" step="1" value={amtPaid} onChange={e => setAmtPaid(e.target.value)} placeholder="0.00" /></div>
                <div className="pf-field"><label>Date *</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
                <div className="pf-field pf-span2"><label>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Cheque no." /></div>
            </div>
            <div className="pf-actions">
                <button className="cancel-btn" onClick={onClose}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmit}>{editRecord ? "Save" : "Record Payment"}</button>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Order Info Button (hover tooltip for dues breakdown)
   ═══════════════════════════════════════════════════════════════ */
function OrderInfoBtn({ customerId, orderId }) {
    const [show, setShow] = useState(false);
    const [data, setData] = useState(null);

    const handleHover = async () => {
        setShow(true);
        if (!data) {
            try { setData(await getOrderDuesItems(customerId, orderId)); }
            catch { setData([]); }
        }
    };
    const invoiceNo = String(orderId).padStart(4, "0");
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyEnd = (fyStart + 1).toString().slice(-2);
    return (
        <span className="price-info-wrap" onMouseEnter={handleHover} onMouseLeave={() => setShow(false)}>
            <button className="price-info-btn" type="button">ℹ</button>
            {show && (
                <div className="price-info-tooltip" style={{ minWidth: 300, transform: "translateX(-90%)", "--arrow-left": "90%"}}>
                    {!data ? <div>Loading…</div> : data.length === 0 ? <div>No items</div> : (
                        <div className="pit-section">
                            <strong>Invoice No. CP/{invoiceNo}/{fyStart.toString().slice(-2)}-{fyEnd} Breakdown</strong>
                            <table className="dues-tooltip-table">
                                <thead><tr><th>Type</th><th>SubType</th><th>Dim</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                                <tbody>{data.map(it => (
                                    <tr key={it.item_id}><td>{it.sku_type}</td><td>{it.sku_subtype}</td><td>{it.sku_dim}</td><td>{it.qty_kg.toFixed(1)}</td><td>{it.price.toFixed(2)}</td><td>{it.line_total.toFixed(2)}</td></tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </span>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Main Payment Page
   ═══════════════════════════════════════════════════════════════ */
function Payment({ privileges, createTrigger }) {
    const [payments, setPayments] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Search
    const [srchCustomer, setSrchCustomer] = useState("");
    const [srchDateFrom, setSrchDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toLocaleDateString("en-CA"); });
    const [srchDateTo, setSrchDateTo] = useState(() => new Date().toLocaleDateString("en-CA"));
    const [srchAmtMin, setSrchAmtMin] = useState("");
    const [srchAmtMax, setSrchAmtMax] = useState("");

    // UI
    const [showForm, setShowForm] = useState(false);
    const [editRecord, setEditRecord] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showLedger, setShowLedger] = useState(false);

    // Ledger
    const today = new Date().toLocaleDateString("en-CA");
    const sixMonthsAgo = (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toLocaleDateString("en-CA"); })();
    const [ledgerCustomer, setLedgerCustomer] = useState("");
    const [ledgerFrom, setLedgerFrom] = useState(sixMonthsAgo);
    const [ledgerTo, setLedgerTo] = useState(today);
    const [ledgerError, setLedgerError] = useState("");

    // Dues
    const [dues, setDues] = useState([]);
    const [duesExpanded, setDuesExpanded] = useState({});
    const [duesDetail, setDuesDetail] = useState({});

    const initialLoadDone = useRef(false);

    const fetchAll = useCallback(async (showLoader = false) => {
        if (!initialLoadDone.current || showLoader) setLoading(true);
        try {
            const [p, c, o, d] = await Promise.all([getPayments(), getCustomers(), getOrders(), getPaymentDues()]);
            setPayments(p); setCustomers(c); setOrders(o); setDues(d);
            setError(""); initialLoadDone.current = true;
        } catch (err) { setError(err.message || "Failed to load"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { const r = () => { if (error) fetchAll(); }; window.addEventListener("focus", r); return () => window.removeEventListener("focus", r); }, [error, fetchAll]);

    // Open form when triggered from quick actions
    useLayoutEffect(() => { if (createTrigger > 0) { setEditRecord(null); setShowForm(true); } }, [createTrigger]);

    const handleDelete = async () => { const id = deleteTarget; setDeleteTarget(null); try { await deletePayment(id); fetchAll(); } catch (e) { setError(e.message); } };
    const fullName = (c) => [c.fname, c.mname, c.lname].filter(Boolean).join(" ");
    const fmt = (v) => v != null ? parseFloat(v).toFixed(2) : "—";
    const clearFilters = () => { setSrchCustomer(""); setSrchDateFrom(""); setSrchDateTo(""); setSrchAmtMin(""); setSrchAmtMax(""); };

    const filtered = payments.filter(p => {
        const nm = !srchCustomer.trim() || (p.customer_name || "").toLowerCase().includes(srchCustomer.toLowerCase());
        const dfrom = !srchDateFrom || (p.payment_date || "") >= srchDateFrom;
        const dto = !srchDateTo || (p.payment_date || "") <= srchDateTo;
        const amin = !srchAmtMin || parseFloat(p.amt_paid) >= parseFloat(srchAmtMin);
        const amax = !srchAmtMax || parseFloat(p.amt_paid) <= parseFloat(srchAmtMax);
        return nm && dfrom && dto && amin && amax;
    });
    return (
        <div className="payment-container">
            <ConfirmDialog open={!!deleteTarget} variant="danger" title="Delete Payment"
                message="Delete this payment record? This cannot be undone."
                confirmLabel="Yes, Delete" cancelLabel="Cancel"
                onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

            {/* ── Ledger Modal ── */}
            {showLedger && (
                <ModalOverlay open={true} title="Ledger" onClose={() => { setShowLedger(false); setLedgerError(""); }}>
                    <div className="ledger-modal-form">
                        {ledgerError && <div className="pay-error">{ledgerError}</div>}
                        <div className="pf-grid">
                            <div className="pf-field pf-span2"><label>Customer *</label>
                                <select value={ledgerCustomer} onChange={e => setLedgerCustomer(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{fullName(c)}</option>)}
                                </select>
                            </div>
                            <div className="pf-field"><label>From</label><input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} /></div>
                            <div className="pf-field"><label>To</label><input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} /></div>
                        </div>
                        {ledgerCustomer && (
                            <iframe title="Ledger" src={`/api/payments/ledger/${ledgerCustomer}?date_from=${ledgerFrom}&date_to=${ledgerTo}`}
                                style={{ width: "100%", height: 450, border: "1px solid #ddd", borderRadius: 8, marginTop: 14 }} />
                        )}
                        <div className="pf-actions" style={{ marginTop: 12 }}>
                            <button className="cancel-btn" onClick={() => setShowLedger(false)}>Close</button>
                            <button className="submit-btn" onClick={() => { if (!ledgerCustomer) { setLedgerError("Select a customer"); return; } window.open(`/api/payments/ledger/${ledgerCustomer}?date_from=${ledgerFrom}&date_to=${ledgerTo}`, "_blank"); }}>📥 Download</button>
                            <button className="submit-btn" style={{ background: "#2e7d32" }} onClick={() => { if (!ledgerCustomer) { setLedgerError("Select a customer"); return; } const w = window.open(`/api/payments/ledger/${ledgerCustomer}?date_from=${ledgerFrom}&date_to=${ledgerTo}`, "_blank"); setTimeout(() => { if (w) w.print(); }, 1000); }}>🖨 Print</button>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {/* ── Payment Form Modal ── */}
            {showForm && (
                <ModalOverlay open={true} title={editRecord ? "Edit Payment" : "Record Payment"} onClose={() => { setShowForm(false); setEditRecord(null); }}>
                    <PaymentForm editRecord={editRecord} customers={customers} orders={orders}
                        onClose={() => { setShowForm(false); setEditRecord(null); }}
                        onSuccess={() => { setShowForm(false); setEditRecord(null); fetchAll(); }} />
                </ModalOverlay>
            )}

            {/* ════════════════════════════════════════════════
               PAYMENT HISTORY
               ════════════════════════════════════════════════ */}
            <div className="payment-header-row">
                <h1>Payment History</h1>
                <div className="payment-toolbar">
                    {privileges?.generate !== false && <button className="rtb-btn" onClick={() => setShowLedger(true)}>📒 Ledger</button>}
                    <button className="rtb-btn" onClick={() => { fetchAll(true); setDuesExpanded({}); setDuesDetail({}); }} disabled={loading}>↻</button>
                    <button className="rtb-btn" onClick={clearFilters}>✕ Clear</button>
                </div>
            </div>

            {error && <div className="pay-error">{error}</div>}

            <div className="pay-search-bar">
                <div className="pay-search-field"><label>Customer</label>
                    <ComboInput value={srchCustomer} onChange={e => setSrchCustomer(e.target.value)} options={[...new Set(customers.map(c => fullName(c)))]} placeholder="Name…" id="ps-cust" /></div>
                <div className="pay-search-field"><label>Amt Min (₹)</label><input type="number" min="0" value={srchAmtMin} onChange={e => setSrchAmtMin(e.target.value)} placeholder="0" /></div>
                <div className="pay-search-field"><label>Amt Max (₹)</label><input type="number" min="0" value={srchAmtMax} onChange={e => setSrchAmtMax(e.target.value)} placeholder="∞" /></div>
                <div className="pay-search-field"><label>From</label><input type="date" value={srchDateFrom} onChange={e => setSrchDateFrom(e.target.value)} /></div>
                <div className="pay-search-field"><label>To</label><input type="date" value={srchDateTo} onChange={e => setSrchDateTo(e.target.value)} /></div>
            </div>

            {loading && <div className="pay-placeholder">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="pay-placeholder">No payment records found.</div>}
            {!loading && filtered.length > 0 && (
                <div className="history-table-wrap">
                    <table className="history-table">
                        <colgroup>
                            <col style={{width:"18%"}} />
                            <col style={{width:"10%"}} />
                            <col style={{width:"18%"}} />
                            <col style={{width:"18%"}} />
                            <col style={{width:"12%"}} />
                            <col style={{width:"13%"}} />
                            <col style={{width:"11%"}} />
                        </colgroup>
                        <thead><tr><th>Customer</th><th>Order</th><th className="th-right">Amount Paid (₹)</th><th className="th-right">Amount Due (₹)</th><th>Date</th><th>Notes</th><th></th></tr></thead>
                        <tbody>
                            {filtered.map(p => {
                                const custOrders = orders.filter(o => o.customer_id === p.customer_id);
                                const totalBilled = custOrders.reduce((s, o) => s + (parseFloat(o.total_with_gst) || 0), 0);
                                const totalPaid = payments.filter(x => x.customer_id === p.customer_id).reduce((s, x) => s + (parseFloat(x.amt_paid) || 0), 0);
                                const amtDue = totalBilled - totalPaid;
                                const isToday = p.payment_date === new Date().toLocaleDateString("en-CA");
                                return (
                                    <tr key={p.payment_id}>
                                        <td>{p.customer_name}</td>
                                        <td>{p.order_id ? `#${p.order_id}` : "—"}</td>
                                        <td className="td-right pay-credit">+{fmt(p.amt_paid)}</td>
                                        <td className={`td-right ${amtDue > 0.01 ? "pay-debit" : "pay-zero"}`}>{amtDue.toFixed(2)}</td>
                                        <td>{p.payment_date || "—"}</td>
                                        <td className="pay-notes">{p.notes || "—"}</td>
                                        <td>
                                            {privileges?.edit !== false && <button className="ol-edit-btn" onClick={() => { setEditRecord(p); setShowForm(true); }} disabled={!isToday} title={isToday ? "Edit" : "Can only edit on same day"}>✎</button>}
                                            {privileges?.delete !== false && <button className="ol-delete-btn" onClick={() => setDeleteTarget(p.payment_id)} disabled={!isToday} title={isToday ? "Delete" : "Can only delete on same day"}>🗑</button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ════════════════════════════════════════════════
               PAYMENT DUES
               ════════════════════════════════════════════════ */}
            {dues.length > 0 && (
                <div className="pay-dues-section">
                    <h2 className="pay-dues-title">Payment Dues</h2>
                    <div className="dues-table-wrap">
                        <table className="dues-table">
                            <colgroup>
                                <col style={{width:"25%"}} />
                                <col style={{width:"20%"}} />
                                <col style={{width:"18%"}} />
                                <col style={{width:"22%"}} />
                                <col style={{width:"15%"}} />
                            </colgroup>
                            <thead><tr><th>Customer</th><th className="th-right">Amount Due (₹)</th><th className="th-right">Interest (₹)</th><th className="th-right">Total (₹)</th><th></th></tr></thead>
                            <tbody>
                                {dues.map(d => {
                                    const isOpen = !!duesExpanded[d.customer_id];
                                    return (
                                        <Fragment key={d.customer_id}>
                                            <tr className={d.total_interest > 0 ? "dues-row-overdue" : ""}>
                                                <td>{d.customer_name}</td>
                                                <td className="td-right">{d.total_due.toFixed(2)}</td>
                                                <td className="td-right pay-debit">{d.total_interest > 0 ? d.total_interest.toFixed(2) : "—"}</td>
                                                <td className="td-right"><strong>{d.total_with_interest.toFixed(2)}</strong></td>
                                                <td>
                                                <button className="ol-details-btn" onClick={async () => {
                                                    if (isOpen) { setDuesExpanded(p => ({...p, [d.customer_id]: false})); return; }
                                                    if (!duesDetail[d.customer_id]) {
                                                        try {
                                                            const detail = await getCustomerDuesDetail(d.customer_id);
                                                            setDuesDetail(p => ({...p, [d.customer_id]: detail}));
                                                        } catch {}
                                                    }
                                                    setDuesExpanded(p => ({...p, [d.customer_id]: true}));
                                                }}>{isOpen ? "▲ Hide" : "▼ Details"}</button>
                                                </td>
                                            </tr>
                                            {isOpen && duesDetail[d.customer_id] && (
                                                <tr><td colSpan={5} className="dues-detail-wrap">
                                                    <table className="dues-detail-table">
                                                        <colgroup>
                                                            <col style={{width:"12%"}} />
                                                            <col style={{width:"18%"}} />
                                                            <col style={{width:"18%"}} />
                                                            <col style={{width:"16%"}} />
                                                            <col style={{width:"14%"}} />
                                                            <col style={{width:"16%"}} />
                                                            <col style={{width:"6%"}} />
                                                        </colgroup>
                                                        <thead>
                                                            <tr>
                                                                <th>Invoice No.</th>
                                                                <th className="th-right">Amount (₹)</th>
                                                                <th className="th-right">Remaining (₹)</th>
                                                                <th>Due Date</th>
                                                                <th>Overdue</th>
                                                                <th className="th-right">Interest (₹)</th>
                                                                <th></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {duesDetail[d.customer_id].map(od => (
                                                                <tr key={od.order_id} className={od.is_overdue ? "dues-row-overdue" : ""}>
                                                                    <td>CP/{String(od.order_id).padStart(4, "0")}/{(new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1).toString().slice(-2)}-{(new Date().getMonth() >= 3 ? new Date().getFullYear() +1: new Date().getFullYear()).toString().slice(-2)}</td>
                                                                    <td className="td-right">{od.order_amount.toFixed(2)}</td>
                                                                    <td className="td-right">{od.remaining.toFixed(2)}</td>
                                                                    <td>{od.due_date || "—"}</td>
                                                                    <td>{od.days_overdue > 0 ? <span className="pay-debit">{od.days_overdue}d</span> : "—"}</td>
                                                                    <td className="td-right pay-debit">{od.interest > 0 ? od.interest.toFixed(2) : "—"}</td>
                                                                    <td><OrderInfoBtn customerId={d.customer_id} orderId={od.order_id} /></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td></tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {privileges?.create !== false && <button className="retrieval-fab" onClick={() => { setEditRecord(null); setShowForm(true); }} title="Record new payment">+</button>}
        </div>
    );
}

export default Payment;
