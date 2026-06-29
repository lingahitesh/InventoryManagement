import { useState, useRef, useCallback, useEffect } from "react";

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
import Profile      from "./pages/Profile";
import ModalOverlay from "./components/ModalOverlay";
import { getInventory } from "./api";

function App()
{
    // ── Session persistence (localStorage, 4hr TTL) ──────────
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        const session = localStorage.getItem("session");
        if (!session) return false;
        try {
            const { expiry } = JSON.parse(session);
            if (Date.now() > expiry) { localStorage.removeItem("session"); return false; }
            return true;
        } catch { localStorage.removeItem("session"); return false; }
    });
    const [currentUser, setCurrentUser] = useState(() => {
        const session = localStorage.getItem("session");
        if (!session) return null;
        try { return JSON.parse(session).user; } catch { return null; }
    });
    const [privileges, setPrivileges] = useState(() => {
        const session = localStorage.getItem("session");
        if (!session) return {};
        try { return JSON.parse(session).privileges || {}; } catch { return {}; }
    });
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

    // ── Smart Collapsible Header ─────────────────────────────
    const [navHidden, setNavHidden] = useState(false);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    useEffect(() => {
        const onScroll = () => {
            if (ticking.current) return;
            ticking.current = true;
            requestAnimationFrame(() => {
                const currentY = window.scrollY;
                const delta = currentY - lastScrollY.current;

                if (delta > 5 && currentY > 50) {
                    // Scrolling down past threshold — hide
                    setNavHidden(true);
                } else if (delta < -5) {
                    // Scrolling up by at least 5px — show
                    setNavHidden(false);
                }

                lastScrollY.current = currentY;
                ticking.current = false;
            });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const registerCloseGuard = (tabId, fn) => { closeGuards.current[tabId] = fn; };

    const handleLogin  = (user, privs) => {
        const session = { user, privileges: privs || {}, expiry: Date.now() + 4 * 60 * 60 * 1000 }; // 4 hours
        localStorage.setItem("session", JSON.stringify(session));
        setIsAuthenticated(true);
        setCurrentUser(user);
        setPrivileges(privs || {});
    };
    const handleLogout = () =>
    {
        localStorage.removeItem("session");
        setIsAuthenticated(false);
        setCurrentUser(null);
        setPrivileges({});
        setTabs([{ id: "home", title: "Home" }]);
        setActiveTab("home");
        setCart([]);
        setShowProfileModal(false);
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
    const switchTab = (id) => { setActiveTab(id); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" })); };

    const openTab = (id, title) =>
    {
        if (!tabs.find(t => t.id === id)) setTabs(prev => [...prev, { id, title }]);
        setActiveTab(id);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
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
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Triggers for quick actions to open create forms in child components
    const [poCreateTrigger, setPoCreateTrigger] = useState(0);
    const [salesSubTabTrigger, setSalesSubTabTrigger] = useState(0);
    const [dispatchCreateTrigger, setDispatchCreateTrigger] = useState(0);
    const [customerCreateTrigger, setCustomerCreateTrigger] = useState(0);
    const [paymentCreateTrigger, setPaymentCreateTrigger] = useState(0);

    const openEditInventory = useCallback((record) =>
    {
        setEditingInventoryRecord(record);
        setShowFeedingModal(true);
    }, []);

    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    const NAV_TABS = [
        { id: "retrieval",  title: "Inventory",     module: "inventory" },
        { id: "customer",   title: "Customer List", module: "customer" },
        { id: "orderlist",  title: "Order List",    module: "sales_order" },
        { id: "dispatch",   title: "Dispatch",      module: "dispatch" },
        { id: "payment",    title: "Payment",       module: "payment" },
    ];

    // Filter nav tabs based on user privileges (view permission required)
    const visibleNavTabs = NAV_TABS.filter(nav => {
        if (nav.id === "orderlist") {
            // Show Order List if either sales_order or purchase_order has view
            return (privileges.sales_order?.view !== false) || (privileges.purchase_order?.view !== false);
        }
        const modPriv = privileges[nav.module];
        return modPriv && modPriv.view;
    });

    return (
        <div className="app">

            <div className={`tab-bar${navHidden ? " tab-bar-hidden" : ""}`}>
                <div className={activeTab === "home" ? "tab active" : "tab"} onClick={() => switchTab("home")}>Home</div>
                {visibleNavTabs.map(nav => (
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

            {/* Profile button */}
            <div className={`profile-btn-wrap${navHidden ? " tab-bar-hidden" : ""}`}>
                <button className="profile-btn" onClick={() => setShowProfileModal(true)}>
                    {currentUser ? currentUser.fname[0] + (currentUser.lname?.[0] || "") : "?"}
                </button>
            </div>

            <div className="content">

                {/* ── Home ── */}
                <div style={{ display: activeTab === "home" ? "block" : "none" }}>
                    <Home openTab={openTab}
                        onAddInventory={() => { openTab("retrieval", "Inventory"); setShowFeedingModal(true); }}
                        onCreateSalesOrder={() => { openTab("orderlist", "Order List"); setSalesSubTabTrigger(k => k + 1); setShowOrderModal(true); }}
                        onCreatePurchaseOrder={() => { openTab("orderlist", "Order List"); setPoCreateTrigger(k => k + 1); }}
                        onCreateDispatch={() => { openTab("dispatch", "Dispatch"); setDispatchCreateTrigger(k => k + 1); }}
                        onAddCustomer={() => { openTab("customer", "Customer List"); setCustomerCreateTrigger(k => k + 1); }}
                        onNewPayment={() => { openTab("payment", "Payment"); setPaymentCreateTrigger(k => k + 1); }}
                        currentUser={currentUser}
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
                        privileges={privileges.inventory}
                        canCreateOrder={privileges.sales_order?.create !== false}
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
                        customers={customers} setCustomers={setCustomers}
                        privileges={privileges.customer}
                        createTrigger={customerCreateTrigger} />
                </div>

                {/* ── Order List ── */}
                <div style={{ display: activeTab === "orderlist" ? "block" : "none" }}>
                    <OrderList
                        onEditOrder={(order) => { setEditingOrder(order); setShowOrderModal(true); }}
                        onNewOrder={() => setShowOrderModal(true)}
                        refreshKey={orderRefreshKey}
                        onOrderDelete={() => { refreshInventory(); setInventoryRefreshKey(k => k + 1); }}
                        privileges={{ ...privileges.sales_order, _po: privileges.purchase_order }}
                        poCreateTrigger={poCreateTrigger}
                        salesSubTabTrigger={salesSubTabTrigger}
                    />
                    {/* Place Order overlay on Order List tab */}
                    {showOrderModal && (
                        <ModalOverlay open={true}
                            title={editingOrder ? `Edit Order #${editingOrder.order_id}` : "Place Sales Order"}
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
                    <Dispatch onDispatchSuccess={() => setOrderRefreshKey(k => k + 1)} privileges={privileges.dispatch} createTrigger={dispatchCreateTrigger} />
                </div>

                {/* ── Payment ── */}
                <div style={{ display: activeTab === "payment" ? "block" : "none" }}>
                    <Payment privileges={privileges.payment} createTrigger={paymentCreateTrigger} />
                </div>

            </div>

            {/* ── Profile Modal ── */}
            {showProfileModal && (
                <ModalOverlay open={true} title="Profile" onClose={() => setShowProfileModal(false)}>
                    <Profile currentUser={currentUser} onLogout={handleLogout} onClose={() => setShowProfileModal(false)} />
                </ModalOverlay>
            )}

        </div>
    );
}

export default App;
