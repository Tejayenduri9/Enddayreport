import { useState, useMemo } from "react";
import { generateTaxDailyPDF } from "../reportPdfTax";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

export default function TaxDailyReport({ reports }) {
  const [date, setDate] = useState(() => toISO(new Date()));

  const report = useMemo(() => reports.find((r) => r.date === date) || null, [reports, date]);

  const summary = useMemo(() => {
    if (!report) return null;
    const cashSale = Number(report.cashSale) || 0;
    const cashTip = Number(report.cashTip) || 0;
    const cashCatering = Number(report.cashCatering) || 0;
    const chequesCatering = Number(report.chequesCatering) || 0;
    const creditCardTip = Number(report.creditCardTip) || 0;
    const creditCardSale = Number(report.creditCardSale) || 0;
    const totalSettle = Number(report.totalSettle) || 0;
    const restaurantOnlineTips = Number(report.restaurantOnlineTips) || 0;
    const restaurantOnline = (Number(report.restaurantOnline) || 0) - restaurantOnlineTips;
    const grubhub = Number(report.grubhub) || 0;
    const doordash = Number(report.doordash) || 0;
    const uberEats = Number(report.uberEats) || 0;
    const totalOnline = Number(report.totalRestaurantOnline) || 0;
    const totalCatering = Number(report.totalCatering) || 0;
    const totalGuests = (Number(report.lunchGuests) || 0) + (Number(report.dinnerGuests) || 0);
    // Rebuilt from the raw channel fields (not the stored totalSalesDay) so this
    // stays correct even for reports saved before the online-tip fix in App.jsx.
    const totalSale = cashSale + creditCardSale + restaurantOnline + grubhub + doordash + uberEats + totalCatering;
    const totalTips = cashTip + creditCardTip + restaurantOnlineTips;
    const totalAmountIncTip = totalSale + totalTips;
    const totalCashIncTip = cashSale + cashTip + cashCatering;
    const taxableAmount = totalSale - cashCatering;
    const tax = taxableAmount * 0.07;
    const totalInclTax = totalSale - tax;

    return {
      cashSale, cashTip, cashCatering, chequesCatering, creditCardTip, creditCardSale,
      totalSettle, restaurantOnline, restaurantOnlineTips, grubhub, doordash, uberEats, totalOnline, totalCatering,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
      taxableAmount, tax, totalInclTax,
    };
  }, [report]);

  const handleDownload = () => {
    if (!summary) return;
    const pdfDoc = generateTaxDailyPDF({ date, summary });
    pdfDoc.save(`${shortDate(date)} Tax Report.pdf`);
  };

  const shiftDay = (delta) => {
    const [y, m, d] = date.split("-").map(Number);
    const next = new Date(y, m - 1, d + delta);
    setDate(toISO(next));
  };

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Daily Report (Tax)</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftDay(-1)}>‹</button>
          <span className="ad-week-range">{shortDate(date)}</span>
          <button className="ad-week-arrow" onClick={() => shiftDay(1)}>›</button>
        </div>
      </div>

      {!report ? (
        <div className="ad-empty-state">No daily report found for this date.</div>
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
            ⬇ Download Daily Tax PDF
          </button>
        </>
      )}
    </div>
  );
}
