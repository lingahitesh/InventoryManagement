import { useState, useRef, useCallback } from "react";

import "./App.css";

import Login        from "./pages/Login";
import Home         from "./pages/Home";
import InventoryFeeding    from "./pages/InventoryFeeding";
import InventoryRetrieval  from "./pages/InventoryRetrieval";
import PlaceOrder   from "./pages/PlaceOrder";
import CustomerList from "./pages/CustomerList";
import OrderList    from "./pages/OrderList";
import Dispatch     from "./pages/Dispatch";
import Payment      from "./pages/Payment";
import ModalOverlay from "./components/ModalOverlay";
import { getInventory } from "./api";

function App()
{
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [customers,       setCustomers]       = useState([]);

    // ── Shared inventory state ───────────────────────────────
    const [inventory,        setInventory]        = useState([]);
    const [inventoryLoading, setInventoryLoading] = useState(false);
    const [inventoryError,   setInventoryError]   = useState("");

    const refreshInventory = useCallback(() =>
    {
        setInventoryLoading(true);
        setInventoryError("");
        getInventory()
            .then(data  => setInventory(data))
            .catch(err  => setInventoryError(err.message || "Failed to load inventory"))
            .finally(() => setInventoryLoading(false));
    }, []);

    // ── Shared cart ──────────────────────────────────────────
    const [cart, setCart] = useState([]);

    const getCartReserved = useCallback((sku_type, sku_subtype, sku_dim) =>
        cart
            .filter(i => i.sku_type === sku_type && i.sku_subtype === sku_subtype && i.sku_dim === sku_dim && !i.fromEdit)
            .reduce((sum, i) => sum + i.quantity, 0),
    [cart]);

    // ── Edit inventory state ─────────────────────────────────
    const [orderPrefill, setOrderPrefill] = useState(null);
    const [editingOrder, setEditingOrder] = useState(null);
    const [orderRefreshKey, setOrderRefreshKey] = useState(0);
    const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

    // ── Tabs ─────────────────────────────────────────────────
    const [tabs,      setTabs]      = useState([{ id: "home", title: "Home" }]);
    const [activeTab, setActiveTab] = useState("home");
    const closeGuards = useRef({});

    const registerCloseGuard = (tabId, fn) => { closeGuards.current[tabId] = fn; };

    const handleLogin  = () => setIsAuthenticated(true);
    const handleLogout = () =>
    {
        setIsAuthenticated(false);
        setTabs([{ id: "home", title: "Home" }]);
        setActiveTab("home");
        setCart([]);
        setEditRecordMap({});
        closeGuards.current = {};
    };

    const doCloseTab = (id) =>
    {
        const updatedTabs = tabs.filter(t => t.id !== id);
        delete closeGuards.current[id];
        if (id === "order") setCart([]);
        if (updatedTabs.length === 0) { handleLogout(); return; }
        setTabs(updatedTabs);
        if (activeTab === id)
        {
            const idx = tabs.findIndex(t => t.id === id);
            setActiveTab(updatedTabs[Math.max(0, idx - 1)].id);
        }
    };

    const requestCloseTab = (id) =>
    {
        const guard = closeGuards.current[id];
        guard ? guard(() => doCloseTab(id)) : doCloseTab(id);
    };

    const closeCurrentTab = () => doCloseTab(activeTab);
    const switchTab = (id) => setActiveTab(id);

    const openTab = (id, title) =>
    {
        if (!tabs.find(t => t.id === id)) setTabs(prev => [...prev, { id, title }]);
        switchTab(id);
    };

    const goBack = () =>
    {
        const parent = { feeding: "home", retrieval: "home", order: "home", customer: "home" }[activeTab];
        if (parent) setActiveTab(parent);
    };

    // Open edit as a modal overlay (reuse feeding modal with edit record)
    const [editingInventoryRecord, setEditingInventoryRecord] = useState(null);
    const [viewingInventoryRecord, setViewingInventoryRecord] = useState(null);
    const [showFeedingModal, setShowFeedingModal] = useState(false);
    const [showViewModal,    setShowViewModal]    = useState(false);
    const [showOrderModal,   setShowOrderModal]   = useState(false);

    const openEditInventory = useCallback((record) =>
    {
        setEditingInventoryRecord(record);
        setShowFeedingModal(true);
    }, []);

    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    const NAV_TABS = [
        { id: "retrieval",  title: "Inventory" },
        { id: "customer",   title: "Customer List" },
        { id: "orderlist",  title: "Order List" },
        { id: "dispatch",   title: "Dispatch" },
        { id: "payment",    title: "Payment" },
    ];

    return (
        <div className="app">

            <div className="tab-bar">
                <div className={activeTab === "home" ? "tab active" : "tab"} onClick={() => switchTab("home")}>Home</div>
                {NAV_TABS.map(nav => (
                    <div key={nav.id} className={activeTab === nav.id ? "tab active" : "tab"}
                        onClick={() => openTab(nav.id, nav.title)}>{nav.title}</div>
                ))}
                {tabs.filter(t => t.id !== "home" && !NAV_TABS.find(n => n.id === t.id)).map(tab => (
                    <div key={tab.id} className={activeTab === tab.id ? "tab active" : "tab"} onClick={() => switchTab(tab.id)}>
                        {tab.title}
                        <span className="close" onClick={(e) => { e.stopPropagation(); requestCloseTab(tab.id); }}>×</span>
                    </div>
                ))}
            </div>

            <div className="content">

                {/* ── Home ── */}
                <div style={{ display: activeTab === "home" ? "block" : "none" }}>
                    <Home openTab={openTab} onLogout={handleLogout}
                        inventory={inventory} inventoryLoading={inventoryLoading}
                        inventoryError={inventoryError} refreshInventory={refreshInventory} />
                </div>

                {/* ── Inventory Retrieval ── */}
                <div style={{ display: activeTab === "retrieval" ? "block" : "none" }}>
                    <InventoryRetrieval
                        goBack={() => setActiveTab("home")}
                        closeCurrentTab={() => setActiveTab("home")}
                        onEditRecord={openEditInventory}
                        onAddRecord={() => setShowFeedingModal(true)}
                        onViewRecord={(r) => { setViewingInventoryRecord(r); setShowViewModal(true); }}
                        onOrderWithProduct={(type, subtype, dim) => {
                            setOrderPrefill({ type, subtype, dim });
                            setShowOrderModal(true);
                        }}
                        refreshKey={inventoryRefreshKey}
                    />
                    {/* Feeding overlay on Inventory tab */}
                    {showFeedingModal && (
                        <ModalOverlay open={true}
                            title={editingInventoryRecord ? `Edit SKU ${editingInventoryRecord.sku_id}` : "Inventory Feeding"}
                            onClose={() => { setShowFeedingModal(false); setEditingInventoryRecord(null); }}>
                            <InventoryFeeding
                                closeCurrentTab={() => { setShowFeedingModal(false); setEditingInventoryRecord(null); }}
                                registerCloseGuard={() => {}}
                                editRecord={editingInventoryRecord}
                                clearEditRecord={() => setEditingInventoryRecord(null)}
                                onSubmitSuccess={() => { refreshInventory(); setShowFeedingModal(false); setEditingInventoryRecord(null); setInventoryRefreshKey(k => k + 1); }}
                            />
                        </ModalOverlay>
                    )}
                    {/* View-only overlay */}
                    {showViewModal && viewingInventoryRecord && (
                        <ModalOverlay open={true}
                            title={`SKU ${viewingInventoryRecord.sku_id} Details`}
                            onClose={() => { setShowViewModal(false); setViewingInventoryRecord(null); }}>
                            <InventoryFeeding
                                closeCurrentTab={() => { setShowViewModal(false); setViewingInventoryRecord(null); }}
                                registerCloseGuard={() => {}}
                                editRecord={viewingInventoryRecord}
                                clearEditRecord={() => {}}
                                onSubmitSuccess={() => {}}
                                viewOnly={true}
                            />
                        </ModalOverlay>
                    )}
                </div>

                {/* ── Customer List ── */}
                <div style={{ display: activeTab === "customer" ? "block" : "none" }}>
                    <CustomerList goBack={() => setActiveTab("home")}
                        customers={customers} setCustomers={setCustomers} />
                </div>

                {/* ── Order List ── */}
                <div style={{ display: activeTab === "orderlist" ? "block" : "none" }}>
                    <OrderList
                        onEditOrder={(order) => { setEditingOrder(order); setShowOrderModal(true); }}
                        onNewOrder={() => setShowOrderModal(true)}
                        refreshKey={orderRefreshKey}
                        onOrderDelete={() => { refreshInventory(); setInventoryRefreshKey(k => k + 1); }}
                    />
                    {/* Place Order overlay on Order List tab */}
                    {showOrderModal && (
                        <ModalOverlay open={true}
                            title={editingOrder ? `Edit Order #${editingOrder.order_id}` : "Place Order"}
                            onClose={() => { setShowOrderModal(false); setEditingOrder(null); setCart([]); }}>
                            <PlaceOrder
                                isActive={showOrderModal}
                                closeCurrentTab={() => { setShowOrderModal(false); setEditingOrder(null); setCart([]); }}
                                registerCloseGuard={() => {}}
                                cart={cart} setCart={setCart} getCartReserved={getCartReserved}
                                orderPrefill={orderPrefill}
                                clearOrderPrefill={() => setOrderPrefill(null)}
                                editingOrder={editingOrder}
                                clearEditingOrder={() => setEditingOrder(null)}
                                onOrderSuccess={() => { refreshInventory(); setCart([]); setEditingOrder(null); setShowOrderModal(false); setOrderRefreshKey(k => k + 1); setInventoryRefreshKey(k => k + 1); }}
                            />
                        </ModalOverlay>
                    )}
                </div>

                {/* ── Dispatch ── */}
                <div style={{ display: activeTab === "dispatch" ? "block" : "none" }}>
                    <Dispatch onDispatchSuccess={() => setOrderRefreshKey(k => k + 1)} />
                </div>

                {/* ── Payment ── */}
                <div style={{ display: activeTab === "payment" ? "block" : "none" }}>
                    <Payment />
                </div>

            </div>

        </div>
    );
}

export default App;
