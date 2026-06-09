import { useState, useEffect } from "react";
import "../styles/customer.css";
import ConfirmDialog from "../components/ConfirmDialog";
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from "../api";
import ComboInput from "../components/ComboInput";
import ModalOverlay from "../components/ModalOverlay";

function CustomerList({ goBack, customers, setCustomers })
{
    const [formMode,      setFormMode]      = useState(null); // "add" | "edit" | null
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
    const [srchState,   setSrchState]   = useState("");
    const [srchGst,     setSrchGst]     = useState("");
    const [srchPincode, setSrchPincode] = useState("");

    const emptyForm = {
        fname: "", mname: "", lname: "",
        email: "", phone: "", address: "",
        pincode: "", city: "", state: "", gst: ""
    };

    const [formData, setFormData] = useState(emptyForm);

    // ── Load customers on mount ──────────────────────────────
    useEffect(() => {
        setLoading(true);
        getCustomers()
            .then(data => setCustomers(data))
            .catch(err => setApiError(err.message || "Failed to load customers"))
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (e) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const validateForm = () =>
    {
        const errors = {};
        if (!formData.fname.trim())   errors.fname   = "First name is required";
        if (!formData.lname.trim())   errors.lname   = "Last name is required";
        if (!formData.email.trim())   errors.email   = "Email is required";
        if (!formData.phone.trim())   errors.phone   = "Phone is required";
        if (!formData.address.trim()) errors.address = "Billing address is required";
        if (!formData.pincode.trim()) errors.pincode = "Pincode is required";
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
        contact: formData.phone,
        email:   formData.email,
        address: formData.address,
        pincode: parseInt(formData.pincode, 10),
        state:   formData.state,
        city:    formData.city,
        gst:     formData.gst
    });

    // ── Add ─────────────────────────────────────────────────
    const openAddForm = () =>
    {
        setFormData(emptyForm);
        setFormErrors({});
        setApiError("");
        setEditingId(null);
        setFormMode("add");
    };

    const handleAdd = async () =>
    {
        if (!validateForm()) return;
        setApiError("");
        try {
            await addCustomer(toApiPayload());
            const fresh = await getCustomers();
            setCustomers(fresh);
            setFormData(emptyForm);
            setFormErrors({});
            setFormMode(null);
            showSuccess("Customer added successfully");
        } catch (err) {
            setApiError(err.message || "Failed to add customer");
        }
    };

    // ── Edit ─────────────────────────────────────────────────
    const handleEditClick = (customer) =>
    {
        setFormData({
            fname:   customer.fname   || "",
            mname:   customer.mname   || "",
            lname:   customer.lname   || "",
            email:   customer.email   || "",
            phone:   customer.contact || "",
            address: customer.address || "",
            pincode: customer.pincode || "",
            city:    customer.city    || "",
            state:   customer.state   || "",
            gst:     customer.gst     || ""
        });
        setFormErrors({});
        setApiError("");
        setEditingId(customer.customer_id);
        setFormMode("edit");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSaveClick = () =>
    {
        if (!validateForm()) return;
        setSaveConfirm(true);
    };

    const confirmSave = async () =>
    {
        setSaveConfirm(false);
        setApiError("");
        try {
            await updateCustomer(editingId, toApiPayload());
            const fresh = await getCustomers();
            setCustomers(fresh);
            setEditingId(null);
            setFormData(emptyForm);
            setFormErrors({});
            setFormMode(null);
            showSuccess("Customer updated successfully");
        } catch (err) {
            setApiError(err.message || "Failed to update customer");
        }
    };

    const handleCancelForm = () =>
    {
        setFormMode(null);
        setEditingId(null);
        setFormData(emptyForm);
        setFormErrors({});
        setApiError("");
    };

    // ── Delete ───────────────────────────────────────────────
    const handleDeleteClick = (customer) => setDeleteConfirm(customer);

    const confirmDelete = async () =>
    {
        const id = deleteConfirm.customer_id;
        setDeleteConfirm(null);
        setApiError("");
        try {
            await deleteCustomer(id);
            setCustomers(customers.filter(c => c.customer_id !== id));
            showSuccess("Customer deleted successfully");
        } catch (err) {
            setApiError(err.message || "Failed to delete customer");
        }
    };

    const showSuccess = (msg) =>
    {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(""), 2500);
    };

    const formOpen = formMode !== null;

    return (
        <div className="customer-container">

            <div className="customer-header-row">
                <h1>Customer List</h1>
                <div className="customer-toolbar">
                    <button className="cust-refresh-btn" onClick={() => {
                        setLoading(true);
                        getCustomers().then(d => setCustomers(d)).catch(() => {}).finally(() => setLoading(false));
                    }}>↻</button>
                    <button className="cust-clear-btn" onClick={() => {
                        setSrchName(""); setSrchEmail(""); setSrchPhone("");
                        setSrchCity(""); setSrchState(""); setSrchGst(""); setSrchPincode("");
                    }}>✕ Clear</button>
                </div>
            </div>

            {successMsg && <div className="success-msg">{successMsg}</div>}
            {apiError   && <div className="api-error">{apiError}</div>}

            {/* ── Save confirmation ── */}
            <ConfirmDialog
                open={saveConfirm}
                variant="success"
                title="Save Changes"
                message={<>Save changes to <strong>{fullName(formData)}</strong>?</>}
                confirmLabel="Yes, Save"
                cancelLabel="Go Back"
                onConfirm={confirmSave}
                onCancel={() => setSaveConfirm(false)}
            />

            {/* ── Delete confirmation ── */}
            <ConfirmDialog
                open={!!deleteConfirm}
                variant="danger"
                title="Delete Customer"
                message={
                    <>
                        Are you sure you want to permanently delete{" "}
                        <strong>{deleteConfirm ? fullName(deleteConfirm) : ""}</strong>?
                        This cannot be undone.
                    </>
                }
                confirmLabel="Yes, Delete"
                cancelLabel="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm(null)}
            />

            {/* ── Add / Edit form ── */}
            {!formOpen && (
                <button className="customer-fab" onClick={openAddForm} title="Add new customer">+</button>
            )}

            {/* View customer modal */}
            {viewingCustomer && (
                <ModalOverlay open={true}
                    title={`Customer: ${fullName(viewingCustomer)}`}
                    onClose={() => setViewingCustomer(null)}>
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

            <ModalOverlay
                open={formOpen}
                title={formMode === "edit" ? "Edit Customer" : "Add New Customer"}
                onClose={handleCancelForm}
            >
                <div className="customer-form">

                    {/* Row 1: Name */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Name</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input name="fname" maxLength={100} value={formData.fname} onChange={handleChange} placeholder="First Name" />
                                {formErrors.fname && <span className="field-error">{formErrors.fname}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="mname" maxLength={100} value={formData.mname} onChange={handleChange} placeholder="Middle Name" />
                            </div>
                            <div className="field-wrap">
                                <input name="lname" maxLength={100} value={formData.lname} onChange={handleChange} placeholder="Last Name" />
                                {formErrors.lname && <span className="field-error">{formErrors.lname}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Email + Phone */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Contact</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input name="email" maxLength={100} value={formData.email} onChange={handleChange} placeholder="Email" />
                                {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="phone" maxLength={100} value={formData.phone} onChange={handleChange} placeholder="Phone Number" />
                                {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Address + Pincode */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Billing Address</label>
                        <div className="row-fields">
                            <div className="field-wrap field-wrap-grow">
                                <textarea name="address" maxLength={200} value={formData.address} onChange={handleChange} placeholder="Billing Address" rows={3} />
                                {formErrors.address && <span className="field-error">{formErrors.address}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="pincode" maxLength={20} value={formData.pincode} onChange={handleChange} placeholder="Pincode" />
                                {formErrors.pincode && <span className="field-error">{formErrors.pincode}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Row 4: City + State + GST */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Details</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input name="city" maxLength={100} value={formData.city} onChange={handleChange} placeholder="City" />
                                {formErrors.city && <span className="field-error">{formErrors.city}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="state" maxLength={100} value={formData.state} onChange={handleChange} placeholder="State" />
                                {formErrors.state && <span className="field-error">{formErrors.state}</span>}
                            </div>
                            <div className="field-wrap">
                                <input name="gst" maxLength={100} value={formData.gst} onChange={handleChange} placeholder="GST Number" />
                                {formErrors.gst && <span className="field-error">{formErrors.gst}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="form-action-row">
                        <button
                            className="submit-customer-btn"
                            onClick={formMode === "edit" ? handleSaveClick : handleAdd}
                        >
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
                                <td><ComboInput value={srchName}    onChange={e => setSrchName(e.target.value)}    placeholder="Name…" options={[...new Set(customers.map(c => fullName(c)))]} id="cf-name" /></td>
                                <td><ComboInput value={srchEmail}   onChange={e => setSrchEmail(e.target.value)}   placeholder="Email…" options={[...new Set(customers.map(c => c.email).filter(Boolean))]} id="cf-email" /></td>
                                <td><ComboInput value={srchPhone}   onChange={e => setSrchPhone(e.target.value)}   placeholder="Phone…" options={[...new Set(customers.map(c => c.contact).filter(Boolean))]} id="cf-phone" /></td>
                                <td></td>
                                <td><ComboInput value={srchCity}    onChange={e => setSrchCity(e.target.value)}    placeholder="City…" options={[...new Set(customers.map(c => c.city).filter(Boolean))]} id="cf-city" /></td>
                                <td><ComboInput value={srchGst}     onChange={e => setSrchGst(e.target.value)}     placeholder="GST…" options={[...new Set(customers.map(c => c.gst).filter(Boolean))]} id="cf-gst" /></td>
                                <td></td>
                            </tr>
                        </thead>
                        <tbody>
                            {customers
                                .filter(c => {
                                    const name = fullName(c).toLowerCase();
                                    return (!srchName    || name.includes(srchName.toLowerCase())) &&
                                           (!srchEmail   || (c.email||"").toLowerCase().includes(srchEmail.toLowerCase())) &&
                                           (!srchPhone   || (c.contact||"").includes(srchPhone)) &&
                                           (!srchCity    || (c.city||"").toLowerCase().includes(srchCity.toLowerCase())) &&
                                           (!srchGst     || (c.gst||"").toLowerCase().includes(srchGst.toLowerCase()));
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
                                        <button className="edit-btn" onClick={() => handleEditClick(customer)}>✎</button>
                                        <button className="delete-btn" onClick={() => handleDeleteClick(customer)}>🗑</button>
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
