import { useState, useMemo } from "react";
import { generateTaxWeeklyPDF } from "../reportPdfTax";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Recorded amount already includes 7% tax — extract it out (subtract, not add)
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

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

export default function TaxWeeklyReport({ reports }) {
  const [weekStart, setWeekStart] = useState(() => toISO(getMonday(new Date())));

  const weekEnd = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const end = new Date(y, m - 1, d + 6);
    return toISO(end);
  }, [weekStart]);

  const weekReports = useMemo(() => {
    return reports
      .filter((r) => r.date >= weekStart && r.date <= weekEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reports, weekStart, weekEnd]);

  const summary = useMemo(() => {
    const sum = (key) => weekReports.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const cashSale = sum("cashSale");
    const cashTip = sum("cashTip");
    const cashCatering = sum("cashCatering");
    const chequesCatering = sum("chequesCatering");
    const creditCardTip = sum("creditCardTip");
    const creditCardSale = sum("creditCardSale");
    const totalSettle = sum("totalSettle");
    const restaurantOnlineTips = sum("restaurantOnlineTips");
    const restaurantOnline = sum("restaurantOnline") - restaurantOnlineTips;
    const grubhub = sum("grubhub");
    const doordash = sum("doordash");
    const uberEats = sum("uberEats");
    const totalOnline = sum("totalRestaurantOnline");
    const totalCatering = sum("totalCatering");
    const totalGuests = sum("lunchGuests") + sum("dinnerGuests");
    const totalSale = sum("totalSalesDay");
    const totalTips = cashTip + creditCardTip + restaurantOnlineTips;
    const totalAmountIncTip = totalSale + totalTips;
    const totalCashIncTip = cashSale + cashTip + cashCatering;
    // Recorded sale amount already includes 7% tax — extract it (subtract), don't add on top
    const taxableAmount = totalSale - cashCatering;
    const tax = taxableAmount * 0.07;
    const totalInclTax = totalSale - tax;

    return {
      cashSale, cashTip, cashCatering, chequesCatering, creditCardTip, creditCardSale,
      totalSettle, restaurantOnline, restaurantOnlineTips, grubhub, doordash, uberEats, totalOnline, totalCatering,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
      taxableAmount, tax, totalInclTax,
    };
  }, [weekReports]);

  const handleDownload = () => {
    const pdfDoc = generateTaxWeeklyPDF({ weekStart, weekEnd, summary, dailyReports: weekReports });
    pdfDoc.save(`Week of ${shortDate(weekStart)} Tax Report.pdf`);
  };

  const shiftWeek = (delta) => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const next = new Date(y, m - 1, d + delta * 7);
    setWeekStart(toISO(next));
  };

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Weekly Report (Tax)</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftWeek(-1)}>‹</button>
          <span className="ad-week-range">{shortDate(weekStart)} – {shortDate(weekEnd)}</span>
          <button className="ad-week-arrow" onClick={() => shiftWeek(1)}>›</button>
        </div>
      </div>

      {weekReports.length === 0 ? (
        <div className="ad-empty-state">No daily reports found for this week.</div>
      ) : (
        <>
          <div className="ad-summary-grid" style={{ marginBottom: "1rem" }}>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Sales (incl. Tip)</div>
              <div className="ad-summary-value">{fmt(summary.totalAmountIncTip)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Sale (excl. Tip)</div>
              <div className="ad-summary-value">{fmt(summary.totalSale)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Tips</div>
              <div className="ad-summary-value">{fmt(summary.totalTips)}</div>
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
              <div className="ad-detail-row"><span>Restaurant Online (Net)</span><TaxedValue value={summary.restaurantOnline} /></div>
              <div className="ad-detail-row"><span>Online Tips</span><span>{fmt(summary.restaurantOnlineTips)}</span></div>
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
            ⬇ Download Weekly Tax PDF
          </button>
        </>
      )}
    </div>
  );
}
