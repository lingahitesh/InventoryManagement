import "../styles/home.css";

function Home({ openTab, onLogout })
{
    return (
        <div className="container">

            <div className="main-layout">

                <div className="records-panel">
                    <h2>Database Records</h2>

                    <div className="records-placeholder">
                        Records will appear here
                    </div>
                </div>

                <div className="menu-panel">

                    <button
                        className="menu-btn"
                        onClick={() =>
                            openTab(
                                "feeding",
                                "Inventory Feeding"
                            )
                        }
                    >
                        Inventory Feeding
                        <span className="menu-plus">+</span>
                    </button>

                    <button
                        className="menu-btn"
                        onClick={() =>
                            openTab(
                                "retrieval",
                                "Inventory Retrieval"
                            )
                        }
                    >
                        Inventory Retrieval
                        <span className="menu-plus">+</span>
                    </button>

                    <button
                        className="menu-btn"
                        onClick={() =>
                            openTab(
                                "order",
                                "Place Order"
                            )
                        }
                    >
                        Place Order
                        <span className="menu-plus">+</span>
                    </button>

                    <button
                        className="menu-btn"
                        onClick={() =>
                            openTab(
                                "customer",
                                "Customer List"
                            )
                        }
                    >
                        Customer List
                        <span className="menu-plus">+</span>
                    </button>

                </div>

            </div>

            <div className="bottom-section">

                <button
                    className="logout-btn"
                    onClick={onLogout}
                >
                    ← LogOut
                </button>

            </div>

        </div>
    );
}

export default Home;
