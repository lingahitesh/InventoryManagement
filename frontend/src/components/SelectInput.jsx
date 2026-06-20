import { useState, useRef, useEffect } from "react";
import "../styles/select-input.css";

/**
 * Searchable select — looks like ComboInput but guarantees exact value selection.
 * Shows a filtered dropdown list; sets full value only on item click.
 */
function SelectInput({ value, onChange, options = [], placeholder = "", disabled = false, id })
{
    const [open,   setOpen]   = useState(false);
    const [query,  setQuery]  = useState(value || "");
    const wrapRef = useRef(null);

    // Sync display when value changes externally
    useEffect(() => { setQuery(value || ""); }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                // If user typed something that doesn't match any option, reset
                const match = options.find(o => o === query);
                if (!match) { setQuery(value || ""); }
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [query, value, options]);

    const filtered = query.trim()
        ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
        : options;

    const handleInput = (e) => {
        setQuery(e.target.value);
        setOpen(true);
        // If cleared, also clear the actual value
        if (!e.target.value) onChange({ target: { value: "" } });
    };

    const handleSelect = (opt) => {
        setQuery(opt);
        setOpen(false);
        onChange({ target: { value: opt } });
    };

    return (
        <div className="si-wrap" ref={wrapRef} id={id}>
            <input
                className="si-input"
                value={query}
                onChange={handleInput}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
            />
            <span className="si-arrow">▾</span>
            {open && filtered.length > 0 && (
                <ul className="si-list">
                    {filtered.map((opt, i) => (
                        <li key={i}
                            className={`si-item${opt === value ? " si-item--active" : ""}`}
                            onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}>
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default SelectInput;
