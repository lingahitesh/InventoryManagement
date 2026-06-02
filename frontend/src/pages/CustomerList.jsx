import { useState } from "react";
import "../styles/customer.css";
import ConfirmDialog from "../components/ConfirmDialog";

function CustomerList({ goBack, customers, setCustomers })
{
    // "add" | "edit" | null
    const [formMode, setFormMode] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [saveConfirm, setSaveConfirm] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [formErrors, setFormErrors] = useState({});

    const emptyForm = {
        fname: "",
        mname: "",
        lname: "",
        email: "",
        phone: "",
        address: "",
        pincode: "",
        city: "",
        state: "",
        gst: ""
    };

    const [formData, setFormData] = useState(emptyForm);

    const generateId = () =>
    {
        const nextId = customers.length + 1;
        return String(nextId).padStart(3, "0");
    };

    const handleChange = (e) =>
    {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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

    /* ── Add ── */
    const openAddForm = () =>
    {
        setFormData(emptyForm);
        setFormErrors({});
        setEditingId(null);
        setFormMode("add");
    };

    const handleAdd = () =>
    {
        if (!validateForm()) return;
        setCustomers([...customers, { id: generateId(), ...formData }]);
        setFormData(emptyForm);
        setFormErrors({});
        setFormMode(null);
        showSuccess("Customer added successfully");
    };

    /* ── Edit ── */
    const handleEditClick = (customer) =>
    {
        setFormData({
            fname:   customer.fname   || "",
            mname:   customer.mname   || "",
            lname:   customer.lname   || "",
            email:   customer.email   || "",
            phone:   customer.phone   || "",
            address: customer.address || "",
            pincode: customer.pincode || "",
            city:    customer.city    || "",
            state:   customer.state   || "",
            gst:     customer.gst     || ""
        });
        setFormErrors({});
        setEditingId(customer.id);
        setFormMode("edit");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // "Save Changes" clicked → validate first, then show dialog
    const handleSaveClick = () =>
    {
        if (!validateForm()) return;
        setSaveConfirm(true);
    };

    const confirmSave = () =>
    {
        setSaveConfirm(false);
        setCustomers(customers.map(c =>
            c.id === editingId ? { ...c, ...formData } : c
        ));
        setEditingId(null);
        setFormData(emptyForm);
        setFormErrors({});
        setFormMode(null);
        showSuccess("Customer updated successfully");
    };

    const handleCancelForm = () =>
    {
        setFormMode(null);
        setEditingId(null);
        setFormData(emptyForm);
        setFormErrors({});
    };

    /* ── Delete ── */
    const handleDeleteClick = (customer) => setDeleteConfirm(customer);

    const confirmDelete = () =>
    {
        setCustomers(customers.filter(c => c.id !== deleteConfirm.id));
        setDeleteConfirm(null);
        showSuccess("Customer deleted successfully");
    };

    const showSuccess = (msg) =>
    {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(""), 2500);
    };

    const formOpen = formMode !== null;

    return (
        <div className="customer-container">

            <button className="back-btn" onClick={goBack}>← BACK</button>

            <h1>Customer Management</h1>

            {successMsg && (
                <div className="success-msg">{successMsg}</div>
            )}

            {/* ── Save Changes confirmation ── */}
            <ConfirmDialog
                open={saveConfirm}
                variant="success"
                title="Save Changes"
                message={
                    <>
                        Save changes to <strong>{fullName(formData)}</strong>?
                    </>
                }
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
                <button className="add-customer-btn" onClick={openAddForm}>
                    + Add Customer
                </button>
            )}

            {formOpen && (
                <div className="customer-form">
                    <h3>
                        {formMode === "edit" ? "Edit Customer" : "Add New Customer"}
                    </h3>

                    {/* Row 1: Name */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Name</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input
                                    name="fname" maxLength={100}
                                    value={formData.fname} onChange={handleChange}
                                    placeholder="First Name"
                                />
                                {formErrors.fname && <span className="field-error">{formErrors.fname}</span>}
                            </div>
                            <div className="field-wrap">
                                <input
                                    name="mname" maxLength={100}
                                    value={formData.mname} onChange={handleChange}
                                    placeholder="Middle Name"
                                />
                            </div>
                            <div className="field-wrap">
                                <input
                                    name="lname" maxLength={100}
                                    value={formData.lname} onChange={handleChange}
                                    placeholder="Last Name"
                                />
                                {formErrors.lname && <span className="field-error">{formErrors.lname}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Email + Phone */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Contact</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input
                                    name="email" maxLength={100}
                                    value={formData.email} onChange={handleChange}
                                    placeholder="Email"
                                />
                                {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                            </div>
                            <div className="field-wrap">
                                <input
                                    name="phone" maxLength={100}
                                    value={formData.phone} onChange={handleChange}
                                    placeholder="Phone Number"
                                />
                                {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Billing Address + Pincode */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Billing Address</label>
                        <div className="row-fields">
                            <div className="field-wrap field-wrap-grow">
                                <textarea
                                    name="address" maxLength={200}
                                    value={formData.address} onChange={handleChange}
                                    placeholder="Billing Address" rows={3}
                                />
                                {formErrors.address && <span className="field-error">{formErrors.address}</span>}
                            </div>
                            <div className="field-wrap">
                                <input
                                    name="pincode" maxLength={20}
                                    value={formData.pincode} onChange={handleChange}
                                    placeholder="Pincode"
                                />
                                {formErrors.pincode && <span className="field-error">{formErrors.pincode}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Row 4: City + State + GST */}
                    <div className="form-row form-row-inline">
                        <label className="row-label">Details</label>
                        <div className="row-fields">
                            <div className="field-wrap">
                                <input
                                    name="city" maxLength={100}
                                    value={formData.city} onChange={handleChange}
                                    placeholder="City"
                                />
                                {formErrors.city && <span className="field-error">{formErrors.city}</span>}
                            </div>
                            <div className="field-wrap">
                                <input
                                    name="state" maxLength={100}
                                    value={formData.state} onChange={handleChange}
                                    placeholder="State"
                                />
                                {formErrors.state && <span className="field-error">{formErrors.state}</span>}
                            </div>
                            <div className="field-wrap">
                                <input
                                    name="gst" maxLength={100}
                                    value={formData.gst} onChange={handleChange}
                                    placeholder="GST Number"
                                />
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
                        <button className="cancel-form-btn" onClick={handleCancelForm}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Table ── */}
            <div className="customer-table-wrapper">
                {customers.length === 0 ? (
                    <div className="no-records">No customer records available.</div>
                ) : (
                    <table className="customer-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th className="col-address">Address</th>
                                <th>Pincode</th>
                                <th>City</th>
                                <th>State</th>
                                <th>GST</th>
                                <th className="col-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(customer => (
                                <tr
                                    key={customer.id}
                                    className={editingId === customer.id ? "row-editing" : ""}
                                >
                                    <td>{customer.id}</td>
                                    <td>{fullName(customer)}</td>
                                    <td>{customer.email}</td>
                                    <td>{customer.phone}</td>
                                    <td className="col-address">
                                        <div className="address-cell">{customer.address}</div>
                                    </td>
                                    <td>{customer.pincode}</td>
                                    <td>{customer.city}</td>
                                    <td>{customer.state}</td>
                                    <td>{customer.gst}</td>
                                    <td className="col-actions">
                                        <button className="edit-btn" onClick={() => handleEditClick(customer)}>Edit</button>
                                        <button className="delete-btn" onClick={() => handleDeleteClick(customer)}>Delete</button>
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
