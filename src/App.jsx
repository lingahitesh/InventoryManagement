import { useState, useRef } from "react";

import "./App.css";

import Login from "./pages/Login";
import Home from "./pages/Home";
import InventoryFeeding from "./pages/InventoryFeeding";
import InventoryRetrieval from "./pages/InventoryRetrieval";
import PlaceOrder from "./pages/PlaceOrder";
import CustomerList from "./pages/CustomerList";

function App()
{
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [customers, setCustomers] = useState([]);

    const [tabs, setTabs] = useState([{ id: "home", title: "Home" }]);
    const [activeTab, setActiveTab] = useState("home");

    // Each page that needs a close-guard registers its requestClose fn here
    const closeGuards = useRef({});

    const registerCloseGuard = (tabId, fn) =>
    {
        closeGuards.current[tabId] = fn;
    };

    const handleLogin = () => setIsAuthenticated(true);

    const handleLogout = () =>
    {
        setIsAuthenticated(false);
        setTabs([{ id: "home", title: "Home" }]);
        setActiveTab("home");
        closeGuards.current = {};
    };

    const doCloseTab = (id) =>
    {
        const updatedTabs = tabs.filter(tab => tab.id !== id);
        delete closeGuards.current[id];

        if (updatedTabs.length === 0)
        {
            handleLogout();
            return;
        }

        setTabs(updatedTabs);

        if (activeTab === id)
        {
            const closedIndex = tabs.findIndex(t => t.id === id);
            const nextTab = updatedTabs[Math.max(0, closedIndex - 1)];
            setActiveTab(nextTab.id);
        }
    };

    // Called by the × button — delegates to the page's guard if one exists
    const requestCloseTab = (id) =>
    {
        const guard = closeGuards.current[id];
        if (guard)
        {
            guard(() => doCloseTab(id));
        }
        else
        {
            doCloseTab(id);
        }
    };

    const closeCurrentTab = () => doCloseTab(activeTab);

    const switchTab = (id) => setActiveTab(id);

    const openTab = (id, title) =>
    {
        if (!tabs.find(tab => tab.id === id))
        {
            setTabs([...tabs, { id, title }]);
        }
        switchTab(id);
    };

    const goBack = () =>
    {
        const parentMap = {
            feeding: "home",
            retrieval: "home",
            order: "home",
            customer: "home",
        };
        const parent = parentMap[activeTab];
        if (parent) setActiveTab(parent);
    };

    if (!isAuthenticated)
    {
        return <Login onLogin={handleLogin} />;
    }

    return (
        <div className="app">

            <div className="tab-bar">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={activeTab === tab.id ? "tab active" : "tab"}
                        onClick={() => switchTab(tab.id)}
                    >
                        {tab.title}
                        <span
                            className="close"
                            onClick={(e) =>
                            {
                                e.stopPropagation();
                                requestCloseTab(tab.id);
                            }}
                        >
                            ×
                        </span>
                    </div>
                ))}
            </div>

            <div className="content">

                {tabs.find(t => t.id === "home") && (
                    <div style={{ display: activeTab === "home" ? "block" : "none" }}>
                        <Home openTab={openTab} onLogout={handleLogout} />
                    </div>
                )}

                {tabs.find(t => t.id === "feeding") && (
                    <div style={{ display: activeTab === "feeding" ? "block" : "none" }}>
                        <InventoryFeeding
                            closeCurrentTab={closeCurrentTab}
                            registerCloseGuard={(fn) => registerCloseGuard("feeding", fn)}
                        />
                    </div>
                )}

                {tabs.find(t => t.id === "retrieval") && (
                    <div style={{ display: activeTab === "retrieval" ? "block" : "none" }}>
                        <InventoryRetrieval
                            openTab={openTab}
                            goBack={goBack}
                            closeCurrentTab={closeCurrentTab}
                        />
                    </div>
                )}

                {tabs.find(t => t.id === "order") && (
                    <div style={{ display: activeTab === "order" ? "block" : "none" }}>
                        <PlaceOrder
                            closeCurrentTab={closeCurrentTab}
                            customers={customers}
                            registerCloseGuard={(fn) => registerCloseGuard("order", fn)}
                        />
                    </div>
                )}

                {tabs.find(t => t.id === "customer") && (
                    <div style={{ display: activeTab === "customer" ? "block" : "none" }}>
                        <CustomerList
                            goBack={goBack}
                            customers={customers}
                            setCustomers={setCustomers}
                        />
                    </div>
                )}

            </div>

        </div>
    );
}

export default App;
