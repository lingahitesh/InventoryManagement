import { useState, useEffect } from "react";
import "../styles/home.css";
import {
    TrendingUp, TrendingDown, Package, ShoppingCart, Truck, DollarSign,
    Users, Bell, Clock, AlertTriangle, Plus, FileText, CreditCard,
    CheckSquare, Square, ArrowUpRight, ArrowDownRight, Activity
} from "lucide-react";
import {
    ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
    PieChart, Pie
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

// Fallback mock data shown before real data loads
const trendingProducts = [];
const lowStockAlerts = [];

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

/* ═══════════════════════════════════════════════════════════════
   Dumbbell Chart — Avg SP vs Avg CP
   ═══════════════════════════════════════════════════════════════ */
const PIE_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#f97316","#6366f1","#14b8a6","#e11d48"];

// Picks ~5 evenly spaced, human-friendly axis ticks between 0 and max.
function niceTicks(max, count = 5) {
    if (!(max > 0)) return [0];
    const rawStep = max / (count - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    const step = niceNorm * mag;
    const ticks = [];
    for (let v = 0; v <= max + step * 0.5; v += step) ticks.push(Math.round(v));
    return ticks;
}

// "+12.3%" / "-12.3%" / "—" — never the broken "+-12.3%"
function formatSignedPct(pct) {
    if (pct === null) return "—";
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function DumbbellChart({ data }) {
    const [hovered, setHovered] = useState(null);
    if (!data.length) return (
        <div className="dash-card" style={{flex:1}}>
            <h3 className="dash-card-title"><Activity size={16} /> Avg Selling vs Cost Price</h3>
            <div style={{padding:40, color:"#999", textAlign:"center", fontSize:13}}>No data yet</div>
        </div>
    );
    const maxVal = Math.max(...data.map(d => Math.max(d.avg_sp, d.avg_cp))) * 1.1;
    const rowH = 44;
    const leftW = 68;
    const rightW = 90;
    const chartW = "100%";
    const topPad = 20;
    const barTrackPct = 55; // % of full SVG width used as the bar track (matches bar/dot math below)

    // Reserve real, fixed space below the rows for: gap → axis line → tick labels → legend
    const axisY = data.length * rowH + topPad + 10;
    const tickLabelY = axisY + 14;
    const legendY = axisY + 36;
    const height = legendY + 10;

    const ticks = niceTicks(maxVal);
    const xFor = (v) => `calc(${leftW}px + ${(v / maxVal) * barTrackPct}%)`;

    return (
        <div className="dash-card" style={{flex:1}}>
            <h3 className="dash-card-title"><Activity size={16} /> Avg Selling vs Cost Price</h3>
            <div style={{position:"relative", overflowX:"auto"}}>
                <svg width={chartW} height={height} style={{display:"block", minWidth:320}}>
                    {/* Vertical gridlines + x-axis price ticks (drawn first, behind the data) */}
                    {ticks.map((t, ti) => (
                        <g key={ti}>
                            <line x1={xFor(t)} y1={topPad - 12} x2={xFor(t)} y2={axisY} stroke="#f1f1f4" strokeWidth={1} />
                            <line x1={xFor(t)} y1={axisY} x2={xFor(t)} y2={axisY + 4} stroke="#bbb" strokeWidth={1} />
                            <text x={xFor(t)} y={tickLabelY} textAnchor="middle" fontSize={9} fill="#888">₹{t}</text>
                        </g>
                    ))}

                    {data.map((d, i) => {
                        const y = i * rowH + topPad;
                        const profit = d.avg_sp - d.avg_cp;
                        const profitPct = d.avg_cp > 0 ? (profit / d.avg_cp) * 100 : null;
                        // Label sits past whichever bar (SP or CP) actually extends furthest —
                        // previously this only looked at avg_sp, so a higher cost price would
                        // draw a longer CP bar that ran straight through the label text.
                        const labelX = `calc(${xFor(Math.max(d.avg_sp, d.avg_cp))} + 12px)`;
                        const isHov = hovered === i;
                        return (
                            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                               style={{cursor:"pointer"}}>
                                {/* Row bg on hover */}
                                {isHov && <rect x={0} y={y - 16} width="100%" height={rowH - 4} rx={6} fill="#f0f4ff" />}
                                {/* Label */}
                                <text x={leftW - 6} y={y + 4} textAnchor="end" fontSize={11} fill={isHov ? "#1a1a2e" : "#555"} fontWeight={isHov ? 600 : 400}>{d.type}</text>
                                {/* Track line */}
                                <line x1={leftW} y1={y} x2={`calc(100% - ${rightW}px)`} y2={y} stroke="#e8e8e8" strokeWidth={1} />
                                {/* CP bar — thin neutral */}
                                <rect x={leftW} y={y - 4} width={`${(d.avg_cp / maxVal) * barTrackPct}%`} height={8} rx={4} fill="#cbd5e1" opacity={0.8} />
                                {/* SP bar — thicker accent */}
                                <rect x={leftW} y={y - 7} width={`${(d.avg_sp / maxVal) * barTrackPct}%`} height={14} rx={4} fill={isHov ? "#1d4ed8" : "#3b82f6"} opacity={0.9}
                                    style={{transition:"fill 0.2s"}} />
                                {/* CP dot */}
                                <circle cx={xFor(d.avg_cp)} cy={y} r={isHov ? 6 : 5} fill="#94a3b8" stroke="white" strokeWidth={1.5}
                                    style={{transition:"r 0.2s"}} />
                                {/* SP dot */}
                                <circle cx={xFor(d.avg_sp)} cy={y} r={isHov ? 7 : 6} fill={isHov ? "#1d4ed8" : "#3b82f6"} stroke="white" strokeWidth={2}
                                    style={{transition:"r 0.2s, fill 0.2s"}} />
                                {/* Profit badge */}
                                <text x={labelX} y={y - 5} fontSize={10} fill={profitPct === null || profitPct >= 0 ? "#10b981" : "#ef4444"} fontWeight={700}>
                                    {formatSignedPct(profitPct)}
                                </text>
                                <text x={labelX} y={y + 9} fontSize={10} fill="#555">
                                    {profit >= 0 ? `₹${profit.toFixed(0)}` : `-₹${Math.abs(profit).toFixed(0)}`} margin
                                </text>
                            </g>
                        );
                    })}
                    {/* X axis baseline */}
                    <line x1={leftW} y1={axisY} x2={`calc(100% - ${rightW}px)`} y2={axisY} stroke="#d8d8df" strokeWidth={1} />
                    {/* Legend */}
                    <circle cx={leftW + 8} cy={legendY} r={4} fill="#3b82f6" />
                    <text x={leftW + 16} y={legendY + 4} fontSize={10} fill="#555">Sell Price</text>
                    <circle cx={leftW + 80} cy={legendY} r={4} fill="#94a3b8" />
                    <text x={leftW + 88} y={legendY + 4} fontSize={10} fill="#555">Cost Price</text>
                </svg>
                {/* Hover tooltip */}
                {hovered !== null && data[hovered] && (
                    <div style={{
                        position:"absolute", top:hovered * rowH + topPad - 16, left:"62%",
                        background:"#1a1a2e", color:"white", padding:"8px 12px", borderRadius:8,
                        fontSize:12, lineHeight:1.6, pointerEvents:"none", zIndex:10,
                        boxShadow:"0 4px 16px rgba(0,0,0,0.25)",
                        animation:"fadeIn 0.15s ease"
                    }}>
                        <div style={{fontWeight:700, marginBottom:4}}>{data[hovered].type}</div>
                        <div style={{color:"#93c5fd"}}>Sell: <strong>₹{data[hovered].avg_sp.toFixed(2)}</strong></div>
                        <div style={{color:"#cbd5e1"}}>Cost: <strong>₹{data[hovered].avg_cp.toFixed(2)}</strong></div>
                        <div style={{color:"#6ee7b7", marginTop:2}}>
                            Margin: ₹{(data[hovered].avg_sp - data[hovered].avg_cp).toFixed(2)}
                            {" "}({formatSignedPct(data[hovered].avg_cp > 0 ? ((data[hovered].avg_sp - data[hovered].avg_cp) / data[hovered].avg_cp) * 100 : null)})
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Exploding Donut Chart — Stock Distribution
   ═══════════════════════════════════════════════════════════════ */
function ExplodingDonut({ data }) {
    const [activeIdx, setActiveIdx] = useState(null);
    if (!data.length) return (
        <div className="dash-card" style={{flex:1}}>
            <h3 className="dash-card-title"><Package size={16} /> Stock Distribution</h3>
            <div style={{padding:40, color:"#999", textAlign:"center", fontSize:13}}>No stock data</div>
        </div>
    );
    const total = data.reduce((s, d) => s + d.value, 0);
    const cx = 130, cy = 130, R = 100, r = 55, EXPLODE = 6;
    const LABEL_MIN_PCT = 4;

    // Compute arcs
    let startAngle = -Math.PI / 2;
    const slices = data.map((d, i) => {
        const pct = (d.value / total) * 100;
        const angle = (d.value / total) * 2 * Math.PI;
        const mid = startAngle + angle / 2;
        const s = { ...d, i, pct, startAngle, endAngle: startAngle + angle, mid };
        startAngle += angle;
        return s;
    });

    const arcPath = (sl, explode) => {
        const ex = explode ? Math.cos(sl.mid) * EXPLODE : 0;
        const ey = explode ? Math.sin(sl.mid) * EXPLODE : 0;
        const x1 = cx + ex + R * Math.cos(sl.startAngle);
        const y1 = cy + ey + R * Math.sin(sl.startAngle);
        const x2 = cx + ex + R * Math.cos(sl.endAngle);
        const y2 = cy + ey + R * Math.sin(sl.endAngle);
        const x3 = cx + ex + r * Math.cos(sl.endAngle);
        const y3 = cy + ey + r * Math.sin(sl.endAngle);
        const x4 = cx + ex + r * Math.cos(sl.startAngle);
        const y4 = cy + ey + r * Math.sin(sl.startAngle);
        const large = sl.endAngle - sl.startAngle > Math.PI ? 1 : 0;
        return `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z`;
    };

    const labelPos = (sl) => {
        const midR = (R + r) / 2 + (sl.pct > 8 ? 2 : 0);
        return { x: cx + midR * Math.cos(sl.mid), y: cy + midR * Math.sin(sl.mid) };
    };

    return (
        <div className="dash-card" style={{flex:1}}>
            <h3 className="dash-card-title" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <span><Package size={16} /> Stock Distribution</span>
                <span style={{fontSize:12, fontWeight:600, color:"#555"}}>
                    {total.toLocaleString(undefined, {maximumFractionDigits:0})} kgs total
                </span>
            </h3>
            <div style={{position:"relative", display:"flex", justifyContent:"center"}}>
                <svg width={260} height={260} style={{overflow:"visible"}} onMouseLeave={() => setActiveIdx(null)}>
                    {slices.map((sl, i) => {
                        const active = activeIdx === i;
                        const color = PIE_COLORS[i % PIE_COLORS.length];
                        const lp = labelPos(sl);
                        const showLabel = sl.pct >= LABEL_MIN_PCT;
                        return (
                            <g key={i} style={{cursor:"pointer"}}
                               onMouseEnter={() => setActiveIdx(i)}>
                                <path
                                    d={arcPath(sl, active)}
                                    pointerEvents="visiblePainted"
                                    fill={color}
                                    opacity={activeIdx !== null && !active ? 0.65 : 1}
                                    stroke="white" strokeWidth={active ? 2 : 1.5}
                                    style={{transition:"d 0.22s cubic-bezier(.4,0,.2,1), opacity 0.2s"}}
                                />
                                {showLabel && !active && (
                                    <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
                                          fontSize={10} fontWeight={600} fill="white" pointerEvents="none"
                                          style={{textShadow:"0 1px 2px rgba(0,0,0,0.5)"}}>
                                        {sl.type.length > 6 ? sl.type.slice(0,5) + "…" : sl.type}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                    {/* Centre text */}
                    <text x={cx} y={cy - 8} textAnchor="middle" fontSize={11} fill="#666">Stock</text>
                    <text x={cx} y={cy + 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1a1a2e">
                        {slices.length} types
                    </text>
                </svg>
                {/* Hover tooltip */}
                {activeIdx !== null && slices[activeIdx] && (
                    <div style={{
                        position:"absolute", top:"50%", left:Math.cos(slices[activeIdx].mid) > 0?"78%":"-4%",
                        transform:Math.cos(slices[activeIdx].mid) > 0?"translateY(-50%)":"translate(-36%,-50%)",
                        background:"#1a1a2e", color:"white", padding:"10px 14px",
                        borderRadius:10, fontSize:12, lineHeight:1.7,
                        boxShadow:"0 6px 20px rgba(0,0,0,0.3)", minWidth:160,
                        animation:"fadeIn 0.15s ease", pointerEvents:"none", zIndex:10,
                        borderLeft:`4px solid ${PIE_COLORS[activeIdx % PIE_COLORS.length]}`
                    }}>
                        <div style={{fontWeight:700, fontSize:13, marginBottom:4}}>
                            {slices[activeIdx].type}
                        </div>
                        <div style={{color:"#93c5fd"}}>
                            {slices[activeIdx].value.toLocaleString(undefined, {maximumFractionDigits:1})} kgs
                        </div>
                        <div style={{color:"#6ee7b7"}}>
                            {slices[activeIdx].pct.toFixed(1)}% of total
                        </div>
                        <div style={{color:"#cbd5e1", marginTop:4, fontSize:11}}>
                            Total: {total.toLocaleString(undefined, {maximumFractionDigits:0})} kgs
                        </div>
                    </div>
                )}
            </div>
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
                        <h3 className="dash-card-title"><Activity size={16} /> Revenue &amp; Expense (Last 30 Days)</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart data={dash?.revenue_chart || []}>
                                <defs>
                                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                                <Tooltip formatter={(v, n) => [`₹${Number(v).toLocaleString()}`, n === "revenue" ? "Revenue" : "Expense"]} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={false} name="Revenue" />
                                <Area type="monotone" dataKey="expense" stroke="#f59e0b" fill="url(#expGrad)" strokeWidth={2} dot={false} name="Expense" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="dash-card">
                        <h3 className="dash-card-title" style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                            <span><TrendingUp size={16} /> Profit &amp; Loss (Last 60 Days)</span>
                            {dash?.revenue_chart && (() => {
                                const net = dash.revenue_chart.reduce((s, d) => s + d.profit, 0);
                                return (
                                    <span style={{fontSize:13, fontWeight:700, color: net >= 0 ? "#10b981" : "#ef4444"}}>
                                        Net: ₹{Math.abs(net).toLocaleString(undefined, {maximumFractionDigits:0})}
                                        {net >= 0 ? " ▲" : " ▼"}
                                    </span>
                                );
                            })()}
                        </h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={dash?.revenue_chart || []} barCategoryGap="0%" barGap={0}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={v => `₹${(Math.abs(v)/1000).toFixed(0)}k`}
                                    axisLine={false} tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                                    formatter={(v) => [`₹${Number(Math.abs(v)).toLocaleString()}`, v >= 0 ? "Profit" : "Loss"]}
                                    contentStyle={{ fontSize: 12 }}
                                />
                                <ReferenceLine y={0} stroke="#888" strokeWidth={1.5} />
                                <Bar dataKey="profit" radius={[1,1,0,0]} isAnimationActive={false}>
                                    {(dash?.revenue_chart || []).map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={entry.profit >= 0 ? "#10b981" : "#ef4444"}
                                            opacity={0.85}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── Price Chart ── */}
                        {/* Dumbbell Chart: Avg SP vs Avg CP */}
                        <DumbbellChart data={dash?.price_chart || []} />

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
                    
                        {/* Interactive Donut: Stock Distribution */}
                        <ExplodingDonut data={dash?.stock_pie || []} />
                </div>
            </div>

            {/* ── Bottom Section — Trending + Low Stock + Tables ── */}
            <div className="dash-bottom-grid">
                <div className="dash-card">
                    <h3 className="dash-card-title"><TrendingUp size={16} /> Trending Products (Last 30 Days)</h3>
                    <table className="dash-table">
                        <thead><tr><th>Product</th><th>Sold (kgs)</th><th>Stock (kgs)</th><th>Trend</th></tr></thead>
                        <tbody>
                            {(dash?.trending_products || trendingProducts).map((p, i) => (
                                <tr key={i}>
                                    <td>{p.name}</td>
                                    <td>{Number(p.sold).toFixed(1)}</td>
                                    <td>{Number(p.stock).toFixed(1)}</td>
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
