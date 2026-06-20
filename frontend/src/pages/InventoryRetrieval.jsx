import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import "../styles/inventory-retrieval.css";
import { getInventorySummary, searchInventory, deleteInventoryItem } from "../api";
import { useProductMaster } from "../hooks/useProductMaster";
import ComboInput from "../components/ComboInput";
import ConfirmDialog from "../components/ConfirmDialog";

// ── Stable FilterBar — separate component so re-renders of parent never remount it ──
function FilterBar({ onFilterChange, resetKey })
{
    const [type,    setType]    = useState("");
    const [subtype, setSubtype] = useState("");
    const [dim,     setDim]     = useState("");

    const { types: productTypes, subtypes: productSubtypes } = useProductMaster(type);

    const prevResetKey = useRef(resetKey);
    useEffect(() =>
    {
        if (prevResetKey.current !== resetKey)
        {
            prevResetKey.current = resetKey;
            setType(""); setSubtype(""); setDim("");
        }
    }, [resetKey]);

    const handleTypeChange = (val) => { setType(val); setSubtype(""); onFilterChange(val, "", dim); };
    const handleSubtypeChange = (val) => { setSubtype(val); onFilterChange(type, val, dim); };
    const handleDimChange = (val) => { setDim(val); onFilterChange(type, subtype, val); };

    const subtypeOptions = productSubtypes.map(s => s.display_subtype);

    return (
        <tr className="filter-row">
            <td>
                <ComboInput className="col-filter" value={type}
                    onChange={e => handleTypeChange(e.target.value)}
                    options={productTypes} placeholder="Type…" id="filter-type" />
            </td>
            <td>
                <ComboInput className="col-filter" value={subtype}
                    onChange={e => handleSubtypeChange(e.target.value)}
                    options={subtypeOptions} placeholder="SubType…" id="filter-subtype" />
            </td>
            <td>
                <input className="col-filter" value={dim}
                    onChange={e => handleDimChange(e.target.value)} placeholder="Dim…" />
            </td>
            <td colSpan={3} />
        </tr>
    );
}

function InventoryRetrieval({ onEditRecord, onAddRecord, onOrderWithProduct, onViewRecord, refreshKey })
{
    const inlineRef = useRef({ type: "", subtype: "", dim: "" });
    const [resetKey,        setResetKey]        = useState(0);

    const [advOpen,         setAdvOpen]         = useState(false);
    const [advTrackingId,   setAdvTrackingId]   = useState("");
    const [advCostPriceMin, setAdvCostPriceMin] = useState("");
    const [advCostPriceMax, setAdvCostPriceMax] = useState("");
    const [advDateFrom,     setAdvDateFrom]     = useState("");
    const [advDateTo,       setAdvDateTo]       = useState("");

    const [summary,  setSummary]  = useState([]);
    const [records,  setRecords]  = useState([]);   // for expand detail rows
    const [expanded, setExpanded] = useState({});

    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState("");
    const [deleteTarget,  setDeleteTarget]  = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteError,   setDeleteError]   = useState("");

    const initialLoadDone = useRef(false);

    // ── Fetch ─────────────────────────────────────────────────
    const doFetch = useCallback(async (ft, fs, fd, tid, cpMin, cpMax, dFrom, dTo, showLoader = false) =>
    {
        const filters = {
            sku_type:       ft    || undefined,
            sku_subtype:    fs    || undefined,
            sku_dim:        fd    || undefined,
            tracking_id:    tid   || undefined,
            cost_price_min: cpMin || undefined,
            cost_price_max: cpMax || undefined,
            date_from:      dFrom || undefined,
            date_to:        dTo   || undefined
        };
        if (!initialLoadDone.current || showLoader) setLoading(true);
        setError("");
        try {
            const [summ, raw] = await Promise.all([
                getInventorySummary(filters),
                searchInventory(filters)
            ]);
            setSummary(summ); setRecords(raw);
            initialLoadDone.current = true;
        } catch (err) {
            setError(err.message || "Failed to fetch inventory");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { doFetch("", "", "", "", "", "", "", ""); }, [doFetch]);

    // Refresh when parent signals (e.g. after edit/add)
    const prevRefreshKey = useRef(refreshKey);
    useEffect(() => {
        if (prevRefreshKey.current !== refreshKey) {
            prevRefreshKey.current = refreshKey;
            const { type, subtype, dim } = inlineRef.current;
            doFetch(type, subtype, dim, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo);
        }
    }, [refreshKey, doFetch, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo]);

    const handleInlineChange = useCallback((t, s, d) =>
    {
        inlineRef.current = { type: t, subtype: s, dim: d };
        doFetch(t, s, d, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doFetch, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo]);

    const handleRefresh = useCallback(() =>
    {
        const { type, subtype, dim } = inlineRef.current;
        doFetch(type, subtype, dim, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo, true);
    }, [doFetch, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo]);

    const handleAdvSearch = () =>
    {
        const { type, subtype, dim } = inlineRef.current;
        doFetch(type, subtype, dim, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo);
    };

    const handleClear = () =>
    {
        inlineRef.current = { type: "", subtype: "", dim: "" };
        setAdvTrackingId(""); setAdvCostPriceMin(""); setAdvCostPriceMax("");
        setAdvDateFrom(""); setAdvDateTo(""); setAdvOpen(false);
        setExpanded({});
        setResetKey(k => k + 1);
        doFetch("", "", "", "", "", "", "", "", true);
    };

    // ── Expand ───────────────────────────────────────────────
    const summaryKey    = (row) => `${row.sku_type}|${row.sku_subtype}|${row.sku_dim}`;
    const toggleExpand  = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    const detailsForKey = (row) =>
        records.filter(r =>
            r.sku_type    === row.sku_type    &&
            r.sku_subtype === row.sku_subtype &&
            r.sku_dim     === row.sku_dim
        );

    // ── Delete ───────────────────────────────────────────────
    const handleDeleteClick = (record) =>
    {
        setDeleteTarget(record); setDeleteError(""); setDeleteConfirm(true);
    };

    const confirmDelete = async () =>
    {
        const target = deleteTarget;
        setDeleteConfirm(false); setDeleteTarget(null);
        try {
            await deleteInventoryItem(target.sku_id);
            // Silent refresh (no loader, preserves scroll/expanded)
            const { type, subtype, dim } = inlineRef.current;
            doFetch(type, subtype, dim, advTrackingId, advCostPriceMin, advCostPriceMax, advDateFrom, advDateTo);
        } catch (err) {
            setDeleteError(err.message || "Failed to delete SKU");
        }
    };

    const splitDt = (dt) =>
    {
        if (!dt) return { date: "—", time: "—" };
        const [d, t] = dt.split("T");
        return { date: d || "—", time: t ? t.slice(0, 8) : "—" };
    };

    return (
        <div className="retrieval-container">

            <ConfirmDialog
                open={deleteConfirm} variant="danger" title="Delete SKU"
                message={deleteTarget ? <>Permanently delete <strong>SKU {deleteTarget.sku_id}</strong>? This cannot be undone.</> : ""}
                confirmLabel="Yes, Delete" cancelLabel="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => { setDeleteConfirm(false); setDeleteTarget(null); }}
            />

            <div className="retrieval-header-row">
                <h1>Inventory</h1>
                <div className="retrieval-toolbar">
                    <button className="rtb-btn" onClick={() => { setExpanded({}); handleRefresh(); }} disabled={loading}>↻</button>
                    <button className="rtb-btn" onClick={handleClear} disabled={loading}>✕ Clear</button>
                    <button className="rtb-btn rtb-adv" onClick={() => setAdvOpen(o => !o)}>
                        {advOpen ? "▲ Adv. Search" : "▼ Adv. Search"}
                    </button>
                </div>
            </div>

            {deleteError && <div className="retrieval-error">{deleteError}</div>}
            {error       && <div className="retrieval-error">{error}</div>}

            {advOpen && (
                <div className="retrieval-adv-panel">
                    <div className="adv-row">
                        <div className="adv-field"><label>Tracking ID</label>
                            <input value={advTrackingId} onChange={e => setAdvTrackingId(e.target.value)} placeholder="contains…" />
                        </div>
                        <div className="adv-field"><label>Cost Price Min</label>
                            <input type="number" min="0" step="0.01" value={advCostPriceMin} onChange={e => setAdvCostPriceMin(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="adv-field"><label>Cost Price Max</label>
                            <input type="number" min="0" step="0.01" value={advCostPriceMax} onChange={e => setAdvCostPriceMax(e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="adv-field"><label>Date From</label>
                            <input type="date" value={advDateFrom} onChange={e => setAdvDateFrom(e.target.value)} />
                        </div>
                        <div className="adv-field"><label>Date To</label>
                            <input type="date" value={advDateTo} onChange={e => setAdvDateTo(e.target.value)} />
                        </div>
                        <div className="adv-field adv-field-btn"><label>&nbsp;</label>
                            <button className="retrieval-search-btn" onClick={handleAdvSearch} disabled={loading}>
                                {loading ? "…" : "Search"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="retrieval-table-wrapper">
                {/* Filter bar — always rendered, never unmounts */}
                <div className="retrieval-filter-bar-wrap">
                    <table className="retrieval-table retrieval-filter-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Sub Type</th>
                                <th>Dimensions (mm)</th>
                                <th className="th-qty">Total Qty (kgs)</th>
                                <th>Batches</th>
                                <th className="col-actions"></th>
                            </tr>
                            <FilterBar resetKey={resetKey} onFilterChange={handleInlineChange} />
                        </thead>
                    </table>
                </div>

                {loading && <div className="retrieval-records-placeholder">Loading…</div>}

                {!loading && summary.length === 0 && (
                    <div className="retrieval-records-placeholder">No inventory records found.</div>
                )}

                {!loading && summary.length > 0 && (
                    <div className="retrieval-table-scroll">
                        <table className="retrieval-table">
                            <tbody>
                                {summary.map(row =>
                                {
                                    const key    = summaryKey(row);
                                    const isOpen = !!expanded[key];
                                    const dets   = detailsForKey(row);
                                    return (
                                        <Fragment key={key}>
                                            <tr className="summary-row">
                                                <td>{row.sku_type}</td>
                                                <td>{row.sku_subtype}</td>
                                                <td>{row.sku_dim}</td>
                                                <td className="td-qty">{parseFloat(row.total_quantity).toFixed(3)}</td>
                                                <td>{row.batch_count}</td>
                                                <td className="col-actions">
                                                    <button className="retrieval-cart-btn"
                                                        onClick={() => onOrderWithProduct(row.sku_type, row.sku_subtype, row.sku_dim)}>🛒</button>
                                                    <button className="retrieval-expand-btn" onClick={() => toggleExpand(key)}>
                                                        {isOpen ? "▲ Hide" : "▼ Details"}
                                                    </button>
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className="detail-row">
                                                    <td colSpan={6} style={{ padding: 0 }}>
                                                        <table className="detail-inner-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Type</th><th>Sub Type</th><th>Dimensions</th>
                                                                    <th className="th-qty">Quantity (kgs)</th>
                                                                    <th className="th-price">Cost Price (Rs.)</th>
                                                                    <th>Units</th><th>Tracking ID</th>
                                                                    <th>Entry Date</th><th></th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {dets.map(r =>
                                                                {
                                                                    const { date } = splitDt(r.entry_date);
                                                                    return (
                                                                        <tr key={r.sku_id}>
                                                                            <td>{r.sku_type}</td>
                                                                            <td>{r.sku_subtype}</td><td>{r.sku_dim}</td>
                                                                            <td className="td-qty">{parseFloat(r.sku_quantity).toFixed(3)}</td>
                                                                            <td className="td-price">{parseFloat(r.sku_cost_price).toFixed(2)}</td>
                                                                            <td>{r.sku_units}</td><td>{r.tracking_id || "—"}</td>
                                                                            <td>{date}</td>
                                                                            <td>
                                                                                <div className="detail-actions">
                                                                                    <button className="retrieval-search-button" title="View" onClick={() => onViewRecord(r)}>🔍</button>
                                                                                    <button className="retrieval-edit-btn" onClick={() => onEditRecord(r)}>✎</button>
                                                                                    <button className="retrieval-delete-btn" onClick={() => handleDeleteClick(r)}>🗑</button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <button className="retrieval-fab" onClick={onAddRecord} title="Add new SKU">+</button>

        </div>
    );
}

export default InventoryRetrieval;
