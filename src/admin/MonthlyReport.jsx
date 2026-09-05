import { useState, useMemo } from "react";
import { generateMonthlyPDF } from "../reportPdfWeekly";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function MonthlyReport({ reports }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const monthReports = useMemo(() => {
    return reports
      .filter((r) => r.date >= monthStart && r.date <= monthEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reports, monthStart, monthEnd]);

  const summary = useMemo(() => {
    const sum = (k) => monthReports.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const cashSale = sum("cashSale");
    const cashTip = sum("cashTip");
    const cashCatering = sum("cashCatering");
    const chequesCatering = sum("chequesCatering");
    const creditCardTip = sum("creditCardTip");
    const creditCardSale = sum("creditCardSale");
    const totalSettle = sum("totalSettle");
    const restaurantOnline = sum("restaurantOnline");
    const restaurantOnlineTips = sum("restaurantOnlineTips");
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

    return {
      cashSale, cashTip, cashCatering, chequesCatering, creditCardTip, creditCardSale,
      totalSettle, restaurantOnline, restaurantOnlineTips, grubhub, doordash, uberEats, totalOnline, totalCatering,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
    };
  }, [monthReports]);

  const handleDownload = () => {
    const pdfDoc = generateMonthlyPDF({
      monthLabel: monthLabel(year, month), summary, dailyReports: monthReports,
    });
    pdfDoc.save(`${monthLabel(year, month)} Sales Report.pdf`);
  };

  const shiftMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Monthly Report</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftMonth(-1)}>‹</button>
          <span className="ad-week-range">{monthLabel(year, month)}</span>
          <button className="ad-week-arrow" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </div>

      {monthReports.length === 0 ? (
        <div className="ad-empty-state">No daily reports found for this month.</div>
      ) : (
        <>
          <div className="ad-summary-grid" style={{ marginBottom: "1rem" }}>
            <div className="ad-summary-card primary">
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
              <div className="ad-summary-label">Total Catering</div>
              <div className="ad-summary-value">{fmt(summary.totalCatering)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Online</div>
              <div className="ad-summary-value">{fmt(summary.totalOnline)}</div>
            </div>
          </div>

          <div className="ad-week-detail-grid">
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Cash</div>
              <div className="ad-detail-row"><span>Cash Sale</span><span>{fmt(summary.cashSale)}</span></div>
              <div className="ad-detail-row"><span>Cash Tip</span><span>{fmt(summary.cashTip)}</span></div>
              <div className="ad-detail-row bold"><span>Total Cash (incl. Tip)</span><span>{fmt(summary.totalCashIncTip)}</span></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Credit Card</div>
              <div className="ad-detail-row"><span>Total CC Settle</span><span>{fmt(summary.totalSettle)}</span></div>
              <div className="ad-detail-row"><span>CC Tip</span><span>{fmt(summary.creditCardTip)}</span></div>
              <div className="ad-detail-row bold"><span>CC Sale</span><span>{fmt(summary.creditCardSale)}</span></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Online</div>
              <div className="ad-detail-row"><span>Restaurant Online</span><span>{fmt(summary.restaurantOnline)}</span></div>
              <div className="ad-detail-row"><span>Online Tips</span><span>{fmt(summary.restaurantOnlineTips)}</span></div>
              <div className="ad-detail-row"><span>Grubhub</span><span>{fmt(summary.grubhub)}</span></div>
              <div className="ad-detail-row"><span>DoorDash</span><span>{fmt(summary.doordash)}</span></div>
              <div className="ad-detail-row"><span>Uber Eats</span><span>{fmt(summary.uberEats)}</span></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Catering</div>
              <div className="ad-detail-row"><span>Cash Catering</span><span>{fmt(summary.cashCatering)}</span></div>
              <div className="ad-detail-row"><span>Cheques Catering</span><span>{fmt(summary.chequesCatering)}</span></div>
              <div className="ad-detail-row bold"><span>Total Catering</span><span>{fmt(summary.totalCatering)}</span></div>
            </div>
          </div>

          <button className="ad-btn" style={{ marginTop: "1rem" }} onClick={handleDownload}>
            ⬇ Download Monthly PDF
          </button>
        </>
      )}
    </div>
  );
}