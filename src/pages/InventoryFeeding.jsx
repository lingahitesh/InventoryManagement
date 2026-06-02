import { useState, useEffect } from "react";
import "../styles/inventory-feeding.css";
import ConfirmDialog from "../components/ConfirmDialog";

const UNIT_OPTIONS = ["kg", "g", "lb", "oz", "ton", "piece", "box", "pallet", "litre", "ml"];

const freshForm = () => ({
    skuId:      "SKU-" + Date.now(),
    skuType:    "",
    skuSubType: "",
    skuDim:     "",
    skuQuantity:"",
    skuUnits:   "",
    skuRate:    "",
    skuDesc:    ""
});

function InventoryFeeding({ closeCurrentTab, registerCloseGuard })
{
    const [formData, setFormData] = useState(freshForm);
    const [submitConfirm, setSubmitConfirm]   = useState(false);
    const [cancelConfirm, setCancelConfirm]   = useState(false);
    const [pendingClose,  setPendingClose]    = useState(null);
    const [fieldErrors,   setFieldErrors]     = useState({});

    const isDirty = () =>
        formData.skuType.trim()     !== "" ||
        formData.skuSubType.trim()  !== "" ||
        formData.skuDim.trim()      !== "" ||
        formData.skuQuantity.toString().trim() !== "" ||
        formData.skuUnits.trim()    !== "" ||
        formData.skuRate.toString().trim()     !== "" ||
        formData.skuDesc.trim()     !== "";

    useEffect(() =>
    {
        registerCloseGuard((doClose) =>
        {
            if (!isDirty()) { doClose(); return; }
            setPendingClose(() => doClose);
            setCancelConfirm(true);
        });
    }, [formData]);

    const handleChange = (e) =>
    {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validate = () =>
    {
        const errors = {};
        if (!formData.skuType.trim())    errors.skuType    = "Required";
        if (!formData.skuSubType.trim()) errors.skuSubType = "Required";
        if (!formData.skuDim.trim())     errors.skuDim     = "Required";
        if (!formData.skuQuantity.toString().trim()) errors.skuQuantity = "Required";
        if (!formData.skuUnits.trim())   errors.skuUnits   = "Required";
        if (!formData.skuRate.toString().trim())     errors.skuRate     = "Required";
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitClick = () =>
    {
        if (!validate()) return;
        setSubmitConfirm(true);
    };

    const confirmSubmit = () =>
    {
        setSubmitConfirm(false);
        console.log(formData);
        setFormData(freshForm());
        setFieldErrors({});
    };

    const handleCancelClick = () =>
    {
        if (!isDirty()) { closeCurrentTab(); return; }
        setPendingClose(() => closeCurrentTab);
        setCancelConfirm(true);
    };

    const confirmCancel = () =>
    {
        setCancelConfirm(false);
        if (pendingClose) pendingClose();
    };

    return (
        <div className="form-container">

            <ConfirmDialog
                open={submitConfirm}
                variant="success"
                title="Submit SKU"
                message={<>Submit <strong>{formData.skuId}</strong> to inventory?</>}
                confirmLabel="Yes, Submit"
                cancelLabel="Go Back"
                onConfirm={confirmSubmit}
                onCancel={() => setSubmitConfirm(false)}
            />

            <ConfirmDialog
                open={cancelConfirm}
                variant="warning"
                title="Discard Changes"
                message="Close this tab and discard all unsaved changes?"
                confirmLabel="Yes, Discard"
                cancelLabel="Keep Editing"
                onConfirm={confirmCancel}
                onCancel={() => { setCancelConfirm(false); setPendingClose(null); }}
            />

            <h1>Inventory Feeding</h1>

            <div className="feed-form">

                {/* ── Row 1: SKU ID only ── */}
                <div className="feed-row feed-row-single">
                    <div className="feed-field">
                        <label>SKU ID :</label>
                        <input value={formData.skuId} readOnly />
                    </div>
                </div>

                {/* ── Row 2: Type | SubType | Dimensions ── */}
                <div className="feed-row feed-row-three">
                    <div className="feed-field">
                        <label>SKU Type :</label>
                        <input name="skuType" value={formData.skuType} onChange={handleChange} />
                        {fieldErrors.skuType && <span className="field-error">{fieldErrors.skuType}</span>}
                    </div>
                    <div className="feed-field">
                        <label>SKU SubType :</label>
                        <input name="skuSubType" value={formData.skuSubType} onChange={handleChange} />
                        {fieldErrors.skuSubType && <span className="field-error">{fieldErrors.skuSubType}</span>}
                    </div>
                    <div className="feed-field">
                        <label>SKU Dimensions :</label>
                        <input name="skuDim" value={formData.skuDim} onChange={handleChange} />
                        {fieldErrors.skuDim && <span className="field-error">{fieldErrors.skuDim}</span>}
                    </div>
                </div>

                {/* ── Row 3: Quantity | Units (dropdown) | Price/Rate ── */}
                <div className="feed-row feed-row-three">
                    <div className="feed-field">
                        <label>Quantity :</label>
                        <input
                            type="number"
                            name="skuQuantity"
                            min="0"
                            value={formData.skuQuantity}
                            onChange={handleChange}
                        />
                        {fieldErrors.skuQuantity && <span className="field-error">{fieldErrors.skuQuantity}</span>}
                    </div>
                    <div className="feed-field">
                        <label>Units :</label>
                        <select name="skuUnits" value={formData.skuUnits} onChange={handleChange}>
                            <option value="">-- Select --</option>
                            {UNIT_OPTIONS.map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                        {fieldErrors.skuUnits && <span className="field-error">{fieldErrors.skuUnits}</span>}
                    </div>
                    <div className="feed-field">
                        <label>Price / Rate (per kg) :</label>
                        <input
                            type="number"
                            name="skuRate"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.skuRate}
                            onChange={handleChange}
                        />
                        {fieldErrors.skuRate && <span className="field-error">{fieldErrors.skuRate}</span>}
                    </div>
                </div>

                {/* ── Row 4: Description (full width) ── */}
                <div className="feed-row feed-row-single">
                    <div className="feed-field">
                        <label>SKU Description : <span className="optional">(optional)</span></label>
                        <textarea
                            name="skuDesc"
                            maxLength="100"
                            rows="3"
                            value={formData.skuDesc}
                            onChange={handleChange}
                        />
                    </div>
                </div>

            </div>

            <div className="button-row">
                <button className="cancel-btn" onClick={handleCancelClick}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmitClick}>Submit</button>
            </div>

        </div>
    );
}

export default InventoryFeeding;
