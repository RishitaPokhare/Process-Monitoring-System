import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownUp, CheckCircle2, CircleHelp, Cpu,
  HardDrive, LayoutDashboard, MemoryStick, Monitor, RefreshCw, Search,
  Server, ShieldAlert, SquareActivity, Terminal, TimerReset, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { getHistory, getOverview, getProcesses, getSystemInfo, terminateProcess } from "./api";

function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m`;
}
function shortNumber(n) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n ?? 0);
}
function Gauge({ value = 0, color = "blue" }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className={`gauge gauge-${color}`}><div className="gauge-track"><div className="gauge-fill" style={{ width: `${safe}%` }} /></div><span>{safe.toFixed(1)}%</span></div>;
}
function MetricCard({ title, value, unit, icon: Icon, color, subtitle, progress }) {
  return (
    <section className="metric-card">
      <div className="metric-top"><span className={`metric-icon ${color}`}><Icon size={19} /></span><span className="metric-label">{title}</span><span className="live-dot" title="Live data" /></div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      {progress !== undefined ? <Gauge value={progress} color={color} /> : <div className="metric-subtitle">{subtitle}</div>}
      {progress !== undefined && <div className="metric-subtitle">{subtitle}</div>}
    </section>
  );
}
function PanelTitle({ icon: Icon, title, note, action }) {
  return <div className="panel-title"><div className="panel-heading"><span className="panel-icon"><Icon size={17} /></span><div><h2>{title}</h2>{note && <p>{note}</p>}</div></div>{action}</div>;
}

export default function App() {
  const [overview, setOverview] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [history, setHistory] = useState([]);
  const [system, setSystem] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("cpu_percent");
  const [order, setOrder] = useState("desc");
  const [selected, setSelected] = useState(null);
  const [activePage, setActivePage] = useState("Overview");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async (showBusy = false) => {
    if (showBusy) setBusy(true);
    try {
      const [overviewData, processData, historyData, systemData] = await Promise.all([
        getOverview(), getProcesses(search, sortBy, order), getHistory(), getSystemInfo()
      ]);
      setOverview(overviewData);
      setProcesses(processData.processes || []);
      setHistory(historyData || []);
      setSystem(systemData);
      setLastUpdated(new Date());
      setNotice(null);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      if (showBusy) setBusy(false);
    }
  }, [search, sortBy, order]);

  useEffect(() => {
    loadData(true);
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => loadData(false), 3000);
    return () => window.clearInterval(id);
  }, [loadData, autoRefresh]);

  const cpuHot = (overview?.cpu_percent || 0) >= 80;
  const ramHot = (overview?.memory_percent || 0) >= 85;
  const processCount = overview?.process_count ?? processes.length;
  const selectedProcess = useMemo(
    () => selected ? (processes.find(p => p.pid === selected.pid) || selected) : null,
    [selected, processes]
  );

  const handleSort = (field) => {
    if (sortBy === field) setOrder(order === "asc" ? "desc" : "asc");
    else { setSortBy(field); setOrder(field === "name" ? "asc" : "desc"); }
  };

  const handleTerminate = async (proc) => {
    const accepted = window.confirm(`Terminate "${proc.name}" (PID ${proc.pid})?\n\nUnsaved work in this process may be lost. Do not terminate Windows system processes.`);
    if (!accepted) return;
    try {
      const result = await terminateProcess(proc.pid);
      setNotice({ type: "success", message: result.message });
      if (selected?.pid === proc.pid) setSelected(null);
      await loadData(false);
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    }
  };

  const navItems = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Processes", icon: Terminal },
    { name: "System info", icon: Monitor },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Activity size={22} /></div><div><strong>Process<span>Monitor</span></strong><small>OS MANAGEMENT SUITE</small></div></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>{navItems.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${activePage === name ? "active" : ""}`} onClick={() => setActivePage(name)}><Icon size={18} /><span>{name}</span>{name === "Processes" && <em>{processCount}</em>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="connection-status"><span className="status-indicator" /><div><b>Local system</b><small>{overview?.system || "Waiting for backend"}</small></div></div>
          <div className="sidebar-foot"><ShieldAlert size={14} /> Educational project · v1.0</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="top-actions"><span className={`monitoring-pill ${autoRefresh ? "" : "paused"}`}><span />{autoRefresh ? "Monitoring live" : "Monitoring paused"}</span><button className="icon-button" title="Refresh now" onClick={() => loadData(true)} disabled={busy}><RefreshCw size={17} className={busy ? "spin" : ""} /></button><div className="avatar">PM</div></div>
        </header>

        <div className="page-content">
          <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> SYSTEM OVERVIEW</div><h1>{activePage === "Overview" ? "System Dashboard" : activePage}</h1><p>{activePage === "Overview" ? "Monitor system health and resource utilization in real time." : activePage === "Processes" ? "Inspect active processes and manage resource usage." : "Hardware and operating system details for this machine."}</p></div><div className="intro-actions"><span className="updated-label">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Connecting…"}</span><button className="primary-button" onClick={() => loadData(true)} disabled={busy}><RefreshCw size={15} className={busy ? "spin" : ""} /> Refresh data</button></div></div>

          {notice && <div className={`notice ${notice.type}`}><span>{notice.type === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}</span><p>{notice.message}</p><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}

          {!overview && !notice && <div className="loading-banner"><RefreshCw size={18} className="spin" /> Connecting to the local monitoring service…</div>}

          {activePage === "Overview" && <>
            <div className="metrics-grid">
              <MetricCard title="CPU UTILIZATION" value={shortNumber(overview?.cpu_percent)} unit="%" icon={Cpu} color="blue" subtitle={cpuHot ? "High usage detected" : `${overview?.logical_cpus ?? "—"} logical processors`} progress={overview?.cpu_percent || 0} />
              <MetricCard title="MEMORY USAGE" value={shortNumber(overview?.memory_used_gb)} unit=" GB" icon={MemoryStick} color="purple" subtitle={`${shortNumber(overview?.memory_available_gb)} GB available`} progress={overview?.memory_percent || 0} />
              <MetricCard title="ACTIVE PROCESSES" value={shortNumber(processCount)} unit="" icon={SquareActivity} color="green" subtitle="Processes detected by the OS" />
              <MetricCard title="DISK UTILIZATION" value={shortNumber(overview?.disk_percent)} unit="%" icon={HardDrive} color="orange" subtitle={`${shortNumber(overview?.disk_used_gb)} GB used of ${shortNumber(overview?.disk_total_gb)} GB`} progress={overview?.disk_percent || 0} />
            </div>

            <div className="charts-grid">
              <section className="panel chart-panel"><PanelTitle icon={Activity} title="CPU utilization" note="Recent samples · percentage" action={<span className="chart-current blue-text">{shortNumber(overview?.cpu_percent)}%</span>} /><div className="chart-wrap">{history.length < 2 ? <div className="chart-empty">Collecting samples for the live chart…</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}><defs><linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5895ff" stopOpacity={0.25} /><stop offset="95%" stopColor="#5895ff" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#253044" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: "#8190a8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={30} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#8190a8", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#121c2d", border: "1px solid #29364d", borderRadius: 9, color: "#eef3fc" }} labelStyle={{ color: "#9ba9be" }} formatter={(v) => [`${v}%`, "CPU"]} /><Area type="monotone" dataKey="cpu_percent" stroke="#5895ff" strokeWidth={2.2} fill="url(#cpuGradient)" activeDot={{ r: 4 }} /></AreaChart></ResponsiveContainer>}</div><div className="chart-footer"><span><i className="legend-dot cpu-dot" />CPU usage</span><span>Auto-sampled every 3 seconds</span></div></section>
              <section className="panel chart-panel"><PanelTitle icon={MemoryStick} title="Memory utilization" note={`${shortNumber(overview?.memory_used_gb)} GB of ${shortNumber(overview?.memory_total_gb)} GB RAM`} action={<span className="chart-current purple-text">{shortNumber(overview?.memory_percent)}%</span>} /><div className="chart-wrap">{history.length < 2 ? <div className="chart-empty">Collecting samples for the live chart…</div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}><CartesianGrid stroke="#253044" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: "#8190a8", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={30} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#8190a8", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#121c2d", border: "1px solid #29364d", borderRadius: 9, color: "#eef3fc" }} labelStyle={{ color: "#9ba9be" }} formatter={(v) => [`${v}%`, "Memory"]} /><Line type="monotone" dataKey="memory_percent" stroke="#a78bfa" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer>}</div><div className="chart-footer"><span><i className="legend-dot ram-dot" />RAM usage</span><span>{shortNumber(overview?.memory_available_gb)} GB available</span></div></section>
            </div>

            <section className="panel process-panel"><PanelTitle icon={Server} title="Top resource-consuming processes" note="Ranked by CPU usage" action={<button className="text-button" onClick={() => setActivePage("Processes")}>View all processes <span>→</span></button>} />{renderProcessTable(processes.slice(0, 6), handleSort, sortBy, order, setSelected, handleTerminate, true)}</section>
          </>}

          {activePage === "Processes" && <section className="panel process-panel full-process-panel"><PanelTitle icon={Terminal} title="Process manager" note={`${processes.length} processes match your search`} action={<button className={`toggle-button ${autoRefresh ? "enabled" : ""}`} onClick={() => setAutoRefresh(v => !v)}><span />{autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}</button>} /><div className="table-toolbar"><div className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by process name, PID, or user…" /><kbd>LIVE</kbd></div><div className="table-hint"><ArrowDownUp size={14} /> Select a column heading to sort</div></div>{renderProcessTable(processes, handleSort, sortBy, order, setSelected, handleTerminate, false)}</section>}

          {activePage === "System info" && <div className="system-grid"><section className="panel system-panel"><PanelTitle icon={Monitor} title="Operating system" note="Detected runtime environment" /><div className="system-hero"><div className="system-hero-icon"><Monitor size={28} /></div><div><h3>{system?.system || "—"} {system?.release || ""}</h3><p>{system?.platform || "Waiting for system data"}</p></div></div><InfoRow label="Machine architecture" value={system?.machine} /><InfoRow label="Processor" value={system?.processor} /><InfoRow label="Python version" value={system?.python_version} /><InfoRow label="System boot time" value={system?.boot_time ? new Date(system.boot_time).toLocaleString() : "—"} /></section><section className="panel system-panel"><PanelTitle icon={Cpu} title="Hardware resources" note="Available system capacity" /><InfoRow label="Logical processors" value={system?.logical_cpus} /><InfoRow label="Physical processors" value={system?.physical_cpus} /><InfoRow label="Installed RAM" value={system ? `${system.total_ram_gb} GB` : "—"} /><InfoRow label="System uptime" value={formatUptime(overview?.uptime_seconds)} /><div className="system-note"><CircleHelp size={17} /><p>Hardware values are read from the local machine through the Python <code>psutil</code> library.</p></div></section></div>}

          <footer className="page-footer"><span>© 2026 Process Monitor · Operating Systems Mini Project</span><span><span className="footer-dot" />Local API · {overview ? "Connected" : "Waiting for API"}</span></footer>
        </div>
      </main>

      {selectedProcess && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="detail-drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">PROCESS DETAILS</span><h2>{selectedProcess.name}</h2><p>Process ID {selectedProcess.pid}</p></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close details"><X size={18} /></button></div><div className="drawer-status"><span className="status-indicator" />{selectedProcess.status || "Unknown status"}</div><div className="detail-metrics"><div><span>CPU usage</span><strong>{shortNumber(selectedProcess.cpu_percent)}%</strong><Gauge value={Math.min(selectedProcess.cpu_percent, 100)} color="blue" /></div><div><span>Memory used</span><strong>{shortNumber(selectedProcess.memory_mb)} MB</strong><Gauge value={selectedProcess.memory_percent} color="purple" /></div></div><div className="detail-list"><InfoRow label="PID" value={selectedProcess.pid} /><InfoRow label="Username" value={selectedProcess.username} /><InfoRow label="Status" value={selectedProcess.status} /><InfoRow label="Started at" value={selectedProcess.created_at ? new Date(selectedProcess.created_at).toLocaleString() : "—"} /></div><div className="drawer-warning"><AlertTriangle size={17} /><p>Ending a process can close applications and discard unsaved work. Avoid system-critical processes.</p></div><button className="danger-button" onClick={() => handleTerminate(selectedProcess)}><X size={16} /> Terminate process</button></aside></div>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return <div className="info-row"><span>{label}</span><strong>{value === undefined || value === null || value === "" ? "—" : String(value)}</strong></div>;
}

function renderProcessTable(items, onSort, sortBy, order, setSelected, onTerminate, compact) {
  const headings = [
    ["name", "PROCESS"], ["pid", "PID"], ["cpu_percent", "CPU"], ["memory_mb", "MEMORY"], ["status", "STATUS"]
  ];
  return <div className="table-scroll"><table className="process-table"><thead><tr>{headings.map(([key, label]) => <th key={key}><button onClick={() => onSort(key)}>{label}{sortBy === key && <span className="sort-indicator">{order === "asc" ? "↑" : "↓"}</span>}</button></th>)}<th><span className="action-heading">ACTIONS</span></th></tr></thead><tbody>{items.length === 0 ? <tr><td colSpan="6" className="empty-row">No processes found. Try a different search.</td></tr> : items.map((p) => <tr key={`${p.pid}-${p.name}`}><td><button className="process-name-cell" onClick={() => setSelected(p)}><span className="process-avatar"><Terminal size={14} /></span><span><b>{p.name}</b><small>{p.username || "Unknown user"}</small></span></button></td><td className="mono">{p.pid}</td><td><div className="table-usage"><span className={(p.cpu_percent || 0) >= 50 ? "usage-high" : ""}>{shortNumber(p.cpu_percent)}%</span><div className="mini-bar"><span className={(p.cpu_percent || 0) >= 50 ? "high" : ""} style={{ width: `${Math.min(p.cpu_percent || 0, 100)}%` }} /></div></div></td><td><div className="memory-cell"><b>{shortNumber(p.memory_mb)} MB</b><small>{shortNumber(p.memory_percent)}% RAM</small></div></td><td><span className={`status-badge ${p.status === "running" ? "running" : ""}`}><i />{p.status || "unknown"}</span></td><td><div className="row-actions"><button title="View details" onClick={() => setSelected(p)}><CircleHelp size={15} /></button><button title="Terminate process" className="terminate-small" onClick={() => onTerminate(p)}><X size={15} /></button></div></td></tr>)}</tbody></table>{compact && <div className="table-bottom"><span>Showing {items.length} of the highest CPU processes</span><span>Refresh interval: 3 seconds</span></div>}</div>;
}
