import "../styles/ios-toggle.css";

function IOSToggle({ checked, onChange, disabled = false, label = "" }) {
    return (
        <label className={`ios-toggle-wrap${disabled ? " disabled" : ""}`} title={label}>
            {label && <span className="ios-toggle-label">{label}</span>}
            <input
                type="checkbox"
                checked={checked}
                onChange={e => { if (!disabled) onChange(e.target.checked); }}
                disabled={disabled}
            />
            <span className="ios-toggle-track">
                <span className="ios-toggle-knob" />
            </span>
        </label>
    );
}

export default IOSToggle;
