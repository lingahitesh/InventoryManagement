import { useState, useEffect } from "react";
import "../styles/inventory-feeding.css";
import ConfirmDialog from "../components/ConfirmDialog";
import { addInventory, updateInventoryItem, getNextSkuId } from "../api";
import { useProductMaster } from "../hooks/useProductMaster";
import ComboInput from "../components/ComboInput";

const freshForm = () => ({
    skuId:       "",
    skuType:     "",
    skuSubType:  "",
    skuDim:      "",
    skuQuantity: "",
    skuUnits:    "1",
    skuRate:     "",
    skuDesc:     "",
    trackingId:  "",
    entryDate:   "",   // YYYY-MM-DD
    entryTime:   ""    // HH:MM
});

function InventoryFeeding({ closeCurrentTab, registerCloseGuard, onSubmitSuccess, editRecord, clearEditRecord, viewOnly = false })
{
    const isEditMode = !!editRecord;

    const [formData,      setFormData]      = useState({ ...freshForm(), skuId: "…" });

    const { types: productTypes, subtypes: productSubtypes } = useProductMaster(formData.skuType);

    // Fetch the next sku_id from the sequence on mount
    const loadNextId = () => {
        getNextSkuId()
            .then(res => setFormData(prev => ({ ...prev, skuId: String(res.next_sku_id) })))
            .catch(() => setFormData(prev => ({ ...prev, skuId: "Auto" })));
    };

    useEffect(() => { if (!isEditMode) loadNextId(); }, []);
    const [submitConfirm, setSubmitConfirm] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [pendingClose,  setPendingClose]  = useState(null);
    const [fieldErrors,   setFieldErrors]   = useState({});
    const [submitError,   setSubmitError]   = useState("");
    const [successMsg,    setSuccessMsg]    = useState("");

    // Populate form when editRecord arrives
    useEffect(() =>
    {
        if (editRecord)
        {
            // entry_date comes back as ISO string e.g. "2025-06-04T14:32:00"
            const rawDt   = editRecord.entry_date || "";
            const datePart = rawDt ? rawDt.slice(0, 10) : "";
            const timePart = rawDt && rawDt.includes("T") ? rawDt.slice(11, 16) : "";
            setFormData({
                skuId:       String(editRecord.sku_id),
                skuType:     editRecord.sku_type      || "",
                skuSubType:  editRecord.sku_subtype   || "",
                skuDim:      editRecord.sku_dim       || "",
                skuQuantity: String(editRecord.sku_quantity   ?? ""),
                skuUnits:    String(editRecord.sku_units      ?? "1"),
                skuRate:     String(editRecord.sku_cost_price ?? ""),
                skuDesc:     editRecord.sku_desc      || "",
                trackingId:  editRecord.tracking_id   || "",
                entryDate:   datePart,
                entryTime:   timePart
            });
            setFieldErrors({});
            setSubmitError("");
        }
        else
        {
            setFormData(prev => ({ ...freshForm(), skuId: "Auto" }));
        }
    }, [editRecord]);

    const isDirty = () =>
        formData.skuType.trim()    !== "" ||
        formData.skuSubType.trim() !== "" ||
        formData.skuDim.trim()     !== "" ||
        formData.skuQuantity.toString().trim() !== "" ||
        formData.skuRate.toString().trim()     !== "" ||
        formData.skuDesc.trim()    !== "";

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
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const validate = () =>
    {
        const errors = {};
        if (!formData.skuType.trim())    errors.skuType    = "Required";
        if (!formData.skuSubType.trim()) errors.skuSubType = "Required";
        if (!formData.skuDim.trim())     errors.skuDim     = "Required";
        if (!formData.skuQuantity.toString().trim() || isNaN(parseFloat(formData.skuQuantity)))
            errors.skuQuantity = "Required";
        if (!formData.skuUnits || parseInt(formData.skuUnits, 10) < 1)
            errors.skuUnits = "Must be at least 1";
        if (!formData.skuRate.toString().trim())
            errors.skuRate = "Required";
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitClick = () => { if (!validate()) return; setSubmitConfirm(true); };

    const confirmSubmit = async () =>
    {
        setSubmitConfirm(false);
        setSubmitError("");
        const now = new Date();

        // Build entry_date as full ISO datetime string:
        // - Neither date nor time entered → current date + current time
        // - Date entered, no time → that date + 00:00:00
        // - Both entered → combine them
        let entryDatetime = null;
        if (formData.entryDate)
        {
            const timeStr = formData.entryTime || "00:00";
            entryDatetime = `${formData.entryDate}T${timeStr}:00`;
        }
        // If neither, leave null → backend defaults to datetime.now()

        const payload = {
            sku_type:       formData.skuType,
            sku_subtype:    formData.skuSubType,
            sku_dim:        formData.skuDim,
            sku_quantity:   parseFloat(formData.skuQuantity),
            sku_cost_price: parseFloat(formData.skuRate),
            sku_desc:       formData.skuDesc || null,
            sku_units:      parseInt(formData.skuUnits, 10),
            tracking_id:    formData.trackingId || null,
            entry_date:     entryDatetime
        };
        try {
            if (isEditMode)
            {
                await updateInventoryItem(editRecord.sku_id, payload);
                setSuccessMsg("SKU updated successfully");
                if (clearEditRecord) clearEditRecord();
            }
            else
            {
                const result = await addInventory(payload);
                const newId  = result.sku_id ?? "?";
                setSuccessMsg(`SKU ${newId} submitted successfully`);
                setFormData({ ...freshForm(), skuId: "…" });
                loadNextId();
            }
            setFieldErrors({});
            setTimeout(() => setSuccessMsg(""), 3000);
            if (onSubmitSuccess) onSubmitSuccess();
        } catch (err) {
            setSubmitError(err.message || "Failed to submit inventory");
        }
    };

    const handleCancelClick = () =>
    {
        if (!isDirty())
        {
            // Reset form to fresh state then navigate away
            setFormData({ ...freshForm(), skuId: "Auto" });
            setFieldErrors({});
            setSubmitError("");
            closeCurrentTab();
            return;
        }
        setPendingClose(() => () =>
        {
            setFormData({ ...freshForm(), skuId: "Auto" });
            setFieldErrors({});
            setSubmitError("");
            closeCurrentTab();
        });
        setCancelConfirm(true);
    };

    const confirmCancel = () => { setCancelConfirm(false); if (pendingClose) pendingClose(); };

    return (
        <div className="form-container">

            <ConfirmDialog
                open={submitConfirm}
                variant="success"
                title={isEditMode ? "Save Changes" : "Submit SKU"}
                message={
                    isEditMode
                        ? <>Save changes to <strong>SKU {editRecord?.sku_id}</strong>?</>
                        : <>Submit <strong>{formData.skuId}</strong> to inventory?</>
                }
                confirmLabel={isEditMode ? "Yes, Save" : "Yes, Submit"}
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

            <div className={`feed-form${viewOnly ? " viewonly-form" : ""}`}>

                {/* Row 1: SKU ID */}
                <div className="feed-row feed-row-single">
                    <div className="feed-field">
                        <label>SKU ID :</label>
                        <input value={formData.skuId} readOnly />
                    </div>
                </div>

                {/* Row 2: Type | SubType | Dimensions */}
                <div className="feed-row feed-row-three">
                    <div className="feed-field">
                        <label>SKU Type :</label>
                        <ComboInput name="skuType" value={formData.skuType}
                            onChange={handleChange} options={productTypes}
                            placeholder="Type…" id="feed-type" />
                        {fieldErrors.skuType && <span className="field-error">{fieldErrors.skuType}</span>}
                    </div>
                    <div className="feed-field">
                        <label>SKU SubType :</label>
                        <ComboInput name="skuSubType" value={formData.skuSubType}
                            onChange={handleChange} options={productSubtypes.map(s => s.display_subtype)}
                            placeholder="SubType…" id="feed-subtype" />
                        {fieldErrors.skuSubType && <span className="field-error">{fieldErrors.skuSubType}</span>}
                    </div>
                    <div className="feed-field">
                        <label>SKU Dimensions :</label>
                        <input name="skuDim" value={formData.skuDim} onChange={handleChange} />
                        {fieldErrors.skuDim && <span className="field-error">{fieldErrors.skuDim}</span>}
                    </div>
                </div>

                {/* Row 3: Quantity | Units | Price */}
                <div className="feed-row feed-row-three">
                    <div className="feed-field">
                        <label>Quantity / Unit (kgs) :</label>
                        <input name="skuQuantity" placeholder="e.g. 12.5" value={formData.skuQuantity} onChange={handleChange} />
                        {fieldErrors.skuQuantity && <span className="field-error">{fieldErrors.skuQuantity}</span>}
                    </div>
                    <div className="feed-field">
                        <label>Units :</label>
                        <input type="number" name="skuUnits" min="1" step="1" value={formData.skuUnits} onChange={handleChange} />
                        {fieldErrors.skuUnits && <span className="field-error">{fieldErrors.skuUnits}</span>}
                    </div>
                    <div className="feed-field">
                        <label>Price / Rate (per kg) :</label>
                        <input type="number" name="skuRate" min="0" step="0.01" placeholder="0.00" value={formData.skuRate} onChange={handleChange} />
                        {fieldErrors.skuRate && <span className="field-error">{fieldErrors.skuRate}</span>}
                    </div>
                </div>

                {/* Row 4: Tracking ID | Entry Date | Entry Time */}
                <div className="feed-row feed-row-three">
                    <div className="feed-field">
                        <label>Tracking ID : <span className="optional">(optional)</span></label>
                        <input name="trackingId" value={formData.trackingId} onChange={handleChange} placeholder="e.g. TRK-001" />
                    </div>
                    <div className="feed-field">
                        <label>Entry Date : <span className="optional">(optional)</span></label>
                        <input type="date" name="entryDate" value={formData.entryDate} onChange={handleChange} />
                    </div>
                    <div className="feed-field">
                        <label>Entry Time : <span className="optional">(optional, 00:00 if date set)</span></label>
                        <input type="time" name="entryTime" value={formData.entryTime} onChange={handleChange} />
                    </div>
                </div>

                {/* Row 5: Description */}
                <div className="feed-row feed-row-single">
                    <div className="feed-field">
                        <label>SKU Description : <span className="optional">(optional)</span></label>
                        <textarea name="skuDesc" maxLength="100" rows="3" value={formData.skuDesc} onChange={handleChange} />
                    </div>
                </div>

            </div>

            {successMsg  && <div className="submit-success">{successMsg}</div>}
            {submitError && <div className="submit-error">{submitError}</div>}

            {!viewOnly && <div className="button-row">
                <button className="cancel-btn" onClick={handleCancelClick}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmitClick}>
                    {isEditMode ? "Save Changes" : "Submit"}
                </button>
            </div>}

        </div>
    );
}

export default InventoryFeeding;
