import "../styles/confirm-dialog.css";

/**
 * Props:
 *   open        – boolean, whether to show
 *   title       – heading text
 *   message     – body text (can include JSX)
 *   confirmLabel – text for the confirm button  (default "Confirm")
 *   cancelLabel  – text for the cancel button   (default "Cancel")
 *   variant      – "danger" | "warning" | "success"  (default "warning")
 *   onConfirm   – called when user clicks confirm
 *   onCancel    – called when user clicks cancel or backdrop
 */
function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel  = "Cancel",
    variant      = "warning",
    onConfirm,
    onCancel
})
{
    if (!open) return null;

    return (
        <div className="cd-backdrop" onClick={onCancel}>
            <div
                className={`cd-box cd-box--${variant}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`cd-icon cd-icon--${variant}`}>
                    {variant === "danger"  && "🗑"}
                    {variant === "warning" && "⚠️"}
                    {variant === "success" && "✓"}
                </div>

                <h3 className="cd-title">{title}</h3>

                <p className="cd-message">{message}</p>

                <div className="cd-actions">
                    <button
                        className={`cd-btn cd-btn--confirm cd-btn--${variant}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        className="cd-btn cd-btn--cancel"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
