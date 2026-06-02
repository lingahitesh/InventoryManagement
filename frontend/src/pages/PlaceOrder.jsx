import { useState, useEffect } from "react";
import "../styles/place-order.css";
import ConfirmDialog from "../components/ConfirmDialog";

function PlaceOrder({ closeCurrentTab, customers = [], registerCloseGuard })
{
    const [customerName, setCustomerName] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [shippingAddress, setShippingAddress] = useState("");

    const [product, setProduct] = useState({
        type: "",
        subType: "",
        dim: "",
        quantity: "",
        sellingPrice: "",
        id: "PRD-" + Date.now()
    });

    const [cart, setCart] = useState([]);
    const [submitConfirm, setSubmitConfirm] = useState(false);
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const [pendingClose, setPendingClose] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [productErrors, setProductErrors] = useState({});

    const fullName = (c) =>
        [c.fname, c.mname, c.lname].filter(Boolean).join(" ");

    const fullAddress = (c) =>
        [c.address, c.city, c.state, c.pincode].filter(Boolean).join(", ");

    const isDirty = () =>
        customerName.trim() !== "" ||
        cart.length > 0 ||
        product.type.trim() !== "" ||
        product.subType.trim() !== "" ||
        product.dim.trim() !== "" ||
        product.quantity.toString().trim() !== "" ||
        product.sellingPrice.toString().trim() !== "";

    // Register close guard so × button also asks when dirty
    useEffect(() =>
    {
        registerCloseGuard((doClose) =>
        {
            if (!isDirty())
            {
                doClose();
                return;
            }
            setPendingClose(() => doClose);
            setCancelConfirm(true);
        });
    }, [customerName, cart, product]);

    const handleCustomerSelect = (e) =>
    {
        const id = e.target.value;
        const found = customers.find(c => c.id === id) || null;
        setSelectedCustomer(found);
        setCustomerName(found ? fullName(found) : "");
        setShippingAddress(found ? fullAddress(found) : "");
    };

    const addToCart = () =>
    {
        const errors = {};
        if (!product.type.trim())    errors.type         = "Type is required";
        if (!product.subType.trim()) errors.subType      = "SubType is required";
        if (!product.dim.trim())     errors.dim          = "Dimensions is required";
        if (!product.quantity.toString().trim())     errors.quantity     = "Quantity is required";
        if (!product.sellingPrice.toString().trim()) errors.sellingPrice = "Selling price is required";
        setProductErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setProductErrors({});
        setCart([...cart, product]);
        setProduct({
            type: "",
            subType: "",
            dim: "",
            quantity: "",
            sellingPrice: "",
            id: "PRD-" + Date.now()
        });
    };

    const validateOrder = () =>
    {
        const errors = {};
        if (!customerName.trim())    errors.customer = "Customer is required";
        if (!shippingAddress.trim()) errors.shipping = "Shipping address is required";
        if (cart.length === 0)       errors.cart     = "Add at least one item to the cart";
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmitClick = () =>
    {
        if (!validateOrder()) return;
        setSubmitConfirm(true);
    };

    const confirmSubmit = () =>
    {
        setSubmitConfirm(false);
        console.log({ customerName, shippingAddress, cart });
        // TODO: send to backend
        closeCurrentTab();
    };

    const handleCancelClick = () =>
    {
        if (!isDirty())
        {
            closeCurrentTab();
            return;
        }
        setPendingClose(() => closeCurrentTab);
        setCancelConfirm(true);
    };

    const confirmCancel = () =>
    {
        setCancelConfirm(false);
        if (pendingClose) pendingClose();
    };

    return (
        <div className="place-order-container">

            <ConfirmDialog
                open={submitConfirm}
                variant="success"
                title="Submit Order"
                message={
                    <>
                        Submit order for{" "}
                        <strong>{customerName || "this customer"}</strong>{" "}
                        with <strong>{cart.length}</strong> item{cart.length !== 1 ? "s" : ""}?
                    </>
                }
                confirmLabel="Yes, Submit"
                cancelLabel="Go Back"
                onConfirm={confirmSubmit}
                onCancel={() => setSubmitConfirm(false)}
            />

            <ConfirmDialog
                open={cancelConfirm}
                variant="warning"
                title="Discard Order"
                message="Cancel and discard this order? All items in the cart will be lost."
                confirmLabel="Yes, Discard"
                cancelLabel="Keep Editing"
                onConfirm={confirmCancel}
                onCancel={() => { setCancelConfirm(false); setPendingClose(null); }}
            />

            <h1>Place Order</h1>

            <div className="customer-panel">

                <h2>Customer Details</h2>

                <div className="customer-grid">

                    <label>Customer Name :</label>
                    {customers.length > 0 ? (
                        <select
                            value={selectedCustomer ? selectedCustomer.id : ""}
                            onChange={handleCustomerSelect}
                        >
                            <option value="">-- Select Customer --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {fullName(c)}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            placeholder="Customer Name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                        />
                    )}

                    <label>Contact :</label>
                    <input value={selectedCustomer ? selectedCustomer.phone : ""} placeholder="Contact" readOnly />

                    <label>Address :</label>
                    <input value={selectedCustomer ? selectedCustomer.address : ""} placeholder="Address" readOnly />

                    <label>GST :</label>
                    <input value={selectedCustomer ? selectedCustomer.gst : ""} placeholder="GST" readOnly />

                    <label>Email ID :</label>
                    <input value={selectedCustomer ? selectedCustomer.email : ""} placeholder="Email ID" readOnly />

                    <label>Billing Address :</label>
                    <input value={selectedCustomer ? fullAddress(selectedCustomer) : ""} placeholder="Billing Address" readOnly />

                    <label>Shipping Address :</label>
                    <input
                        value={selectedCustomer ? fullAddress(selectedCustomer) : shippingAddress}
                        placeholder="Shipping Address"
                        onChange={(e) => setShippingAddress(e.target.value)}
                    />

                </div>

                {fieldErrors.customer && <p className="order-field-error">{fieldErrors.customer}</p>}
                {fieldErrors.shipping && <p className="order-field-error">{fieldErrors.shipping}</p>}

            </div>

            <div className="product-panel">

                <h2>Products</h2>

                <div className="product-row">

                    <label>Type :</label>
                    <div className="field-col">
                        <input
                            placeholder="Type"
                            value={product.type}
                            onChange={(e) => setProduct({ ...product, type: e.target.value })}
                        />
                        {productErrors.type && <span className="order-field-error">{productErrors.type}</span>}
                    </div>

                    <label>SubType :</label>
                    <div className="field-col">
                        <input
                            placeholder="Sub Type"
                            value={product.subType}
                            onChange={(e) => setProduct({ ...product, subType: e.target.value })}
                        />
                        {productErrors.subType && <span className="order-field-error">{productErrors.subType}</span>}
                    </div>

                    <label>Dimensions :</label>
                    <div className="field-col">
                        <input
                            placeholder="Dimension"
                            value={product.dim}
                            onChange={(e) => setProduct({ ...product, dim: e.target.value })}
                        />
                        {productErrors.dim && <span className="order-field-error">{productErrors.dim}</span>}
                    </div>

                </div>

                <div className="product-row">

                    <label>Quantity :</label>
                    <div className="field-col">
                        <input
                            placeholder="Quantity"
                            value={product.quantity}
                            onChange={(e) => setProduct({ ...product, quantity: e.target.value })}
                        />
                        {productErrors.quantity && <span className="order-field-error">{productErrors.quantity}</span>}
                    </div>

                    <label>Selling Price/Rate (per kg) :</label>
                    <div className="field-col">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={product.sellingPrice}
                            onChange={(e) => setProduct({ ...product, sellingPrice: e.target.value })}
                        />
                        {productErrors.sellingPrice && <span className="order-field-error">{productErrors.sellingPrice}</span>}
                    </div>

                    <input value={product.id} readOnly />

                </div>

                <div className="cart-button-row">
                    <button className="add-cart-btn" onClick={addToCart}>Add To Cart</button>
                </div>

            </div>

            <div className="cart-panel">

                <h2>Cart</h2>

                {fieldErrors.cart && <p className="order-field-error">{fieldErrors.cart}</p>}

                {cart.length === 0 ? (
                    <div className="cart-empty">No items added yet.</div>
                ) : (
                    <table className="cart-table">
                        <thead>
                            <tr>
                                <th>Product ID</th>
                                <th>Type</th>
                                <th>Sub Type</th>
                                <th>Dimensions</th>
                                <th>Quantity</th>
                                <th>Selling Price</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map((item, index) => (
                                <tr key={index}>
                                    <td>{item.id}</td>
                                    <td>{item.type}</td>
                                    <td>{item.subType}</td>
                                    <td>{item.dim}</td>
                                    <td>{item.quantity}</td>
                                    <td>{item.sellingPrice}</td>
                                    <td>
                                        <button
                                            className="cart-remove-btn"
                                            onClick={() => setCart(cart.filter((_, i) => i !== index))}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

            </div>

            <div className="place-order-buttons">
                <button className="cancel-btn" onClick={handleCancelClick}>Cancel</button>
                <button className="submit-btn" onClick={handleSubmitClick}>Submit</button>
            </div>

        </div>
    );
}

export default PlaceOrder;
