import { useState } from "react";
import TaxDailyReport from "./TaxDailyReport";
import TaxWeeklyReport from "./TaxWeeklyReport";
import TaxMonthlyReport from "./TaxMonthlyReport";
import TaxCustomReport from "./TaxCustomReport";

export default function TaxGeneralDashboard({ reports, onBack, onSelectReport }) {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <>
      <div className="ad-panel-title-row" style={{ marginBottom: "4px" }}>
        <div />
        <button className="ad-back-btn ad-back-btn-solid" onClick={onBack}>← Back to Dashboard</button>
      </div>

      {/* DAILY / WEEKLY / MONTHLY / CUSTOM TAX REPORTS */}
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