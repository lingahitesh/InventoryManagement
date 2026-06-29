import { useState, useEffect } from "react";
import "../styles/home.css";
import {
    TrendingUp, TrendingDown, Package, ShoppingCart, Truck, DollarSign,
    Users, Bell, Clock, AlertTriangle, Plus, FileText, CreditCard,
    CheckSquare, Square, ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";
import {
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { getDashboardData } from "../api";


const notifications = [
    { id: 1, text: "Dispatch #105 pending approval", time: "2 min ago", type: "warning" },
    { id: 2, text: "Payment ₹47,200 received from Rajesh", time: "15 min ago", type: "success" },
    { id: 3, text: "New customer Priya Verma added", time: "1 hr ago", type: "info" },
    { id: 4, text: "BOPP 25 MIC stock running low", time: "2 hr ago", type: "danger" },
    { id: 5, text: "Order #641 completed & dispatched", time: "3 hr ago", type: "success" },
];

const todos = [
    { id: 1, text: "Dispatch Order #43", done: false },
    { id: 2, text: "Generate Invoice for Amit", done: false },
    { id: 3, text: "Follow up payment — Sharma", done: true },
    { id: 4, text: "Update inventory after PO arrival", done: false },
    { id: 5, text: "Verify BOPP stock levels", done: false },
];

const trendingProducts = [
    { name: "BOPP 25 MIC", sold: 1240, stock: 350, trend: "up" },
    { name: "PET 12 MIC Untreated", sold: 890, stock: 520, trend: "up" },
    { name: "LD Natural 120 Gauge", sold: 670, stock: 160, trend: "down" },
    { name: "MET CPP 20 MIC", sold: 540, stock: 280, trend: "up" },
];

const lowStockAlerts = [
    { product: "BOPP 25 MIC 400", current: 12, minimum: 50, status: "critical" },
    { product: "PET 09 MIC 305", current: 25, minimum: 40, status: "warning" },
    { product: "LD Natural 120G 500", current: 18, minimum: 30, status: "critical" },
];

function KPICard({ icon: Icon, title, value, trend, trendValue, accent }) {
    return (
        <div className="dash-kpi-card">
            <div className="dash-kpi-accent" style={{ background: accent }} />
            <div className="dash-kpi-icon" style={{ color: accent }}><Icon size={20} /></div>
            <div className="dash-kpi-content">
                <span className="dash-kpi-title">{title}</span>
                <span className="dash-kpi-value">{value}</span>
                <span className={`dash-kpi-trend ${trend}`}>
                    {trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {trendValue}
                </span>
            </div>
        </div>
    );
}

function NotificationItem({ item }) {
    const colors = { warning: "#f59e0b", success: "#10b981", info: "#3b82f6", danger: "#ef4444" };
    return (
        <div className="dash-notif-item">
            <div className="dash-notif-dot" style={{ background: colors[item.type] }} />
            <div className="dash-notif-body">
                <span className="dash-notif-text">{item.text}</span>
                <span className="dash-notif-time"><Clock size={10} /> {item.time}</span>
            </div>
        </div>
    );
}

function TodoItem({ item, onToggle }) {
    return (
        <div className={`dash-todo-item ${item.done ? "done" : ""}`} onClick={onToggle}>
            {item.done ? <CheckSquare size={16} className="dash-todo-check" /> : <Square size={16} className="dash-todo-check" />}
            <span>{item.text}</span>
        </div>
    );
}

function Home({ openTab, onAddInventory, onCreateSalesOrder, onCreatePurchaseOrder, onCreateDispatch, onAddCustomer, onNewPayment, currentUser }) {
    const [todoList, setTodoList] = useState(todos);
    const [dash, setDash] = useState(null);
    const today = new Date();
    const greeting = today.getHours() < 12 ? "Good Morning" : today.getHours() < 17 ? "Good Afternoon" : "Good Evening";
    const dateStr = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    useEffect(() => { getDashboardData().then(setDash).catch(() => {}); }, []);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => { getDashboardData().then(setDash).catch(() => {}); }, 60000);
        return () => clearInterval(interval);
    }, []);

    const toggleTodo = (id) => {
        setTodoList(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const fmtVal = (v) => {
        if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
        if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
        return `₹${v.toFixed(0)}`;
    };

    const userName = currentUser?.fname || "there";

    return (
        <div className="dash-container">
            {/* ── Header Section ── */}
            <div className="dash-greeting">
                <div>
                    <h1 className="dash-greeting-title">{greeting}, {userName}</h1>
                    <p className="dash-greeting-company">Champa Polyplast Pvt. Ltd.</p>
                    <p className="dash-greeting-date">{dateStr}</p>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="dash-kpi-grid">
                <KPICard icon={Package} title="Inventory Value" value={dash ? fmtVal(dash.inventory_value) : "—"} trend="up" trendValue="" accent="#3b82f6" />
                <KPICard icon={ShoppingCart} title="Orders Today" value={dash ? String(dash.orders_today) : "—"} trend="up" trendValue="" accent="#8b5cf6" />
                <KPICard icon={Truck} title="Dispatches Pending" value={dash ? String(dash.dispatches_pending) : "—"} trend="down" trendValue="" accent="#f59e0b" />
                <KPICard icon={DollarSign} title="Revenue This Month" value={dash ? fmtVal(dash.revenue_this_month) : "—"} trend="up" trendValue="" accent="#10b981" />
                <KPICard icon={CreditCard} title="Outstanding" value={dash ? fmtVal(dash.outstanding) : "—"} trend="down" trendValue="" accent="#ef4444" />
                <KPICard icon={Users} title="Active Customers" value={dash ? String(dash.active_customers) : "—"} trend="up" trendValue="" accent="#06b6d4" />
            </div>

            {/* ── Main Grid: Left Charts + Right Panels ── */}
            <div className="dash-main-grid">
                {/* Left Column — Charts */}
                <div className="dash-left-col">
                    <div className="dash-card">
                        <h3 className="dash-card-title"><Activity size={16} /> Revenue Overview (Last 30 Days)</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={dash?.revenue_chart || []}>
                                <defs>
                                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                                <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, "Revenue"]} />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                </div>

                {/* Right Column — Notifications, Todos, Quick Actions */}
                <div className="dash-right-col">
                    <div className="dash-card">
                        <h3 className="dash-card-title"><Bell size={16} /> Notifications</h3>
                        <div className="dash-notif-list">
                            {notifications.map(n => <NotificationItem key={n.id} item={n} />)}
                        </div>
                    </div>

                    <div className="dash-card">
                        <h3 className="dash-card-title"><CheckSquare size={16} /> To Do</h3>
                        <div className="dash-todo-list">
                            {todoList.map(t => <TodoItem key={t.id} item={t} onToggle={() => toggleTodo(t.id)} />)}
                        </div>
                    </div>

                    <div className="dash-card">
                        <h3 className="dash-card-title">Quick Actions</h3>
                        <div className="dash-quick-actions">
                            <button className="dash-qa-btn" onClick={onAddInventory}><Plus size={14} /> Add Inventory</button>
                            <button className="dash-qa-btn" onClick={onCreateSalesOrder}><ShoppingCart size={14} /> Create Sales Order</button>
                            <button className="dash-qa-btn" onClick={onCreatePurchaseOrder}><FileText size={14} /> Create Purchase Order</button>
                            <button className="dash-qa-btn" onClick={onCreateDispatch}><Truck size={14} /> Create Dispatch</button>
                            <button className="dash-qa-btn" onClick={onAddCustomer}><Users size={14} /> Add Customer</button>
                            <button className="dash-qa-btn" onClick={onNewPayment}><CreditCard size={14} /> New Payment</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Bottom Section — Trending + Low Stock + Tables ── */}
            <div className="dash-bottom-grid">
                <div className="dash-card">
                    <h3 className="dash-card-title"><TrendingUp size={16} /> Trending Products</h3>
                    <table className="dash-table">
                        <thead><tr><th>Product</th><th>Sold (kgs)</th><th>Stock</th><th>Trend</th></tr></thead>
                        <tbody>
                            {trendingProducts.map((p, i) => (
                                <tr key={i}>
                                    <td>{p.name}</td>
                                    <td>{p.sold.toLocaleString()}</td>
                                    <td>{p.stock}</td>
                                    <td>{p.trend === "up"
                                        ? <span className="dash-trend-up"><TrendingUp size={12} /></span>
                                        : <span className="dash-trend-down"><TrendingDown size={12} /></span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="dash-card">
                    <h3 className="dash-card-title"><AlertTriangle size={16} /> Low Stock Alerts</h3>
                    <table className="dash-table">
                        <thead><tr><th>Product</th><th>Current</th><th>Minimum</th><th>Status</th></tr></thead>
                        <tbody>
                            {lowStockAlerts.map((a, i) => (
                                <tr key={i}>
                                    <td>{a.product}</td>
                                    <td>{a.current}</td>
                                    <td>{a.minimum}</td>
                                    <td><span className={`dash-stock-status ${a.status}`}>{a.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Home;
