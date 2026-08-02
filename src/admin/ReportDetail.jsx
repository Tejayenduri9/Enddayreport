import { generatePDF } from "../reportPdf";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
};

const Row = ({ label, value, bold }) => (
  <div className={`ad-detail-row${bold ? " bold" : ""}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

export default function ReportDetail({ report, onClose }) {
  if (!report) return null;

  const handleDownload = () => {
    const doc = generatePDF(report, report.cateringNotes || []);
    const [y, m, d] = report.date.split("-").map(Number);
    const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    doc.save(`${d}${suffix} ${monthNames[m - 1]} ${String(y).slice(2)} Sales Report.pdf`);
  };

  return (
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal ad-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <div>
            <div className="ad-modal-title">{formatDate(report.date)}</div>
            <div className="ad-modal-subtitle">Report details</div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="ad-download-btn" onClick={handleDownload}>⬇ PDF</button>
            <button className="ad-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ad-detail-scroll">
          <div className="ad-detail-section">
            <div className="ad-detail-section-label">Guests</div>
            <Row label="Lunch Guests" value={report.lunchGuests || 0} />
            <Row label="Dinner Guests" value={report.dinnerGuests || 0} />
            <Row label="Dine-in Sales" value={fmt(report.dineInSales)} bold />
          </div>

          <div className="ad-detail-section">
            <div className="ad-detail-section-label">Cash</div>
            <Row label="Cash Sale" value={fmt(report.cashSale)} />
            <Row label="Cash Tip" value={fmt(report.cashTip)} />
            <Row label="Cash Catering" value={fmt(report.cashCatering)} />
            <Row label="Total Cash" value={fmt((Number(report.totalCashWithTip) || 0) + (Number(report.cashCatering) || 0))} bold />
          </div>

          <div className="ad-detail-section">
            <div className="ad-detail-section-label">Credit Card</div>
            <Row label="Total CC Settle" value={fmt(report.totalSettle)} />
            <Row label="CC Tip" value={fmt(report.creditCardTip)} />
            <Row label="CC Sale" value={fmt(report.creditCardSale)} bold />
          </div>

          <div className="ad-detail-section">
            <div className="ad-detail-section-label">Sales Channels</div>
            <Row label="System Gross Sale" value={fmt(report.systemGross)} />
            <Row label="Gift Card Redeemed" value={fmt(report.giftCard)} />
            <Row label="Total In House" value={fmt(report.totalInHouse)} bold />
          </div>

          <div className="ad-detail-section">
            <div className="ad-detail-section-label">Online Sales</div>
            <Row label="Restaurant Online" value={fmt(report.restaurantOnline)} />
            <Row label="Online Tips" value={fmt(report.restaurantOnlineTips)} />
            <Row label="Grubhub" value={fmt(report.grubhub)} />
            <Row label="DoorDash" value={fmt(report.doordash)} />
            <Row label="Uber Eats" value={fmt(report.uberEats)} />
            <Row label="Total Online" value={fmt(report.totalRestaurantOnline)} bold />
          </div>

          <div className="ad-detail-section">
            <div className="ad-detail-section-label">Final Totals</div>
            <Row label="Total Restaurant Sales" value={fmt(report.totalRestaurantSales)} bold />
            <Row label="Total Catering" value={fmt(report.totalCatering)} bold />
            <Row label="Total Sales of the Day" value={fmt(report.totalSalesDay)} bold />
          </div>

          {report.cateringNotes && report.cateringNotes.some(c => c.name || c.cateringDate || c.paymentType || c.amount) && (
            <div className="ad-detail-section">
              <div className="ad-detail-section-label">Catering Notes</div>
              {report.cateringNotes.filter(c => c.name || c.cateringDate || c.paymentType || c.amount).map((c, i) => (
                <div key={i} className="ad-catering-note">
                  <div><strong>{c.name || "—"}</strong> · {c.cateringDate || "—"}</div>
                  <div>{c.paymentType || "—"} · {c.amount ? fmt(c.amount) : "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}