import { useState, useRef, useEffect } from "react";
import "../styles/combo-input.css";

/**
 * Searchable input with a custom dropdown of suggestions (no native <datalist>).
 * - User can type freely; every keystroke is reported via onChange.
 * - The dropdown stays open and filters while typing.
 * - Clicking a suggestion sets that value and closes the dropdown immediately.
 * - Clicking outside, or pressing Escape, closes the dropdown.
 *
 * Native <datalist> closing behaviour is inconsistent across browsers
 * (it can stay open after a value is picked, or fail to reflect what was
 * typed). Using our own list gives us full, reliable control over open/close.
 */
function ComboInput({ value, onChange, options = [], placeholder = "", className = "", disabled = false, id, name })
{
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    // Close the dropdown on any click outside the component
    useEffect(() => {
        const handleOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const query = (value || "").trim().toLowerCase();
    const filtered = query
        ? options.filter(opt => opt.toLowerCase().includes(query))
        : options;

    const handleInputChange = (e) => {
        onChange(e);
        setOpen(true);
    };

    const handleSelect = (opt) => {
        onChange({ target: { name, value: opt } });
        // Close immediately — don't wait for blur/outside-click.
        setOpen(false);
        // Drop focus too, so a stray focus-driven reopen can't happen.
        if (inputRef.current) inputRef.current.blur();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") setOpen(false);
    };

    return (
        <div className="combo-wrap" ref={wrapRef}>
            <input
                ref={inputRef}
                className={className ? `combo-field ${className}` : "combo-field"}
                value={value}
                onChange={handleInputChange}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                name={name}
                id={id}
                autoComplete="off"
            />
            {open && !disabled && filtered.length > 0 && (
                <ul className="combo-list">
                    {filtered.map((opt, i) => (
                        <li
                            key={i}
                            className={`combo-item${opt === value ? " combo-item--active" : ""}`}
                            // onMouseDown (not onClick) fires before the input's blur,
                            // so the selection always registers before anything closes.
                            onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default ComboInput;
