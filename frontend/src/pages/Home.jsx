import { useEffect } from "react";
import "../styles/home.css";

function Home({ onLogout, inventory, inventoryLoading, inventoryError, refreshInventory })
{
    useEffect(() => { refreshInventory(); }, []);

    return (
        <div className="container">

            <div className="main-layout">

                {/* ── Left: Database Records ── */}
                <div className="records-panel">
                    <h2>Database Records</h2>

                    {inventoryLoading && <div className="records-placeholder">Loading…</div>}
                    {inventoryError   && <div className="records-placeholder" style={{ color: "red" }}>{inventoryError}</div>}

                    {!inventoryLoading && !inventoryError && inventory.length === 0 && (
                        <div className="records-placeholder">No inventory records yet.</div>
                    )}

                    {!inventoryLoading && !inventoryError && inventory.length > 0 && (
                        <div className="records-table-wrapper">
                            <table className="records-table">
                                <thead>
                                    <tr>
                                        <th>SKU ID</th>
                                        <th>Type</th>
                                        <th>Sub Type</th>
                                        <th>Dim (mm)</th>
                                        <th className="th-qty">Quantity (kgs)</th>
                                        <th className="th-price">Cost Price (Rs.)</th>
                                        <th>Units</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventory.map(r => (
                                        <tr key={r.sku_id}>
                                            <td>{r.sku_id}</td>
                                            <td>{r.sku_type}</td>
                                            <td>{r.sku_subtype}</td>
                                            <td>{r.sku_dim}</td>
                                            <td className="td-qty">{parseFloat(r.sku_quantity).toFixed(3)}</td>
                                            <td className="td-price">{parseFloat(r.sku_cost_price).toFixed(2)}</td>
                                            <td>{r.sku_units}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Right: Two chart placeholders ── */}
                <div className="charts-panel">
                    <div className="chart-placeholder">
                        <span className="chart-label">Chart 1</span>
                    </div>
                    <div className="chart-placeholder">
                        <span className="chart-label">Chart 2</span>
                    </div>
                </div>

            </div>

            <div className="bottom-section">
                <button className="logout-btn" onClick={onLogout}>← LogOut</button>
            </div>

        </div>
    );
}

export default Home;
