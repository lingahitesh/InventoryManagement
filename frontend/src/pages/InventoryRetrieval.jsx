import { useState } from "react";
import "../styles/inventory-retrieval.css";

function InventoryRetrieval({ openTab, goBack, closeCurrentTab })
{
    const [formData, setFormData] = useState({
        skuType: "",
        skuSubType: "",
        skuDim: "",
        skuQuantity: "",
        skuDesc: "",
        skuUnits: ""
    });

    const handleChange = (e) =>
    {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleCancel = () =>
    {
        const confirmed = window.confirm(
            "Close this tab and discard changes?"
        );

        if(!confirmed)
        {
            return;
        }

        closeCurrentTab();
    };

    return (
        <div className="retrieval-container">

            <h1>Inventory Retrieval</h1>

            <div className="retrieval-form">

                <label>SKU Type :</label>
                <input
                    name="skuType"
                    value={formData.skuType}
                    onChange={handleChange}
                />

                <label>SKU SubType :</label>
                <input
                    name="skuSubType"
                    value={formData.skuSubType}
                    onChange={handleChange}
                />

                <label>SKU Dimensions :</label>
                <input
                    name="skuDim"
                    value={formData.skuDim}
                    onChange={handleChange}
                />

            </div>

            <div className="retrieval-button-row">

                <button
                    className="retrieval-back-btn"
                    onClick={goBack}
                >
                    Back
                </button>

                <button
                    className="retrieval-cancel-btn"
                    onClick={handleCancel}
                >
                    Close
                </button>

            </div>

            <div className="retrieval-records-panel">
                <h2>Database Records -</h2>

                <div className="retrieval-records-placeholder">
                    Records will appear here
                </div>
            </div>

        </div>
    );
}

export default InventoryRetrieval;