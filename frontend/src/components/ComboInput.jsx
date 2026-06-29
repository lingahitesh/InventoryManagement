import { useRef } from "react";

/**
 * Searchable input with dropdown suggestions using HTML5 <datalist>.
 * User can type freely AND pick from suggestions that filter as they type.
 * Blurs on exact match selection to close the dropdown.
 */
function ComboInput({ value, onChange, options = [], placeholder = "", className = "", disabled = false, id, name })
{
    const listId = id || `combo-${Math.random().toString(36).slice(2, 8)}`;
    const inputRef = useRef(null);

    const handleChange = (e) => {
        onChange(e);
        // If the new value exactly matches an option, blur to close datalist
        if (options.includes(e.target.value)) {
            setTimeout(() => { if (inputRef.current) inputRef.current.blur(); }, 0);
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                className={className}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled}
                list={listId}
                name={name}
                autoComplete="off"
            />
            <datalist id={listId}>
                {options.map((opt, i) => <option key={i} value={opt} />)}
            </datalist>
        </>
    );
}

export default ComboInput;
