import { useState, useEffect, useMemo } from "react";
import { signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { auth, db } from "../firebase";
import logo from "../assets/logo.png";
import ReportDetail from "./ReportDetail";
import AdminSettings from "./AdminSettings";
import WeeklyReport from "./WeeklyReport";
import MonthlyReport from "./MonthlyReport";
import CalendarReport from "./CalendarReport";
import useIdleLogout from "./useIdleLogout";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtShort = (v) => `$${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Compact version (no year) just for chart axis ticks, to avoid crowding
const axisDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const RANGE_OPTIONS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "Last 180 Days", days: 180 },
  { label: "Last 1 Year", days: 365 },
  { label: "All Time", days: null },
  { label: "Custom", days: "custom" },
];

export default function AdminDashboard({ user }) {
  useIdleLogout(5 * 60 * 1000); // 5 minutes
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeIdx, setRangeIdx] = useState(1);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const snap = await getDocs(collection(db, "restaurants"));
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (a.date < b.date ? 1 : -1));
        setReports(docs);
      } catch (err) {
        console.error(err);
        setError("Failed to load reports. Check your Firestore rules and connection.");
      }
      setLoading(false);
    };
    load();
  }, []);

  const filteredByRange = useMemo(() => {
    const days = RANGE_OPTIONS[rangeIdx].days;
    if (days === "custom") {
      if (!customStart || !customEnd) return [];
      return reports.filter((r) => r.date >= customStart && r.date <= customEnd);
    }
    if (!days) return reports;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return reports.filter((r) => r.date >= cutoffStr);
  }, [reports, rangeIdx, customStart, customEnd]);

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return filteredByRange;
    const q = search.trim().toLowerCase();
    return filteredByRange.filter((r) =>
      (r.date || "").includes(q) ||
      shortDate(r.date).toLowerCase().includes(q) ||
      (r.cateringNotes || []).some((c) => (c.name || "").toLowerCase().includes(q))
    );
  }, [filteredByRange, search]);

  const summary = useMemo(() => {
    const list = filteredByRange;
    const totalSales = list.reduce((s, r) => s + (Number(r.totalSalesDay) || 0), 0);
    const totalGuests = list.reduce((s, r) => s + (Number(r.lunchGuests) || 0) + (Number(r.dinnerGuests) || 0), 0);
    const totalCatering = list.reduce((s, r) => s + (Number(r.totalCatering) || 0), 0);
    const totalOnline = list.reduce((s, r) => s + (Number(r.totalRestaurantOnline) || 0), 0);
    const avgDaily = list.length ? totalSales / list.length : 0;
    return { totalSales, totalGuests, totalCatering, totalOnline, avgDaily, count: list.length };
  }, [filteredByRange]);

  const chartData = useMemo(() => {
    return [...filteredByRange]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((r) => ({
        date: axisDate(r.date),
        fullDate: r.date,
        total: Number(r.totalSalesDay) || 0,
        inHouse: Number(r.totalInHouse) || 0,
        online: Number(r.totalRestaurantOnline) || 0,
        catering: Number(r.totalCatering) || 0,
      }));
  }, [filteredByRange]);

  const handleLogout = () => signOut(auth);

  return (
    <div className="ad-wrapper">
      <div className="ad-topbar">
        <div className="ad-topbar-left">
          {logo && <img src={logo} alt="logo" className="ad-topbar-logo" />}
          <div>
            <div className="ad-topbar-title">Restaurant Sales</div>
            <div className="ad-topbar-sub">Admin Dashboard</div>
          </div>
        </div>
        <div className="ad-topbar-right">
          <span className="ad-user-email">{user?.email}</span>
          <button className="ad-settings-btn" onClick={() => setSettingsOpen(true)} title="Account Settings">⚙️</button>
          <button className="ad-logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      <div className="ad-content">
        <div className="ad-panel ad-overview-panel">
          <div className="ad-range-row">
            {RANGE_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                className={`ad-range-btn${i === rangeIdx ? " active" : ""}`}
                onClick={() => setRangeIdx(i)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {RANGE_OPTIONS[rangeIdx].days === "custom" && (
            <div className="ad-range-picker-row" style={{ marginBottom: "1.25rem" }}>
              <input type="date" className="ad-load-input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="ad-range-to">to</span>
              <input type="date" className="ad-load-input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}

          {error && <div className="ad-error-banner">⚠️ {error}</div>}

          <div className="ad-summary-grid">
            <div className="ad-summary-card primary">
              <div className="ad-summary-label">Total Sales</div>
              <div className="ad-summary-value">{fmt(summary.totalSales)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Avg Daily Sales</div>
              <div className="ad-summary-value">{fmt(summary.avgDaily)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Guests</div>
              <div className="ad-summary-value">{summary.totalGuests.toLocaleString()}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Online Sales</div>
              <div className="ad-summary-value">{fmt(summary.totalOnline)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Catering</div>
              <div className="ad-summary-value">{fmt(summary.totalCatering)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Reports</div>
              <div className="ad-summary-value">{summary.count}</div>
            </div>
          </div>

          {loading ? (
            <div className="ad-loading-block">Loading reports…</div>
          ) : (
            <>
              {chartData.length > 0 && (
                <div className="ad-overview-section">
                  <div className="ad-panel-title">Total Sales Over Time</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5d5b8" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8C3700" }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#8C3700" }} width={60} />
                      <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l, p) => p?.[0]?.payload?.fullDate ? shortDate(p[0].payload.fullDate) : l} />
                      <Line type="monotone" dataKey="total" stroke="#C45200" strokeWidth={2.5} dot={{ r: 3 }} name="Total Sales" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {chartData.length > 0 && (
                <div className="ad-overview-section">
                  <div className="ad-panel-title">Sales Channel Breakdown</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5d5b8" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8C3700" }} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#8C3700" }} width={60} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="inHouse" stackId="a" fill="#8C3700" name="In-House" />
                      <Bar dataKey="online" stackId="a" fill="#C45200" name="Online" />
                      <Bar dataKey="catering" stackId="a" fill="#ffc864" name="Catering" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && (
          <>
            <div className="ad-carousel">
              {activeSlide === 0 && <WeeklyReport reports={reports} />}
              {activeSlide === 1 && <MonthlyReport reports={reports} />}
              {activeSlide === 2 && <CalendarReport reports={reports} onSelectReport={setSelected} />}
              <div className="ad-carousel-dots">
                {["Weekly", "Monthly", "Calendar"].map((label, i) => (
                  <button
                    key={label}
                    className={`ad-carousel-dot${i === activeSlide ? " active" : ""}`}
                    onClick={() => setActiveSlide(i)}
                    aria-label={label}
                    title={label}
                  />
                ))}
              </div>
            </div>

            <div className="ad-panel">
              <div className="ad-panel-title-row">
                <div className="ad-panel-title">Reports</div>
                <input
                  className="ad-search-input"
                  placeholder="Search by date…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filteredBySearch.length === 0 ? (
                <div className="ad-empty-state">No reports found for this range.</div>
              ) : (
                <div className="ad-table">
                  <div className="ad-table-header">
                    <span>Date</span>
                    <span>Guests</span>
                    <span>Total Sales</span>
                    <span></span>
                  </div>
                  {filteredBySearch.map((r) => (
                    <div key={r.id} className="ad-table-row" onClick={() => setSelected(r)}>
                      <span>{shortDate(r.date)}</span>
                      <span>{(Number(r.lunchGuests) || 0) + (Number(r.dinnerGuests) || 0)}</span>
                      <span className="ad-table-total">{fmt(r.totalSalesDay)}</span>
                      <span className="ad-table-arrow">›</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ReportDetail report={selected} onClose={() => setSelected(null)} />
      {settingsOpen && <AdminSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}