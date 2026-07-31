import { useState, useMemo } from "react";
import TaxDailyReport from "./TaxDailyReport";
import TaxWeeklyReport from "./TaxWeeklyReport";
import TaxMonthlyReport from "./TaxMonthlyReport";
import TaxCustomReport from "./TaxCustomReport";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const RANGE_OPTIONS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "Last 180 Days", days: 180 },
  { label: "Last 1 Year", days: 365 },
  { label: "All Time", days: null },
  { label: "Custom", days: "custom" },
];

export default function TaxGeneralDashboard({ reports, onBack, onSelectReport }) {
  const [rangeIdx, setRangeIdx] = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

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

  const summary = useMemo(() => {
    const list = filteredByRange;
    const totalSales = list.reduce((s, r) => s + (Number(r.totalSalesDay) || 0), 0);
    const totalGuests = list.reduce((s, r) => s + (Number(r.lunchGuests) || 0) + (Number(r.dinnerGuests) || 0), 0);
    const totalCatering = list.reduce((s, r) => s + (Number(r.totalCatering) || 0), 0);
    const totalOnline = list.reduce((s, r) => s + (Number(r.totalRestaurantOnline) || 0), 0);
    const cashCatering = list.reduce((s, r) => s + (Number(r.cashCatering) || 0), 0);
    const avgDaily = list.length ? totalSales / list.length : 0;

    const taxableAmount = totalSales - cashCatering;
    const tax = taxableAmount * 0.07;
    const totalInclTax = totalSales - tax;

    return { totalSales, totalGuests, totalCatering, totalOnline, avgDaily, cashCatering, taxableAmount, tax, totalInclTax, count: list.length };
  }, [filteredByRange]);

  return (
    <>
      <div className="ad-panel ad-overview-panel">
        <div className="ad-panel-title-row">
          <div className="ad-panel-title">Tax Dashboard — General</div>
          <button className="ad-back-btn ad-back-btn-solid" onClick={onBack}>← Back to Dashboard</button>
        </div>

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

        <div className="ad-summary-grid">
          <div className="ad-summary-card">
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
          <div className="ad-summary-card">
            <div className="ad-summary-label">Tax (7%)</div>
            <div className="ad-summary-value">{fmt(summary.tax)}</div>
          </div>
          <div className="ad-summary-card primary">
            <div className="ad-summary-label">Net Sales (Tax Removed)</div>
            <div className="ad-summary-value">{fmt(summary.totalInclTax)}</div>
          </div>
        </div>
      </div>

      {/* DAILY / WEEKLY / MONTHLY / CUSTOM TAX REPORTS — separate panel */}
      <div className="ad-carousel">
        {activeSlide === 0 && <TaxDailyReport reports={reports} />}
        {activeSlide === 1 && <TaxWeeklyReport reports={reports} />}
        {activeSlide === 2 && <TaxMonthlyReport reports={reports} />}
        {activeSlide === 3 && <TaxCustomReport reports={reports} onSelectReport={onSelectReport} />}

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
            Switch between Daily, Weekly, Monthly, and Custom tax reports
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
            {["Daily", "Weekly", "Monthly", "Custom"].map((label, i) => (
              <button
                key={label}
                className={`ad-carousel-dot${i === activeSlide ? " active" : ""}`}
                onClick={() => setActiveSlide(i)}
                aria-label={`View ${label} tax report`}
                title={`View ${label} tax report`}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}