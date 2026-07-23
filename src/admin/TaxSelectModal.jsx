export default function TaxSelectModal({ onClose, onSelect }) {
  return (
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <div>
            <div className="ad-modal-title">Tax Dashboard</div>
            <div className="ad-modal-subtitle">Choose a view</div>
          </div>
          <button className="ad-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ad-tax-select-body">
          <button className="ad-tax-select-option" onClick={() => onSelect("general")}>
            <div className="ad-tax-select-option-title">General</div>
            <div className="ad-tax-select-option-desc">
              Sales totals with 7% tax applied, same layout as your main dashboard, no charts.
            </div>
          </button>

          <button className="ad-tax-select-option" onClick={() => onSelect("audit")}>
            <div className="ad-tax-select-option-title">Audit</div>
            <div className="ad-tax-select-option-desc">
              Monthly day-by-day audit table for your tax preparer, with a downloadable report.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
