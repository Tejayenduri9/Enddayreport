import { useState, useMemo, useEffect } from "react";
import { generateTaxCustomRangePDF } from "../reportPdfTax";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const TaxedValue = ({ value }) => {
  const tax = value * 0.07;
  const net = value - tax;
  return (
    <span className="ad-taxed-value">
      {fmt(value)}
      <span className="ad-tax-badge">-7% tax: {fmt(tax)}</span>
      <span className="ad-tax-badge net">Net: {fmt(net)}</span>
    </span>
  );
};

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function TaxCustomReport({ reports, onSelectReport }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const reportsByDate = useMemo(() => {
    const map = {};
    reports.forEach((r) => { map[r.date] = r; });
    return map;
  }, [reports]);

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const rangeSelected = Boolean(rangeStart && rangeEnd);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toISO(new Date(calYear, calMonth, d));
      const inRange = rangeSelected && dateStr >= rangeStart && dateStr <= rangeEnd;
      cells.push({ day: d, dateStr, report: reportsByDate[dateStr] || null, inRange });
    }
    return cells;
  }, [calYear, calMonth, reportsByDate, rangeSelected, rangeStart, rangeEnd]);

  const shiftCalMonth = (delta) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalMonth(m);
    setCalYear(y);
  };

  useEffect(() => {
    if (rangeStart) {
      const [y, m] = rangeStart.split("-").map(Number);
      setCalYear(y);
      setCalMonth(m - 1);
    }
  }, [rangeStart]);

  const rangeReports = useMemo(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return [];
    return reports
      .filter((r) => r.date >= rangeStart && r.date <= rangeEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reports, rangeStart, rangeEnd]);

  const summary = useMemo(() => {
    const sum = (k) => rangeReports.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const cashSale = sum("cashSale");
    const cashTip = sum("cashTip");
    const cashCatering = sum("cashCatering");
    const chequesCatering = sum("chequesCatering");
    const creditCardTip = sum("creditCardTip");
    const creditCardSale = sum("creditCardSale");
    const totalSettle = sum("totalSettle");
    const restaurantOnline = sum("restaurantOnline");
    const grubhub = sum("grubhub");
    const doordash = sum("doordash");
    const uberEats = sum("uberEats");
    const totalOnline = sum("totalRestaurantOnline");
    const totalCatering = sum("totalCatering");
    const totalGuests = sum("lunchGuests") + sum("dinnerGuests");
    const totalSale = sum("totalSalesDay");
    const totalTips = cashTip + creditCardTip;
    const totalAmountIncTip = totalSale + totalTips;
    const totalCashIncTip = cashSale + cashTip + cashCatering;
    const taxableAmount = totalSale - cashCatering;
    const tax = taxableAmount * 0.07;
    const totalInclTax = totalSale - tax;

    return {
      cashSale, cashTip, cashCatering, chequesCatering, creditCardTip, creditCardSale,
      totalSettle, restaurantOnline, grubhub, doordash, uberEats, totalOnline, totalCatering,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
      taxableAmount, tax, totalInclTax,
    };
  }, [rangeReports]);

  const handleDownload = () => {
    const pdfDoc = generateTaxCustomRangePDF({ rangeStart, rangeEnd, summary, dailyReports: rangeReports });
    pdfDoc.save(`${shortDate(rangeStart)} to ${shortDate(rangeEnd)} Tax Report.pdf`);
  };

  const invalidRange = rangeStart && rangeEnd && rangeStart > rangeEnd;

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Custom Report (Tax)</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftCalMonth(-1)}>‹</button>
          <span className="ad-week-range">{monthLabel(calYear, calMonth)}</span>
          <button className="ad-week-arrow" onClick={() => shiftCalMonth(1)}>›</button>
        </div>
      </div>

      <div className="ad-calendar-grid">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="ad-calendar-weekday">{w}</div>
        ))}
        {calendarCells.map((cell, i) =>
          cell === null ? (
            <div key={`blank-${i}`} className="ad-calendar-cell empty" />
          ) : (
            <div
              key={cell.dateStr}
              className={`ad-calendar-cell${cell.report ? " has-report" : ""}${cell.inRange ? " in-range" : ""}`}
              onClick={() => cell.report && onSelectReport?.(cell.report)}
              title={cell.report ? `Total: ${fmt(cell.report.totalSalesDay)}` : undefined}
            >
              {cell.day}
            </div>
          )
        )}
      </div>

      <div className="ad-settings-divider" style={{ margin: "1.25rem 0" }} />

      <div className="ad-detail-section-label">Custom Range</div>
      <div className="ad-range-picker-row">
        <input type="date" className="ad-load-input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        <span className="ad-range-to">to</span>
        <input type="date" className="ad-load-input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
      </div>

      {!rangeSelected ? (
        <div className="ad-empty-state">Pick a start and end date to generate a report.</div>
      ) : invalidRange ? (
        <div className="ad-error-banner">⚠️ Start date must be before end date.</div>
      ) : rangeReports.length === 0 ? (
        <div className="ad-empty-state">No daily reports found for this range.</div>
      ) : (
        <>
          <div className="ad-summary-grid" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Sale (excl. Tip)</div>
              <div className="ad-summary-value">{fmt(summary.totalSale)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Tips</div>
              <div className="ad-summary-value">{fmt(summary.totalTips)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Amount (incl. Tip)</div>
              <div className="ad-summary-value">{fmt(summary.totalAmountIncTip)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Guests</div>
              <div className="ad-summary-value">{summary.totalGuests.toLocaleString()}</div>
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

          <div className="ad-week-detail-grid">
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Cash</div>
              <div className="ad-detail-row"><span>Cash Sale</span><TaxedValue value={summary.cashSale} /></div>
              <div className="ad-detail-row"><span>Cash Tip</span><span>{fmt(summary.cashTip)}</span></div>
              <div className="ad-detail-row bold"><span>Total Cash (incl. Tip)</span><span>{fmt(summary.totalCashIncTip)}</span></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Credit Card</div>
              <div className="ad-detail-row"><span>Total CC Settle</span><span>{fmt(summary.totalSettle)}</span></div>
              <div className="ad-detail-row"><span>CC Tip</span><span>{fmt(summary.creditCardTip)}</span></div>
              <div className="ad-detail-row bold"><span>CC Sale</span><TaxedValue value={summary.creditCardSale} /></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Online</div>
              <div className="ad-detail-row"><span>Restaurant Online</span><TaxedValue value={summary.restaurantOnline} /></div>
              <div className="ad-detail-row"><span>Grubhub</span><TaxedValue value={summary.grubhub} /></div>
              <div className="ad-detail-row"><span>DoorDash</span><TaxedValue value={summary.doordash} /></div>
              <div className="ad-detail-row"><span>Uber Eats</span><TaxedValue value={summary.uberEats} /></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Catering</div>
              <div className="ad-detail-row"><span>Cash Catering</span><span>{fmt(summary.cashCatering)}</span></div>
              <div className="ad-detail-row"><span>Cheques Catering</span><TaxedValue value={summary.chequesCatering} /></div>
              <div className="ad-detail-row bold"><span>Total Catering</span><span>{fmt(summary.totalCatering)}</span></div>
            </div>
          </div>

          <button className="ad-btn" style={{ marginTop: "1rem" }} onClick={handleDownload}>
            ⬇ Download Range Tax PDF
          </button>
        </>
      )}
    </div>
  );
}
