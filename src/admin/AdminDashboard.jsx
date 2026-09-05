import { useState, useEffect, useMemo } from "react";
import { signOut } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

import { auth, db } from "../firebase";
import logo from "../assets/logo.png";
import ReportDetail from "./ReportDetail";
import AdminSettings from "./AdminSettings";
import WeeklyReport from "./WeeklyReport";
import MonthlyReport from "./MonthlyReport";
import CalendarReport from "./CalendarReport";
import YearOverYearReport from "./YearOverYearReport";
import TaxSelectModal from "./TaxSelectModal";
import TaxGeneralDashboard from "./TaxGeneralDashboard";
import TaxAuditDashboard from "./TaxAuditDashboard";
import useIdleLogout from "./useIdleLogout";

const fmt = (v) =>
  `$${Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  })}`;

const fmtShort = (v) =>
  `$${Number(v || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;

const axisDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);

  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const ordinalSuffix = (n) => {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

// e.g. "Jul 31st, 2026, Friday"
const fullDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${month} ${d}${ordinalSuffix(d)}, ${y}, ${weekday}`;
};

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Monday of the real calendar week containing today - matches the same
// convention used elsewhere in the app (WeeklyReport.jsx, YearOverYearReport.jsx).
const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const reportTips = (r) =>
  (Number(r.cashTip) || 0) +
  (Number(r.creditCardTip) || 0) +
  (Number(r.restaurantOnlineTips) || 0);

const reportTotalIncTip = (r) => (Number(r.totalSalesDay) || 0) + reportTips(r);

const RANGE_OPTIONS = [
  { key: "day", label: "Day" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "quarter", label: "3 Months" },
  { key: "thisYear", label: "This Year" },
  { key: "lastYear", label: "Last Year" },
  { key: "allTime", label: "All Time" },
  { key: "custom", label: "Custom" },
];

export default function AdminDashboard({ user }) {
  useIdleLogout(5 * 60 * 1000);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // "Week" selected by default
  const [rangeIdx, setRangeIdx] = useState(2);

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Weekly Report selected by default
  const [activeSlide, setActiveSlide] = useState(0);

  // Tax dashboard state
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxView, setTaxView] = useState(null); // null | "general" | "audit"
  const [compareView, setCompareView] = useState(false);

  // Profile dropdown (email / settings / sign out)
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const snap = await getDocs(collection(db, "restaurants"));

        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        docs.sort((a, b) => (a.date < b.date ? 1 : -1));

        setReports(docs);
      } catch (err) {
        console.error(err);

        setError(
          "Failed to load reports. Check your Firestore rules and connection."
        );
      }

      setLoading(false);
    };

    load();
  }, []);

  const filteredByRange = useMemo(() => {
    const key = RANGE_OPTIONS[rangeIdx].key;

    if (key === "custom") {
      if (!customStart || !customEnd) {
        return [];
      }
      return reports.filter((r) => r.date >= customStart && r.date <= customEnd);
    }

    if (key === "allTime") {
      return reports;
    }

    const today = new Date();

    if (key === "day") {
      const todayStr = toISO(today);
      return reports.filter((r) => r.date === todayStr);
    }

    if (key === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = toISO(y);
      return reports.filter((r) => r.date === yStr);
    }

    if (key === "week") {
      const monday = getMonday(today);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const weekStart = toISO(monday);
      const weekEnd = toISO(sunday);
      return reports.filter((r) => r.date >= weekStart && r.date <= weekEnd);
    }

    if (key === "month") {
      const start = toISO(new Date(today.getFullYear(), today.getMonth(), 1));
      const end = toISO(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      return reports.filter((r) => r.date >= start && r.date <= end);
    }

    if (key === "lastMonth") {
      const start = toISO(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      const end = toISO(new Date(today.getFullYear(), today.getMonth(), 0));
      return reports.filter((r) => r.date >= start && r.date <= end);
    }

    if (key === "quarter") {
      const start = toISO(new Date(today.getFullYear(), today.getMonth() - 2, 1));
      const end = toISO(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      return reports.filter((r) => r.date >= start && r.date <= end);
    }

    if (key === "thisYear") {
      const start = `${today.getFullYear()}-01-01`;
      const end = `${today.getFullYear()}-12-31`;
      return reports.filter((r) => r.date >= start && r.date <= end);
    }

    if (key === "lastYear") {
      const lastYear = today.getFullYear() - 1;
      const start = `${lastYear}-01-01`;
      const end = `${lastYear}-12-31`;
      return reports.filter((r) => r.date >= start && r.date <= end);
    }

    return reports;
  }, [reports, rangeIdx, customStart, customEnd]);

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) {
      return filteredByRange;
    }

    const q = search.trim().toLowerCase();

    return filteredByRange.filter(
      (r) =>
        (r.date || "").includes(q) ||
        fullDateLabel(r.date).toLowerCase().includes(q) ||
        (r.cateringNotes || []).some((c) =>
          (c.name || "").toLowerCase().includes(q)
        )
    );
  }, [filteredByRange, search]);

  const summary = useMemo(() => {
    const list = filteredByRange;

    const totalSales = list.reduce(
      (s, r) => s + reportTotalIncTip(r),
      0
    );

    const totalGuests = list.reduce(
      (s, r) =>
        s +
        (Number(r.lunchGuests) || 0) +
        (Number(r.dinnerGuests) || 0),
      0
    );

    const totalCatering = list.reduce(
      (s, r) => s + (Number(r.totalCatering) || 0),
      0
    );

    const totalOnline = list.reduce(
      (s, r) => s + (Number(r.totalRestaurantOnline) || 0),
      0
    );

    const avgDaily = list.length ? totalSales / list.length : 0;

    return {
      totalSales,
      totalGuests,
      totalCatering,
      totalOnline,
      avgDaily,
      count: list.length,
    };
  }, [filteredByRange]);

  const chartData = useMemo(() => {
    return [...filteredByRange]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((r) => ({
        date: axisDate(r.date),
        fullDate: r.date,
        total: reportTotalIncTip(r),
        inHouse: Number(r.totalInHouse) || 0,
        online: Number(r.totalRestaurantOnline) || 0,
        catering: Number(r.totalCatering) || 0,
      }));
  }, [filteredByRange]);

  const handleLogout = () => signOut(auth);

  const handleTaxSelect = (view) => {
    setTaxView(view);
    setTaxModalOpen(false);
  };

  return (
    <div className="ad-wrapper">
      {/* TOP BAR */}
      <div className="ad-topbar">
        <div className="ad-topbar-left" onClick={() => { setTaxView(null); setCompareView(false); }} style={{ cursor: "pointer" }} title="Back to main dashboard">
          {logo && (
            <img
              src={logo}
              alt="logo"
              className="ad-topbar-logo"
            />
          )}

          <div>
            <div className="ad-topbar-title">
              Restaurant Sales
            </div>

            <div className="ad-topbar-sub">
              Admin Dashboard
            </div>
          </div>
        </div>

        <div className="ad-topbar-right">
          <button
            className="ad-tax-btn"
            onClick={() => { setCompareView(false); setTaxModalOpen(true); }}
            title="Tax Dashboard"
          >
            Tax
          </button>

          <button
            className="ad-tax-btn"
            onClick={() => { setTaxView(null); setCompareView(true); }}
            title="Year-over-Year Comparison"
          >
            Compare
          </button>

          <div className="ad-profile-wrap">
            <button
              className="ad-profile-avatar"
              onClick={() => setProfileOpen((v) => !v)}
              title={user?.email}
            >
              {(user?.email || "?").charAt(0).toUpperCase()}
            </button>

            {profileOpen && (
              <>
                <div className="ad-profile-backdrop" onClick={() => setProfileOpen(false)} />
                <div className="ad-profile-menu">
                  <div className="ad-profile-menu-email">{user?.email}</div>
                  <button
                    className="ad-profile-menu-item"
                    onClick={() => { setSettingsOpen(true); setProfileOpen(false); }}
                  >
                    ⚙️ Account Settings
                  </button>
                  <button
                    className="ad-profile-menu-item danger"
                    onClick={handleLogout}
                  >
                    ⏻ Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="ad-content">
        {compareView ? (
          <YearOverYearReport reports={reports} onBack={() => setCompareView(false)} />
        ) : taxView === "general" ? (
          <TaxGeneralDashboard reports={reports} onBack={() => setTaxView(null)} onSelectReport={setSelected} />
        ) : taxView === "audit" ? (
          <TaxAuditDashboard reports={reports} onBack={() => setTaxView(null)} />
        ) : (
          <>
            {/* OVERVIEW */}
            <div className="ad-panel ad-overview-panel">

              {/* DATE RANGE BUTTONS */}
              <div className="ad-range-row">
                {RANGE_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.key}
                    className={`ad-range-btn${
                      i === rangeIdx ? " active" : ""
                    }`}
                    onClick={() => setRangeIdx(i)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* CUSTOM DATE RANGE */}
              {RANGE_OPTIONS[rangeIdx].key === "custom" && (
                <div
                  className="ad-range-picker-row"
                  style={{ marginBottom: "1.25rem" }}
                >
                  <input
                    type="date"
                    className="ad-load-input"
                    value={customStart}
                    onChange={(e) =>
                      setCustomStart(e.target.value)
                    }
                  />

                  <span className="ad-range-to">
                    to
                  </span>

                  <input
                    type="date"
                    className="ad-load-input"
                    value={customEnd}
                    onChange={(e) =>
                      setCustomEnd(e.target.value)
                    }
                  />
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div className="ad-error-banner">
                  ⚠️ {error}
                </div>
              )}

              {/* SUMMARY CARDS */}
              <div className="ad-summary-grid">
                <div className="ad-summary-card primary">
                  <div className="ad-summary-label">
                    Total Sales
                  </div>

                  <div className="ad-summary-value">
                    {fmt(summary.totalSales)}
                  </div>
                </div>

                <div className="ad-summary-card">
                  <div className="ad-summary-label">
                    Avg Daily Sales
                  </div>

                  <div className="ad-summary-value">
                    {fmt(summary.avgDaily)}
                  </div>
                </div>

                <div className="ad-summary-card">
                  <div className="ad-summary-label">
                    Total Guests
                  </div>

                  <div className="ad-summary-value">
                    {summary.totalGuests.toLocaleString()}
                  </div>
                </div>

                <div className="ad-summary-card">
                  <div className="ad-summary-label">
                    Online Sales
                  </div>

                  <div className="ad-summary-value">
                    {fmt(summary.totalOnline)}
                  </div>
                </div>

                <div className="ad-summary-card">
                  <div className="ad-summary-label">
                    Catering
                  </div>

                  <div className="ad-summary-value">
                    {fmt(summary.totalCatering)}
                  </div>
                </div>

                <div className="ad-summary-card">
                  <div className="ad-summary-label">
                    Reports
                  </div>

                  <div className="ad-summary-value">
                    {summary.count}
                  </div>
                </div>
              </div>

              {/* CHARTS */}
              {loading ? (
                <div className="ad-loading-block">
                  Loading reports…
                </div>
              ) : (
                <>
                  {/* TOTAL SALES CHART */}
                  {chartData.length > 0 && (
                    <div className="ad-overview-section">
                      <div className="ad-panel-title">
                        Total Sales Over Time
                      </div>

                      <ResponsiveContainer
                        width="100%"
                        height={260}
                      >
                        <LineChart
                          data={chartData}
                          margin={{
                            top: 10,
                            right: 20,
                            left: 0,
                            bottom: 0,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f5d5b8"
                          />

                          <XAxis
                            dataKey="date"
                            tick={{
                              fontSize: 11,
                              fill: "#8C3700",
                            }}
                          />

                          <YAxis
                            tickFormatter={fmtShort}
                            tick={{
                              fontSize: 11,
                              fill: "#8C3700",
                            }}
                            width={60}
                          />

                          <Tooltip
                            formatter={(v) => fmt(v)}
                            labelFormatter={(l, p) =>
                              p?.[0]?.payload?.fullDate
                                ? fullDateLabel(
                                    p[0].payload.fullDate
                                  )
                                : l
                            }
                          />

                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="#C45200"
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            name="Total Sales"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* SALES CHANNEL CHART */}
                  {chartData.length > 0 && (
                    <div className="ad-overview-section">
                      <div className="ad-panel-title">
                        Sales Channel Breakdown
                      </div>

                      <ResponsiveContainer
                        width="100%"
                        height={260}
                      >
                        <BarChart
                          data={chartData}
                          margin={{
                            top: 10,
                            right: 20,
                            left: 0,
                            bottom: 0,
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f5d5b8"
                          />

                          <XAxis
                            dataKey="date"
                            tick={{
                              fontSize: 11,
                              fill: "#8C3700",
                            }}
                          />

                          <YAxis
                            tickFormatter={fmtShort}
                            tick={{
                              fontSize: 11,
                              fill: "#8C3700",
                            }}
                            width={60}
                          />

                          <Tooltip
                            formatter={(v) => fmt(v)}
                            labelFormatter={(l, p) =>
                              p?.[0]?.payload?.fullDate
                                ? fullDateLabel(
                                    p[0].payload.fullDate
                                  )
                                : l
                            }
                          />

                          <Legend
                            wrapperStyle={{
                              fontSize: 11,
                            }}
                          />

                          <Bar
                            dataKey="inHouse"
                            stackId="a"
                            fill="#8C3700"
                            name="In-House"
                          />

                          <Bar
                            dataKey="online"
                            stackId="a"
                            fill="#C45200"
                            name="Online"
                          />

                          <Bar
                            dataKey="catering"
                            stackId="a"
                            fill="#ffc864"
                            name="Catering"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>

            {!loading && (
              <>
                {/* REPORTS */}
                <div className="ad-panel">
                  <div className="ad-panel-title-row">
                    <div className="ad-panel-title">
                      Reports
                    </div>

                    <input
                      className="ad-search-input"
                      placeholder="Search by date…"
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                    />
                  </div>

                  {filteredBySearch.length === 0 ? (
                    <div className="ad-empty-state">
                      No reports found for this range.
                    </div>
                  ) : (
                    <div className="ad-table">
                      <div className="ad-table-header">
                        <span>Date</span>
                        <span>Guests</span>
                        <span>Total Sales</span>
                        <span></span>
                      </div>

                      {filteredBySearch.map((r) => (
                        <div
                          key={r.id}
                          className="ad-table-row"
                          onClick={() =>
                            setSelected(r)
                          }
                        >
                          <span>
                            {fullDateLabel(r.date)}
                          </span>

                          <span>
                            {(Number(
                              r.lunchGuests
                            ) || 0) +
                              (Number(
                                r.dinnerGuests
                              ) || 0)}
                          </span>

                          <span className="ad-table-total">
                            {fmt(
                              reportTotalIncTip(r)
                            )}
                          </span>

                          <span className="ad-table-arrow">
                            ›
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WEEKLY / MONTHLY / CUSTOM REPORTS */}
                <div className="ad-carousel">
                  {activeSlide === 0 && (
                    <WeeklyReport
                      reports={reports}
                    />
                  )}

                  {activeSlide === 1 && (
                    <MonthlyReport
                      reports={reports}
                    />
                  )}

                  {activeSlide === 2 && (
                    <CalendarReport
                      reports={reports}
                      onSelectReport={
                        setSelected
                      }
                    />
                  )}

                  {/* CENTERED REPORT NAVIGATION */}
                  <div
                    className="ad-carousel-navigation"
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      marginTop: "14px",
                    }}
                  >
                    <div
                      className="ad-carousel-hint"
                      style={{
                        width: "100%",
                        textAlign: "center",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#8c3700",
                        marginBottom: "10px",
                      }}
                    >
                      Switch between Weekly, Monthly, and Custom reports
                    </div>

                    <div
                      className="ad-carousel-dots"
                      style={{
                        position: "static",
                        left: "auto",
                        right: "auto",
                        transform: "none",
                        width: "auto",
                        margin: "0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {[
                        "Weekly",
                        "Monthly",
                        "Custom",
                      ].map((label, i) => (
                        <button
                          key={label}
                          className={`ad-carousel-dot${
                            i === activeSlide
                              ? " active"
                              : ""
                          }`}
                          onClick={() =>
                            setActiveSlide(i)
                          }
                          aria-label={`View ${label} report`}
                          title={`View ${label} report`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <ReportDetail
        report={selected}
        onClose={() =>
          setSelected(null)
        }
      />

      {settingsOpen && (
        <AdminSettings
          onClose={() =>
            setSettingsOpen(false)
          }
        />
      )}

      {taxModalOpen && (
        <TaxSelectModal
          onClose={() => setTaxModalOpen(false)}
          onSelect={handleTaxSelect}
        />
      )}
    </div>
  );
}