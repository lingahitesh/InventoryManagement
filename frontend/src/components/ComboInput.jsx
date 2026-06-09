/**
 * Searchable input with dropdown suggestions using HTML5 <datalist>.
 * User can type freely AND pick from suggestions that filter as they type.
 */
function ComboInput({ value, onChange, options = [], placeholder = "", className = "", disabled = false, id, name })
{
    const listId = id || `combo-${Math.random().toString(36).slice(2, 8)}`;

    return (
        <>
            <input
                className={className}
                value={value}
                onChange={onChange}
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
