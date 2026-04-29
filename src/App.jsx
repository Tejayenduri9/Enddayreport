import { useState } from "react";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import logo from "./assets/logo.png";

const emptyCatering = () => ({ cateringDate: "", name: "", paymentType: "", amount: "" });

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const blankForm = () => ({
  date: getToday(),
  ownerEmails: import.meta.env.VITE_OWNER_EMAILS || "",
  lunchGuests: "",
  dinnerGuests: "",
  dineInSales: "",
  cashSale: "",
  cashTip: "",
  cashCatering: "",
  totalSettle: "",
  creditCardTip: "",
  giftCard: "",
  restaurantOnline: "",
  grubhub: "",
  doordash: "",
  uberEats: "",
  totalCashWithTip: "",
  creditCardSale: "",
  systemGross: "",
  totalInHouse: "",
  totalRestaurantOnline: "",
  totalRestaurantSales: "",
  totalSalesDay: "",
});

function App() {
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const [form, setForm] = useState(blankForm());
  const [cateringNotes, setCateringNotes] = useState([emptyCatering()]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "", title: "", message: "" });
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const showModal = (type, title, message) => setModal({ open: true, type, title, message });
  const closeModal = () => { setModal({ open: false, type: "", title: "", message: "" }); setFeedback(""); };

  const resetForm = () => {
    setForm(blankForm());
    setCateringNotes([emptyCatering()]);
    setNotesOpen(false);
  };

  const handleCateringChange = (index, e) => {
    const updated = [...cateringNotes];
    updated[index] = { ...updated[index], [e.target.name]: e.target.value };
    setCateringNotes(updated);
  };

  const addCateringEntry = () => setCateringNotes([...cateringNotes, emptyCatering()]);

  const removeCateringEntry = (index) => {
    if (cateringNotes.length === 1) return;
    setCateringNotes(cateringNotes.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const updated = { ...form, [e.target.name]: e.target.value };

    const cashSale = Number(updated.cashSale) || 0;
    const cashTip = Number(updated.cashTip) || 0;
    const cashCatering = Number(updated.cashCatering) || 0;
    const totalCash = cashSale + cashTip + cashCatering;

    const totalSettle = Number(updated.totalSettle) || 0;
    const creditCardTip = Number(updated.creditCardTip) || 0;
    const creditCardSale = totalSettle - creditCardTip;

    const systemGross = cashSale + creditCardSale;
    const giftCard = Number(updated.giftCard) || 0;
    const totalInHouse = systemGross - giftCard;

    const restaurantOnline = Number(updated.restaurantOnline) || 0;
    const grubhub = Number(updated.grubhub) || 0;
    const doordash = Number(updated.doordash) || 0;
    const uberEats = Number(updated.uberEats) || 0;
    const onlineSale = restaurantOnline + grubhub + doordash + uberEats;

    const totalRestaurantSales = totalInHouse + onlineSale;
    const totalSalesDay = totalRestaurantSales + cashCatering;

    updated.totalCashWithTip = totalCash;
    updated.creditCardSale = creditCardSale;
    updated.systemGross = systemGross;
    updated.totalInHouse = totalInHouse;
    updated.totalRestaurantOnline = onlineSale;
    updated.totalRestaurantSales = totalRestaurantSales;
    updated.totalSalesDay = totalSalesDay;

    setForm(updated);
  };

  const saveData = async () => {
    const requiredFields = {
      lunchGuests: "Lunch Guests",
      dinnerGuests: "Dinner Guests",
      dineInSales: "Dine-in Sales",
      cashSale: "Cash Sale",
      cashTip: "Cash Tip",
      cashCatering: "Cash Catering",
      totalSettle: "Total Settle Amount",
      creditCardTip: "Credit Card Tip",
      giftCard: "Gift Card Redeemed",
      restaurantOnline: "Restaurant Online",
      grubhub: "Grubhub",
      doordash: "DoorDash",
      uberEats: "Uber Eats",
    };

    const missing = Object.entries(requiredFields)
      .filter(([key]) => form[key] === "" || form[key] === null || form[key] === undefined)
      .map(([, label]) => label);

    if (missing.length > 0) {
      showModal("error", "Missing Fields", `Please fill in the following fields:\n\n• ${missing.join("\n• ")}`);
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "restaurants"), {
        ...form,
        cateringNotes,
        createdAt: new Date(),
      });

      const response = await fetch("/.netlify/functions/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cateringNotes }),
      });

      if (!response.ok) throw new Error("Backend request failed");

      resetForm();
      setLoading(false);
      showModal("success", "Report Sent! 🎉", "Your daily sales report has been saved and emailed. Did everything look correct? Leave a note below if anything needs attention.");
    } catch (err) {
      setLoading(false);
      console.error(err);
      showModal("error", "Something went wrong", err.message || "An unexpected error occurred. Please check your entries and try again.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #f0f2f0;
          font-family: 'DM Sans', sans-serif;
        }

        .rs-wrapper {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          padding: 2rem 1rem;
        }

        .rs-card {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border-radius: 20px;
          border: 0.5px solid rgba(0,0,0,0.08);
          overflow: hidden;
          height: fit-content;
        }

        .rs-header {
          background: #1a3d2b;
          padding: 2rem 2rem 1.5rem;
          text-align: center;
        }

        .rs-header::after {
          content: '';
          display: block;
          width: 40px;
          height: 3px;
          background: #e8c97e;
          border-radius: 2px;
          margin: 1rem auto 0;
        }

        .rs-brand-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.5px;
        }

        .rs-brand-sub {
          font-size: 11px;
          letter-spacing: 3px;
          color: #e8c97e;
          text-transform: uppercase;
          margin-top: 4px;
        }

        .rs-date-pill {
          display: inline-block;
          margin-top: 1rem;
          background: rgba(255,255,255,0.12);
          border: 0.5px solid rgba(255,255,255,0.25);
          border-radius: 20px;
          padding: 5px 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.85);
        }

        .rs-body { padding: 1.5rem 1.75rem 2rem; }

        .rs-section { margin-bottom: 1.75rem; }

        .rs-section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #333;
          margin-bottom: 0.75rem;
          padding-bottom: 6px;
          border-bottom: 1px solid #ddd;
        }

        .rs-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .rs-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-bottom: 10px;
        }

        .rs-field:last-child { margin-bottom: 0; }

        .rs-field label {
          font-size: 11px;
          font-weight: 500;
          color: #666;
        }

        .rs-field input {
          background: #f7f8f7;
          border: 0.5px solid #ddd;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 14px;
          color: #111;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          width: 100%;
        }

        .rs-field input:focus {
          border-color: #1a3d2b;
          box-shadow: 0 0 0 2px rgba(26,61,43,0.12);
        }

        .rs-field select {
          background: #f7f8f7;
          border: 0.5px solid #ddd;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 14px;
          color: #111;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          width: 100%;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }

        .rs-field select:focus {
          border-color: #1a3d2b;
          box-shadow: 0 0 0 2px rgba(26,61,43,0.12);
        }

        .rs-btn {
          width: 100%;
          padding: 14px;
          background: #1a3d2b;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          letter-spacing: 0.5px;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s;
        }

        .rs-btn:hover { opacity: 0.88; }
        .rs-btn:disabled { opacity: 0.75; cursor: not-allowed; }

        .rs-notes-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f7f8f7;
          border: 0.5px solid #ddd;
          border-radius: 10px;
          padding: 12px 16px;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: #333;
          letter-spacing: 0.5px;
          transition: background 0.15s;
          outline: none;
        }

        .rs-notes-toggle:hover { background: #eef0ee; }

        .rs-notes-arrow {
          transition: transform 0.25s ease;
          display: flex;
          align-items: center;
        }

        .rs-notes-arrow.open { transform: rotate(180deg); }

        .rs-notes-body {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.4s ease, opacity 0.25s ease;
          opacity: 0;
          pointer-events: none;
        }

        .rs-notes-body.open {
          max-height: 2000px;
          opacity: 1;
          pointer-events: all;
        }

        .rs-notes-inner {
          padding-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rs-catering-entry {
          border: 0.5px solid #e0e0e0;
          border-radius: 10px;
          padding: 14px;
          position: relative;
        }

        .rs-entry-label {
          font-size: 10px;
          font-weight: 700;
          color: #999;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .rs-remove-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
          color: #bbb;
          font-size: 15px;
          line-height: 1;
          padding: 2px 5px;
          border-radius: 4px;
          transition: color 0.15s;
        }

        .rs-remove-btn:hover { color: #e05555; }

        .rs-add-btn {
          width: 100%;
          padding: 10px;
          background: none;
          border: 1px dashed #bbb;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #555;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          transition: border-color 0.15s, color 0.15s;
        }

        .rs-add-btn:hover { border-color: #1a3d2b; color: #1a3d2b; }

        .rs-loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          gap: 16px;
        }

        .rs-loading-spinner {
          width: 52px;
          height: 52px;
          border: 4px solid rgba(255,255,255,0.2);
          border-top-color: #e8c97e;
          border-radius: 50%;
          animation: rs-spin 0.8s linear infinite;
        }

        .rs-loading-text {
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.5px;
        }

        .rs-loading-sub {
          color: rgba(255,255,255,0.6);
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          margin-top: -8px;
        }

        @keyframes rs-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .rs-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          animation: rs-fade-in 0.2s ease;
        }

        @keyframes rs-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .rs-modal {
          background: #fff;
          border-radius: 16px;
          padding: 2rem;
          width: 100%;
          max-width: 360px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          animation: rs-slide-up 0.25s ease;
          text-align: center;
        }

        @keyframes rs-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .rs-modal-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          font-size: 22px;
        }

        .rs-modal-icon.success { background: #e8f5e9; }
        .rs-modal-icon.error { background: #fdecea; }

        .rs-modal-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin-bottom: 8px;
        }

        .rs-modal-message {
          font-size: 13px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 1.5rem;
          white-space: pre-line;
        }

        .rs-modal-input {
          width: 100%;
          background: #f7f8f7;
          border: 0.5px solid #ddd;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          color: #111;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          resize: vertical;
          min-height: 80px;
          margin-bottom: 1rem;
          transition: border-color 0.15s;
        }

        .rs-modal-input:focus {
          border-color: #1a3d2b;
          box-shadow: 0 0 0 2px rgba(26,61,43,0.1);
        }

        .rs-modal-actions {
          display: flex;
          gap: 8px;
        }

        .rs-modal-btn {
          flex: 1;
          padding: 11px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
        }

        .rs-modal-btn:hover { opacity: 0.85; }
        .rs-modal-btn.primary { background: #1a3d2b; color: #fff; }
        .rs-modal-btn.secondary { background: #f0f2f0; color: #333; }
      `}</style>

      <div className="rs-wrapper">
        <div className="rs-card">

          {/* Header */}
          <div className="rs-header">
            {logo && <img src={logo} alt="logo" style={{ width: 160, marginBottom: 12 }} />}
            <div className="rs-brand-name">Restaurant Sales</div>
            <div className="rs-brand-sub">Daily Report</div>
            <div className="rs-date-pill">{formatDate(form.date)}</div>
          </div>

          <div className="rs-body">

            {/* Guests */}
            <div className="rs-section">
              <div className="rs-section-label">Guests</div>
              <div className="rs-grid-2">
                <div className="rs-field">
                  <label>Lunch Guests</label>
                  <input name="lunchGuests" value={form.lunchGuests} onChange={handleChange} placeholder="0" type="number" />
                </div>
                <div className="rs-field">
                  <label>Dinner Guests</label>
                  <input name="dinnerGuests" value={form.dinnerGuests} onChange={handleChange} placeholder="0" type="number" />
                </div>
              </div>
              <div className="rs-field">
                <label>Dine-in Sales</label>
                <input name="dineInSales" value={form.dineInSales} onChange={handleChange} placeholder="0.00" type="number" />
              </div>
            </div>

            {/* Cash */}
            <div className="rs-section">
              <div className="rs-section-label">Cash</div>
              <div className="rs-grid-2">
                <div className="rs-field">
                  <label>Cash Sale</label>
                  <input name="cashSale" value={form.cashSale} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
                <div className="rs-field">
                  <label>Cash Tip</label>
                  <input name="cashTip" value={form.cashTip} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
              </div>
              <div className="rs-field">
                <label>Cash Catering</label>
                <input name="cashCatering" value={form.cashCatering} onChange={handleChange} placeholder="0.00" type="number" />
              </div>
            </div>

            {/* Credit Card */}
            <div className="rs-section">
              <div className="rs-section-label">Credit Card</div>
              <div className="rs-grid-2">
                <div className="rs-field">
                  <label>Total Settle Amount</label>
                  <input name="totalSettle" value={form.totalSettle} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
                <div className="rs-field">
                  <label>Credit Card Tip</label>
                  <input name="creditCardTip" value={form.creditCardTip} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
              </div>
            </div>

            {/* Gift Cards & Online */}
            <div className="rs-section">
              <div className="rs-section-label">Gift Cards & Online</div>
              <div className="rs-field">
                <label>Gift Card Redeemed</label>
                <input name="giftCard" value={form.giftCard} onChange={handleChange} placeholder="0.00" type="number" />
              </div>
              <div className="rs-grid-2">
                <div className="rs-field">
                  <label>Restaurant Online</label>
                  <input name="restaurantOnline" value={form.restaurantOnline} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
                <div className="rs-field">
                  <label>Grubhub</label>
                  <input name="grubhub" value={form.grubhub} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
                <div className="rs-field">
                  <label>DoorDash</label>
                  <input name="doordash" value={form.doordash} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
                <div className="rs-field">
                  <label>Uber Eats</label>
                  <input name="uberEats" value={form.uberEats} onChange={handleChange} placeholder="0.00" type="number" />
                </div>
              </div>
            </div>

            {/* Catering Notes */}
            <div className="rs-section">
              <button type="button" className="rs-notes-toggle" onClick={() => setNotesOpen(!notesOpen)}>
                <span>📋 Notes — Catering</span>
                <span className={`rs-notes-arrow${notesOpen ? " open" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 5l5 5 5-5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>

              <div className={`rs-notes-body${notesOpen ? " open" : ""}`}>
                <div className="rs-notes-inner">
                  {cateringNotes.map((note, index) => (
                    <div key={index} className="rs-catering-entry">
                      {cateringNotes.length > 1 && (
                        <button type="button" className="rs-remove-btn" onClick={() => removeCateringEntry(index)}>✕</button>
                      )}
                      <div className="rs-entry-label">Entry {index + 1}</div>
                      <div className="rs-field">
                        <label>Catering Date</label>
                        <input type="date" name="cateringDate" value={note.cateringDate} onChange={(e) => handleCateringChange(index, e)} />
                      </div>
                      <div className="rs-field">
                        <label>Name</label>
                        <input type="text" name="name" value={note.name} onChange={(e) => handleCateringChange(index, e)} placeholder="Client name" />
                      </div>
                      <div className="rs-field">
                        <label>Payment Type</label>
                        <select name="paymentType" value={note.paymentType} onChange={(e) => handleCateringChange(index, e)}>
                          <option value="">Select payment type</option>
                          <option value="Cash">Cash</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Check">Check</option>
                          <option value="Zelle">Zelle</option>
                          <option value="Venmo">Venmo</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="rs-field">
                        <label>Amount ($)</label>
                        <input type="number" name="amount" value={note.amount} onChange={(e) => handleCateringChange(index, e)} placeholder="0.00" />
                      </div>
                    </div>
                  ))}
                  <button type="button" className="rs-add-btn" onClick={addCateringEntry}>
                    + Add Another Entry
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button className="rs-btn" onClick={saveData} disabled={loading}>
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "rs-spin 0.8s linear infinite" }}>
                    <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                    <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 8h12M9 4l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Generate Report
                </>
              )}
            </button>

          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="rs-loading-overlay">
          <div className="rs-loading-spinner" />
          <div className="rs-loading-text">Generating Report...</div>
          <div className="rs-loading-sub">This may take up to a minute</div>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="rs-modal-overlay" onClick={closeModal}>
          <div className="rs-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`rs-modal-icon ${modal.type}`}>
              {modal.type === "success" ? "✅" : "⚠️"}
            </div>
            <div className="rs-modal-title">{modal.title}</div>
            <div className="rs-modal-message">{modal.message}</div>

            {modal.type === "success" && (
              <>
                <textarea
                  className="rs-modal-input"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Did anything look wrong? Let us know (optional)..."
                />
                <div className="rs-modal-actions">
                  <button className="rs-modal-btn secondary" onClick={closeModal}>Skip</button>
                  <button
                    className="rs-modal-btn primary"
                    onClick={async () => {
                      if (feedback.trim()) {
                        try {
                          await addDoc(collection(db, "feedback"), {
                            feedback,
                            date: getToday(),
                            createdAt: new Date(),
                          });
                          await fetch("/.netlify/functions/send-feedback", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              feedback,
                              date: getToday(),
                              ownerEmails: import.meta.env.VITE_OWNER_EMAILS || "",
                            }),
                          });
                        } catch (err) {
                          console.error("Feedback error:", err);
                        }
                      }
                      closeModal();
                    }}
                  >Submit</button>
                </div>
              </>
            )}

            {modal.type === "error" && (
              <>
                <textarea
                  className="rs-modal-input"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe what went wrong (optional)..."
                />
                <div className="rs-modal-actions">
                  <button className="rs-modal-btn secondary" onClick={closeModal}>Dismiss</button>
                  <button className="rs-modal-btn primary" onClick={closeModal}>Got it</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;