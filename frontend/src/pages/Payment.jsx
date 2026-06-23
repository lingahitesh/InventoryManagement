import { useState, useEffect, useCallback, useRef } from "react";
import "../styles/payment.css";
import { getPayments, addPayment, updatePayment, deletePayment, getCustomers, getCustomerBalance, getOrders, downloadLedger } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import ModalOverlay from "../components/ModalOverlay";
import ComboInput from "../components/ComboInput";

// ── Payment Form (add / edit) ─────────────────────────────────
function PaymentForm({ editRecord, customers, orders, onClose, onSuccess })
{
    const [customerId,   setCustomerId]   = useState(editRecord?.customer_id || "");
    const [orderId,      setOrderId]      = useState(editRecord?.order_id    || "");
    const [amtPaid,      setAmtPaid]      = useState(editRecord ? String(editRecord.amt_paid) : "");
    const [paymentDate,  setPaymentDate]  = useState(editRecord?.payment_date || new Date().toISOString().slice(0, 10));
    const [notes,        setNotes]        = useState(editRecord?.notes || "");
    const [balance,      setBalance]      = useState(null);
    const [error,        setError]        = useState("");

    const fullName = (c) => [c.fname, c.mname, c.lname].filter(Boolean).join(" ");

    useEffect(() => {
        if (customerId) {
            getCustomerBalance(customerId).then(setBalance).catch(() => setBalance(null));
        } else {
            setBalance(null);
        }
    }, [customerId]);

    const custOrders = orders.filter(o => o.customer_id === parseInt(customerId));

    const handleSubmit = async () => {
        if (!customerId)      { setError("Customer is required"); return; }
        if (!amtPaid || isNaN(parseFloat(amtPaid)) || parseFloat(amtPaid) <= 0)
            { setError("Enter a valid amount"); return; }
        if (!paymentDate)     { setError("Payment date is required"); return; }
        setError("");
        const payload = {
            customer_id:  parseInt(customerId),
            amt_paid:     parseFloat(amtPaid),
            payment_date: paymentDate,
            order_id:     orderId ? parseInt(orderId) : null,
            notes:        notes || null,
        };
        try {
            if (editRecord) { await updatePayment(editRecord.payment_id, payload); }
            else            { await addPayment(payload); }
            onSuccess();
        } catch (err) { setError(err.message || "Failed to save payment"); }
    };

    return (
        <div className="payment-form">
            {error && <div className="pay-error">{error}</div>}

            <div className="pf-grid">
                <div className="pf-field pf-span2">
                    <label>Customer *</label>
                    <select value={customerId} onChange={e => { setCustomerId(e.target.value); setOrderId(""); }}>
                        <option value="">-- Select Customer --</option>
                        {customers.map(c => (
                            <option key={c.customer_id} value={c.customer_id}>{fullName(c)}</option>
                        ))}
                    </select>
                </div>

                {balance && (
                    <div className="pf-balance pf-span2">
                        <span>Total Billed: <strong>₹{balance.total_billed.toFixed(2)}</strong></span>
                        <span>Total Paid: <strong>₹{balance.total_paid.toFixed(2)}</strong></span>
                        <span className={balance.amt_due > 0 ? "pay-due-pos" : "pay-due-zero"}>
                            Amount Due: <strong>₹{balance.amt_due.toFixed(2)}</strong>
                        </span>
                    </div>
                )}

                <div className="pf-field">
                    <label>Amount Paid (₹) *</label>
                    <input type="number" min="0" step="1" value={amtPaid}
                        onChange={e => setAmtPaid(e.target.value)} placeholder="0.00" />
                </div>

                <div className="pf-field">
                    <label>Payment Date *</label>
                    <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>

                <div className="pf-field pf-span2">
                    <label>Against Order (optional)</label>
                    <select value={orderId} onChange={e => setOrderId(e.target.value)}>
                        <option value="">-- None --</option>
                        {custOrders.map(o => (
                            <option key={o.order_id} value={o.order_id}>
                                Order #{o.order_id} — ₹{parseFloat(o.total_amount).toFixed(2)} ({o.order_date?.slice(0, 10)})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="pf-field pf-span2">
                    <label>Notes (optional)</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Cheque no. 12345" />
                </div>
            </div>

            <div className="pf-actions">
                <button className="cancel-btn" onClick={onClose}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmit}>
                    {editRecord ? "Save Changes" : "Record Payment"}
                </button>
            </div>
        </div>
    );
}

// ── Main Payment Page ─────────────────────────────────────────
function Payment()
{
    const [payments,   setPayments]   = useState([]);
    const [customers,  setCustomers]  = useState([]);
    const [orders,     setOrders]     = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState("");

    // Search state
    const [srchCustomer, setSrchCustomer] = useState("");
    const [srchDateFrom, setSrchDateFrom] = useState("");
    const [srchDateTo,   setSrchDateTo]   = useState("");
    const [srchAmtMin,   setSrchAmtMin]   = useState("");
    const [srchAmtMax,   setSrchAmtMax]   = useState("");

    // UI state
    const [showForm,    setShowForm]    = useState(false);
    const [editRecord,  setEditRecord]  = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showLedger,  setShowLedger]  = useState(false);

    // Ledger state — default: last 6 months to today
    const today = new Date().toISOString().slice(0, 10);
    const sixMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().slice(0, 10);
    const [ledgerCustomer, setLedgerCustomer] = useState("");
    const [ledgerFrom,     setLedgerFrom]     = useState(sixMonthsAgo);
    const [ledgerTo,       setLedgerTo]       = useState(today);
    const [ledgerLoading,  setLedgerLoading]  = useState(false);
    const [ledgerError,    setLedgerError]    = useState("");

    const initialLoadDone = useRef(false);

    const fetchAll = useCallback(async (showLoader = false) => {
        if (!initialLoadDone.current || showLoader) setLoading(true);
        try {
            const [p, c, o] = await Promise.all([getPayments(), getCustomers(), getOrders()]);
            setPayments(p); setCustomers(c); setOrders(o);
            setError("");
            initialLoadDone.current = true;
        } catch (err) { setError(err.message || "Failed to load"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Auto-retry when window regains focus if there was an error
    useEffect(() => {
        const retry = () => { if (error) fetchAll(); };
        window.addEventListener("focus", retry);
        return () => window.removeEventListener("focus", retry);
    }, [error, fetchAll]);

    const handleDelete = async () => {
        const id = deleteTarget;
        setDeleteTarget(null);
        try {
            await deletePayment(id);
            fetchAll();
        } catch (err) { setError(err.message || "Failed to delete payment"); }
    };

    const fullName = (c) => [c.fname, c.mname, c.lname].filter(Boolean).join(" ");

    // Filter payments
    const filtered = payments.filter(p => {
        const custName = (p.customer_name || "").toLowerCase();
        const nm = !srchCustomer.trim() || custName.includes(srchCustomer.toLowerCase());
        const dfrom = !srchDateFrom || (p.payment_date || "") >= srchDateFrom;
        const dto   = !srchDateTo   || (p.payment_date || "") <= srchDateTo;
        const amin  = !srchAmtMin   || parseFloat(p.amt_paid) >= parseFloat(srchAmtMin);
        const amax  = !srchAmtMax   || parseFloat(p.amt_paid) <= parseFloat(srchAmtMax);
        return nm && dfrom && dto && amin && amax;
    });

    const fmt = (v) => v != null ? parseFloat(v).toFixed(2) : "—";

    const clearFilters = () => {
        setSrchCustomer(""); setSrchDateFrom(""); setSrchDateTo("");
        setSrchAmtMin(""); setSrchAmtMax("");
    };

    const handleLedgerDownload = async () => {
        if (!ledgerCustomer) { setLedgerError("Select a customer"); return; }
        setLedgerLoading(true); setLedgerError("");
        try {
            const blob = await downloadLedger(ledgerCustomer, ledgerFrom, ledgerTo);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Ledger_${ledgerCustomer}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            setShowLedger(false);
        } catch (err) { setLedgerError(err.message || "Failed to generate ledger"); }
        finally { setLedgerLoading(false); }
    };

    return (
        <div className="payment-container">

            <ConfirmDialog open={!!deleteTarget} variant="danger" title="Delete Payment"
                message={<>Delete this payment record? This cannot be undone.</>}
                confirmLabel="Yes, Delete" cancelLabel="Cancel"
                onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

            {/* ── Ledger Modal ── */}
            {showLedger && (
                <ModalOverlay open={true} title="Generate Ledger" onClose={() => { setShowLedger(false); setLedgerError(""); }}>
                    <div className="ledger-modal-form">
                        {ledgerError && <div className="pay-error">{ledgerError}</div>}
                        <div className="pf-grid">
                            <div className="pf-field pf-span2">
                                <label>Customer *</label>
                                <select value={ledgerCustomer} onChange={e => setLedgerCustomer(e.target.value)}>
                                    <option value="">-- Select Customer --</option>
                                    {customers.map(c => (
                                        <option key={c.customer_id} value={c.customer_id}>{fullName(c)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pf-field">
                                <label>From Date</label>
                                <input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} />
                            </div>
                            <div className="pf-field">
                                <label>To Date</label>
                                <input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} />
                            </div>
                        </div>
                        <div className="pf-actions">
                            <button className="cancel-btn" onClick={() => setShowLedger(false)}>Cancel</button>
                            <button className="submit-btn" onClick={handleLedgerDownload} disabled={ledgerLoading}>
                                {ledgerLoading ? "Generating…" : "📥 Download Ledger"}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {/* ── Header ── */}
            <div className="payment-header-row">
                <h1>Payments</h1>
                <div className="payment-toolbar">
                    <button className="rtb-btn" onClick={() => setShowLedger(true)}>📒 Ledger</button>
                    <button className="rtb-btn" onClick={() => { fetchAll(true); }} disabled={loading}>↻</button>
                    <button className="rtb-btn" onClick={clearFilters}>✕ Clear</button>
                </div>
            </div>

            {error && <div className="pay-error">{error}</div>}

            {/* ── Search Bar ── */}
            <div className="pay-search-bar">
                <div className="pay-search-field">
                    <label>Customer</label>
                    <ComboInput value={srchCustomer} onChange={e => setSrchCustomer(e.target.value)}
                        options={[...new Set(customers.map(c => fullName(c)))]}
                        placeholder="Name…" id="ps-cust" />
                </div>
                <div className="pay-search-field">
                    <label>Date From</label>
                    <input type="date" value={srchDateFrom} onChange={e => setSrchDateFrom(e.target.value)} />
                </div>
                <div className="pay-search-field">
                    <label>Date To</label>
                    <input type="date" value={srchDateTo} onChange={e => setSrchDateTo(e.target.value)} />
                </div>
                <div className="pay-search-field">
                    <label>Amt Min (₹)</label>
                    <input type="number" min="0" value={srchAmtMin} onChange={e => setSrchAmtMin(e.target.value)} placeholder="0" />
                </div>
                <div className="pay-search-field">
                    <label>Amt Max (₹)</label>
                    <input type="number" min="0" value={srchAmtMax} onChange={e => setSrchAmtMax(e.target.value)} placeholder="∞" />
                </div>
            </div>

            {/* ── New / Edit Form Modal ── */}
            {showForm && (
                <ModalOverlay open={true}
                    title={editRecord ? "Edit Payment" : "Record Payment"}
                    onClose={() => { setShowForm(false); setEditRecord(null); }}>
                    <PaymentForm
                        editRecord={editRecord}
                        customers={customers}
                        orders={orders}
                        onClose={() => { setShowForm(false); setEditRecord(null); }}
                        onSuccess={() => { setShowForm(false); setEditRecord(null); fetchAll(); }}
                    />
                </ModalOverlay>
            )}

            {/* ── Table ── */}
            {loading && <div className="pay-placeholder">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="pay-placeholder">No payment records found.</div>}

            {!loading && filtered.length > 0 && (
                <div className="pay-table-wrapper">
                    <table className="pay-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Customer</th>
                                <th>Order</th>
                                <th>Amount Paid (₹)</th>
                                <th>Amount Due (₹)</th>
                                <th>Date</th>
                                <th>Notes</th>
                                <th className="col-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => {
                                // Compute per-customer amt_due dynamically from loaded data
                                const custOrders = orders.filter(o => o.customer_id === p.customer_id);
                                const totalBilled = custOrders.reduce((s, o) => s + (parseFloat(o.total_with_gst) || 0), 0);
                                const totalPaid = payments.filter(x => x.customer_id === p.customer_id).reduce((s, x) => s + (parseFloat(x.amt_paid) || 0), 0);
                                const amtDue = totalBilled - totalPaid;
                                return (
                                    <tr key={p.payment_id}>
                                        <td>{p.payment_id}</td>
                                        <td>{p.customer_name}</td>
                                        <td>{p.order_id ? `#${p.order_id}` : "—"}</td>
                                        <td className="td-price pay-credit">+{fmt(p.amt_paid)}</td>
                                        <td className={`td-price ${amtDue > 0.01 ? "pay-debit" : "pay-zero"}`}>
                                            {amtDue.toFixed(2)}
                                        </td>
                                        <td>{p.payment_date || "—"}</td>
                                        <td className="pay-notes">{p.notes || "—"}</td>
                                        <td className="col-actions">
                                            <button className="ol-edit-btn" onClick={() => { setEditRecord(p); setShowForm(true); }}>✎</button>
                                            <button className="ol-delete-btn" onClick={() => setDeleteTarget(p.payment_id)}>🗑</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <button className="retrieval-fab" onClick={() => { setEditRecord(null); setShowForm(true); }} title="Record new payment">+</button>
        </div>
    );
}

export default Payment;
