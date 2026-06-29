import { useState, useEffect, useLayoutEffect } from "react";
import "../styles/customer.css";
import ConfirmDialog from "../components/ConfirmDialog";
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getShippingAddresses } from "../api";
import ComboInput from "../components/ComboInput";
import ModalOverlay from "../components/ModalOverlay";

function CustomerList({ goBack, customers, setCustomers, privileges, createTrigger })
{
    const [formMode,      setFormMode]      = useState(null);
    const [editingId,     setEditingId]     = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [saveConfirm,   setSaveConfirm]   = useState(false);
    const [successMsg,    setSuccessMsg]    = useState("");
    const [formErrors,    setFormErrors]    = useState({});
    const [viewingCustomer, setViewingCustomer] = useState(null);
    const [apiError,      setApiError]      = useState("");
    const [loading,       setLoading]       = useState(false);

    // Search filters
    const [srchName,    setSrchName]    = useState("");
    const [srchEmail,   setSrchEmail]   = useState("");
    const [srchPhone,   setSrchPhone]   = useState("");
    const [srchCity,    setSrchCity]    = useState("");
    const [srchGst,     setSrchGst]     = useState("");

    const emptyForm = {
        fname: "", mname: "", lname: "",
        emails: [""],
        phones: [""],
        address: "", pincode: "", city: "", state: "", gst: "",
        shippingAddresses: [{ address: "", pincode: "", city: "", state: "", is_default: true, copyBilling: false }]
    };

    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        setLoading(true);
        getCustomers()
            .then(data => { setCustomers(data); setApiError(""); })
            .catch(err => setApiError(err.message || "Failed to load customers"))
            .finally(() => setLoading(false));
    }, []);

    // Open add form when triggered from quick actions
    useLayoutEffect(() => {
        if (createTrigger > 0) openAddForm();
    }, [createTrigger]);

    // Auto-retry when window regains focus if there was an error
    useEffect(() => {
        const retry = () => {
            if (apiError) {
                setLoading(true);
                getCustomers()
                    .then(data => { setCustomers(data); setApiError(""); })
                    .catch(() => {})
                    .finally(() => setLoading(false));
            }
        };
        window.addEventListener("focus", retry);
        return () => window.removeEventListener("focus", retry);
    }, [apiError]);

    const handleChange = (e) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    // ── Multi-value helpers ──────────────────────────────────
    const addEmail = () => setFormData(prev => ({ ...prev, emails: [...prev.emails, ""] }));
    const removeEmail = (idx) => setFormData(prev => ({ ...prev, emails: prev.emails.filter((_, i) => i !== idx) }));
    const setEmail = (idx, val) => setFormData(prev => ({ ...prev, emails: prev.emails.map((e, i) => i === idx ? val : e) }));

    const addPhone = () => setFormData(prev => ({ ...prev, phones: [...prev.phones, ""] }));
    const removePhone = (idx) => setFormData(prev => ({ ...prev, phones: prev.phones.filter((_, i) => i !== idx) }));
    const setPhone = (idx, val) => setFormData(prev => ({ ...prev, phones: prev.phones.map((p, i) => i === idx ? val : p) }));

    const addShipAddr = () => setFormData(prev => ({
        ...prev, shippingAddresses: [...prev.shippingAddresses, { address: "", pincode: "", city: "", state: "", is_default: false, copyBilling: false }]
    }));
    const removeShipAddr = (idx) => setFormData(prev => ({ ...prev, shippingAddresses: prev.shippingAddresses.filter((_, i) => i !== idx) }));
    const setShipAddr = (idx, field, val) => setFormData(prev => ({
        ...prev, shippingAddresses: prev.shippingAddresses.map((a, i) => i === idx ? { ...a, [field]: val } : a)
    }));
    const toggleCopyBilling = (idx) => {
        setFormData(prev => {
            const addrs = [...prev.shippingAddresses];
            const copy = !addrs[idx].copyBilling;
            addrs[idx] = copy
                ? { ...addrs[idx], copyBilling: true, address: prev.address, pincode: prev.pincode, city: prev.city, state: prev.state }
                : { ...addrs[idx], copyBilling: false };
            return { ...prev, shippingAddresses: addrs };
        });
    };
    const setShipDefault = (idx) => setFormData(prev => ({
        ...prev, shippingAddresses: prev.shippingAddresses.map((a, i) => ({ ...a, is_default: i === idx }))
    }));

    const validateForm = () =>
    {
        const errors = {};
        if (!formData.fname.trim())   errors.fname   = "First name is required";
        if (!formData.lname.trim())   errors.lname   = "Last name is required";
        if (!formData.emails[0]?.trim()) errors.email = "At least one email is required";
        if (!formData.phones[0]?.trim()) errors.phone = "At least one phone is required";
        if (!formData.address.trim()) errors.address = "Billing address is required";
        if (!String(formData.pincode).trim()) errors.pincode = "Pincode is required";
        if (!formData.city.trim())    errors.city    = "City is required";
        if (!formData.state.trim())   errors.state   = "State is required";
        if (!formData.gst.trim())     errors.gst     = "GST is required";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const fullName = (c) =>
        [c.fname, c.mname, c.lname].filter(Boolean).join(" ");

    const toApiPayload = () => ({
        fname:   formData.fname,
        mname:   formData.mname || null,
        lname:   formData.lname,
        contact: formData.phones.filter(Boolean).join(", "),
        email:   formData.emails.filter(Boolean).join(", "),
        address: formData.address,
        pincode: parseInt(formData.pincode, 10),
        state:   formData.state,
        city:    formData.city,
        gst:     formData.gst,
        shipping_addresses: formData.shippingAddresses
            .filter(a => a.address.trim())
            .map(a => ({ address: a.address, pincode: a.pincode ? parseInt(a.pincode) : null, city: a.city, state: a.state, is_default: a.is_default }))
    });

    // ── Add ─────────────────────────────────────────────────
    const openAddForm = () => { setFormData(emptyForm); setFormErrors({}); setApiError(""); setEditingId(null); setFormMode("add"); };

    const handleAdd = async () =>
    {
        if (!validateForm()) return;
        setApiError("");
        try {
            await addCustomer(toApiPayload());
            const fresh = await getCustomers();
            setCustomers(fresh);
            setFormData(emptyForm); setFormErrors({}); setFormMode(null);
            showSuccess("Customer added successfully");
        } catch (err) { setApiError(err.message || "Failed to add customer"); }
    };

    // ── Edit ─────────────────────────────────────────────────
    const handleEditClick = async (customer) =>
    {
        // Load shipping addresses
        let shipAddrs = [];
        try { shipAddrs = await getShippingAddresses(customer.customer_id); } catch {}

        const emails = (customer.email || "").split(",").map(e => e.trim()).filter(Boolean);
        const phones = (customer.contact || "").split(",").map(p => p.trim()).filter(Boolean);

        setFormData({
            fname:   customer.fname   || "",
            mname:   customer.mname   || "",
            lname:   customer.lname   || "",
            emails:  emails.length > 0 ? emails : [""],
            phones:  phones.length > 0 ? phones : [""],
            address: customer.address || "",
            pincode: String(customer.pincode || ""),
            city:    customer.city    || "",
            state:   customer.state   || "",
            gst:     customer.gst     || "",
            shippingAddresses: shipAddrs.length > 0
                ? shipAddrs.map(a => ({ address: a.address || "", pincode: String(a.pincode || ""), city: a.city || "", state: a.state || "", is_default: a.is_default, copyBilling: false }))
                : [{ address: "", pincode: "", city: "", state: "", is_default: true, copyBilling: false }]
        });
        setFormErrors({}); setApiError("");
        setEditingId(customer.customer_id);
        setFormMode("edit");
    };

    const handleSaveClick = () => { if (!validateForm()) return; setSaveConfirm(true); };

    const confirmSave = async () =>
    {
        setSaveConfirm(false); setApiError("");
        try {
            await updateCustomer(editingId, toApiPayload());
            const fresh = await getCustomers();
            setCustomers(fresh);
            setEditingId(null); setFormData(emptyForm); setFormErrors({}); setFormMode(null);
            showSuccess("Customer updated successfully");
        } catch (err) { setApiError(err.message || "Failed to update customer"); }
    };

    const handleCancelForm = () => { setFormMode(null); setEditingId(null); setFormData(emptyForm); setFormErrors({}); setApiError(""); };

    // ── Delete ───────────────────────────────────────────────
    const handleDeleteClick = (customer) => setDeleteConfirm(customer);

    const confirmDelete = async () =>
    {
        const id = deleteConfirm.customer_id;
        setDeleteConfirm(null); setApiError("");
        try {
            await deleteCustomer(id);
            const fresh = await getCustomers();
            setCustomers(fresh);
            showSuccess("Customer deleted successfully");
        } catch (err) { setApiError(err.message || "Failed to delete customer"); }
    };

    const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 2500); };

    const formOpen = formMode !== null;

    return (
        <div className="customer-container">

            <div className="customer-header-row">
                <h1>Customer List</h1>
                <div className="customer-toolbar">
                    <button className="cust-refresh-btn" disabled={loading} onClick={() => {
                        setLoading(true);
                        setApiError("");
                        getCustomers().then(d => setCustomers(d)).catch(err => setApiError(err.message || "Failed")).finally(() => setLoading(false));
                    }}>↻</button>
                    <button className="cust-clear-btn" onClick={() => {
                        setSrchName(""); setSrchEmail(""); setSrchPhone(""); setSrchCity(""); setSrchGst("");
                    }}>✕ Clear</button>
                </div>
            </div>

            {successMsg && <div className="success-msg">{successMsg}</div>}
            {apiError   && <div className="api-error">{apiError}</div>}

            <ConfirmDialog open={saveConfirm} variant="success" title="Save Changes"
                message={<>Save changes to <strong>{fullName(formData)}</strong>?</>}
                confirmLabel="Yes, Save" cancelLabel="Go Back"
                onConfirm={confirmSave} onCancel={() => setSaveConfirm(false)} />

            <ConfirmDialog open={!!deleteConfirm} variant="danger" title="Delete Customer"
                message={<>Permanently delete <strong>{deleteConfirm ? fullName(deleteConfirm) : ""}</strong>? This cannot be undone.</>}
                confirmLabel="Yes, Delete" cancelLabel="Cancel"
                onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)} />

            {!formOpen && privileges?.create !== false && <button className="customer-fab" onClick={openAddForm} title="Add new customer">+</button>}

            {/* ── View Modal ── */}
            {viewingCustomer && (
                <ModalOverlay open={true} title={`Customer: ${fullName(viewingCustomer)}`} onClose={() => setViewingCustomer(null)}>
                    <div className="customer-form viewonly-form">
                        <div className="form-row form-row-inline">
                            <label className="row-label">Name</label>
                            <div className="row-fields">
                                <div className="field-wrap"><input value={viewingCustomer.fname||""} readOnly /></div>
                                <div className="field-wrap"><input value={viewingCustomer.mname||""} readOnly /></div>
                                <div className="field-wrap"><input value={viewingCustomer.lname||""} readOnly /></div>
                            </div>
                        </div>
                        <div className="form-row form-row-inline">
                            <label className="row-label">Contact</label>
                            <div className="row-fields">
                                <div className="field-wrap"><input value={viewingCustomer.email||""} readOnly /></div>
                                <div className="field-wrap"><input value={viewingCustomer.contact||""} readOnly /></div>
                            </div>
                        </div>
                        <div className="form-row form-row-inline">
                            <label className="row-label">Address</label>
                            <div className="row-fields">
                                <div className="field-wrap field-wrap-grow"><textarea value={viewingCustomer.address||""} readOnly rows={2} /></div>
                                <div className="field-wrap"><input value={String(viewingCustomer.pincode||"")} readOnly /></div>
                            </div>
                        </div>
                        <div className="form-row form-row-inline">
                            <label className="row-label">Details</label>
                            <div className="row-fields">
                                <div className="field-wrap"><input value={viewingCustomer.city||""} readOnly /></div>
                                <div className="field-wrap"><input value={viewingCustomer.state||""} readOnly /></div>
                                <div className="field-wrap"><input value={viewingCustomer.gst||""} readOnly /></div>
                            </div>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {/* ── Add/Edit Form Modal ── */}
            <ModalOverlay open={formOpen} title={formMode === "edit" ? "Edit Customer" : "Add New Customer"} onClose={handleCancelForm}>
                <div className="customer-form">

                    {/* Name */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Name</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input name="fname" value={formData.fname} onChange={handleChange} placeholder="First Name" />
                                {formErrors.fname && <span className="field-error">{formErrors.fname}</span>}
                            </div>
                            <div className="field-wrap"><input name="mname" value={formData.mname} onChange={handleChange} placeholder="Middle Name" /></div>
                            <div className="field-wrap">
                                <input name="lname" value={formData.lname} onChange={handleChange} placeholder="Last Name" />
                                {formErrors.lname && <span className="field-error">{formErrors.lname}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Emails + Phones (same row) */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Contact</label>
                        <div className="row-fields row-fields-side">
                            <div className="row-fields-col" style={{ flex: 2 }}>
                                {formData.emails.map((em, idx) => (
                                    <div key={idx} className="multi-field-row">
                                        <input value={em} onChange={e => setEmail(idx, e.target.value)} placeholder="Email" />
                                        {formData.emails.length > 1 && <button className="multi-remove" onClick={() => removeEmail(idx)}>✕</button>}
                                    </div>
                                ))}
                                <button className="multi-add-btn" onClick={addEmail}>+ Add Email</button>
                                {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                            </div>
                            <div className="row-fields-col" style={{ flex: 1 }}>
                                {formData.phones.map((ph, idx) => (
                                    <div key={idx} className="multi-field-row">
                                        <input value={ph} onChange={e => setPhone(idx, e.target.value)} placeholder="Phone Number" />
                                        {formData.phones.length > 1 && <button className="multi-remove" onClick={() => removePhone(idx)}>✕</button>}
                                    </div>
                                ))}
                                <button className="multi-add-btn" onClick={addPhone}>+ Add Phone</button>
                                {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                            </div>
                        </div>
                    </div>

                    {/* GSTIN */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">GSTIN/UIN</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input name="gst" value={formData.gst} onChange={handleChange} placeholder="GST Number" />
                                {formErrors.gst && <span className="field-error">{formErrors.gst}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Billing Address */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Billing Address</label>
                        <div className="row-fields">
                            <div className="field-wrap field-wrap-grow">
                                <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Building / Area" rows={2} />
                                {formErrors.address && <span className="field-error">{formErrors.address}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="pincode" value={formData.pincode} onChange={handleChange} placeholder="Pincode" />
                                {formErrors.pincode && <span className="field-error">{formErrors.pincode}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="form-row form-row-inline">
                        <label className="row-label"></label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input name="city" value={formData.city} onChange={handleChange} placeholder="City" />
                                {formErrors.city && <span className="field-error">{formErrors.city}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="state" value={formData.state} onChange={handleChange} placeholder="State" />
                                {formErrors.state && <span className="field-error">{formErrors.state}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Shipping Addresses (multi) */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Shipping Address(es)</label>
                        <div className="row-fields row-fields-col">
                            {formData.shippingAddresses.map((sa, idx) => (
                                <div key={idx} className="shipping-addr-card">
                                    <div className="sa-header">
                                        <label className="sa-checkbox">
                                            <input type="checkbox" checked={sa.is_default} onChange={() => setShipDefault(idx)} /> Default
                                        </label>
                                        <label className="sa-checkbox">
                                            <input type="checkbox" checked={sa.copyBilling} onChange={() => toggleCopyBilling(idx)} /> Copy from Billing
                                        </label>
                                        {formData.shippingAddresses.length > 1 && <button className="multi-remove" onClick={() => removeShipAddr(idx)}>✕</button>}
                                    </div>
                                    <div className="sa-fields">
                                        <textarea value={sa.address} onChange={e => setShipAddr(idx, "address", e.target.value)}
                                            placeholder="Building / Area" rows={2} disabled={sa.copyBilling} />
                                        <div className="sa-row">
                                            <input value={sa.pincode} onChange={e => setShipAddr(idx, "pincode", e.target.value)}
                                                placeholder="Pincode" disabled={sa.copyBilling} />
                                            <input value={sa.city} onChange={e => setShipAddr(idx, "city", e.target.value)}
                                                placeholder="City" disabled={sa.copyBilling} />
                                            <input value={sa.state} onChange={e => setShipAddr(idx, "state", e.target.value)}
                                                placeholder="State" disabled={sa.copyBilling} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className="multi-add-btn" onClick={addShipAddr}>+ Add Shipping Address</button>
                        </div>
                    </div>

                    <div className="form-action-row">
                        <button className="submit-customer-btn" onClick={formMode === "edit" ? handleSaveClick : handleAdd}>
                            {formMode === "edit" ? "Save Changes" : "Add Customer"}
                        </button>
                        <button className="cancel-form-btn" onClick={handleCancelForm}>Cancel</button>
                    </div>
                </div>
            </ModalOverlay>

            {/* ── Table ── */}
            <div className="customer-table-wrapper">
                {loading ? (
                    <div className="no-records">Loading customers…</div>
                ) : customers.length === 0 ? (
                    <div className="no-records">No customer records available.</div>
                ) : (
                    <table className="customer-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th className="col-address">Address</th>
                                <th>City</th>
                                <th>GST</th>
                                <th className="col-actions">Actions</th>
                            </tr>
                            <tr className="cust-filter-row">
                                <td><ComboInput className="col-filter" value={srchName} onChange={e => setSrchName(e.target.value)} placeholder="Name…" options={[...new Set(customers.map(c => fullName(c)))]} id="cf-name" /></td>
                                <td><ComboInput className="col-filter" value={srchEmail} onChange={e => setSrchEmail(e.target.value)} placeholder="Email…" options={[...new Set(customers.map(c => c.email).filter(Boolean))]} id="cf-email" /></td>
                                <td><ComboInput className="col-filter" value={srchPhone} onChange={e => setSrchPhone(e.target.value)} placeholder="Phone…" options={[...new Set(customers.map(c => c.contact).filter(Boolean))]} id="cf-phone" /></td>
                                <td></td>
                                <td><ComboInput className="col-filter" value={srchCity} onChange={e => setSrchCity(e.target.value)} placeholder="City…" options={[...new Set(customers.map(c => c.city).filter(Boolean))]} id="cf-city" /></td>
                                <td><ComboInput className="col-filter" value={srchGst} onChange={e => setSrchGst(e.target.value)} placeholder="GST…" options={[...new Set(customers.map(c => c.gst).filter(Boolean))]} id="cf-gst" /></td>
                                <td></td>
                            </tr>
                        </thead>
                        <tbody>
                            {customers
                                .filter(c => {
                                    const name = fullName(c).toLowerCase();
                                    return (!srchName  || name.includes(srchName.toLowerCase())) &&
                                           (!srchEmail || (c.email||"").toLowerCase().includes(srchEmail.toLowerCase())) &&
                                           (!srchPhone || (c.contact||"").includes(srchPhone)) &&
                                           (!srchCity  || (c.city||"").toLowerCase().includes(srchCity.toLowerCase())) &&
                                           (!srchGst   || (c.gst||"").toLowerCase().includes(srchGst.toLowerCase()));
                                })
                                .map(customer => (
                                <tr key={customer.customer_id} className={editingId === customer.customer_id ? "row-editing" : ""}>
                                    <td>{fullName(customer)}</td>
                                    <td>{customer.email}</td>
                                    <td>{customer.contact}</td>
                                    <td className="col-address"><div className="address-cell">{customer.address}</div></td>
                                    <td>{customer.city}</td>
                                    <td>{customer.gst}</td>
                                    <td className="col-actions">
                                        <button className="view-btn" title="View" onClick={() => setViewingCustomer(customer)}>🔍</button>
                                        {privileges?.edit !== false && <button className="edit-btn" onClick={() => handleEditClick(customer)}>✎</button>}
                                        {privileges?.delete !== false && <button className="delete-btn" onClick={() => handleDeleteClick(customer)}>🗑</button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    );
}

export default CustomerList;
