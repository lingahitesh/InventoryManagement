import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import "../styles/modal-overlay.css";

/**
 * Full-screen modal overlay with dimmed backdrop and fade-out transition.
 * Locks body scroll when open.
 * Props: open (boolean), onClose (fn), title (string), children
 */
function ModalOverlay({ open, onClose, title, children })
{
    const [closing, setClosing] = useState(false);

    // Lock body scroll when modal is visible
    useEffect(() => {
        if (open || closing) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open, closing]);

    const handleClose = useCallback(() => {
        setClosing(true);
        setTimeout(() => {
            setClosing(false);
            onClose();
        }, 200);
    }, [onClose]);

    if (!open && !closing) return null;

    return createPortal(
        <div className={`modal-overlay-backdrop${closing ? " closing" : ""}`} onClick={handleClose}>
            <div className="modal-overlay-content" onClick={e => e.stopPropagation()}>
                <div className="modal-overlay-header">
                    <h2>{title}</h2>
                    <button className="modal-overlay-close" onClick={handleClose}>✕</button>
                </div>
                <div className="modal-overlay-body">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ModalOverlay;
