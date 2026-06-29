import { useState } from "react";
import "../styles/password-prompt.css";

function PasswordPrompt({ open, title, message, onConfirm, onCancel }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    if (!open) return null;

    const handleConfirm = () => {
        if (!password.trim()) { setError("Password required"); return; }
        setError("");
        onConfirm(password);
        setPassword("");
    };

    const handleCancel = () => {
        setPassword("");
        setError("");
        onCancel();
    };

    return (
        <div className="pw-overlay">
            <div className="pw-dialog">
                <h3 className="pw-title">{title || "Enter Password"}</h3>
                {message && <p className="pw-message">{message}</p>}
                <input
                    type="password"
                    className="pw-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password…"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
                />
                {error && <div className="pw-error">{error}</div>}
                <div className="pw-actions">
                    <button className="cancel-btn" onClick={handleCancel}>Cancel</button>
                    <button className="submit-btn" onClick={handleConfirm}>Confirm</button>
                </div>
            </div>
        </div>
    );
}

export default PasswordPrompt;
