import "../styles/modal-overlay.css";

/**
 * Full-screen modal overlay with dimmed backdrop.
 * Props: open (boolean), onClose (fn), title (string), children
 */
function ModalOverlay({ open, onClose, title, children })
{
    if (!open) return null;

    return (
        <div className="modal-overlay-backdrop" onClick={onClose}>
            <div className="modal-overlay-content" onClick={e => e.stopPropagation()}>
                <div className="modal-overlay-header">
                    <h2>{title}</h2>
                    <button className="modal-overlay-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-overlay-body">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default ModalOverlay;
