import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

function AdminApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fdf3ec; font-family: 'DM Sans', sans-serif; }

        /* Login screen (mirrors the daily-report lock screen style) */
        .ad-lock-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fdf3ec; padding: 1rem; }
        .ad-lock-card { background: #fff; border-radius: 20px; border: 0.5px solid rgba(0,0,0,0.08); overflow: hidden; width: 100%; max-width: 380px; text-align: center; }
        .ad-lock-header { background: #C45200; padding: 2rem 2rem 1.5rem; }
        .ad-lock-header::after { content: ''; display: block; width: 40px; height: 3px; background: #ffc864; border-radius: 2px; margin: 1rem auto 0; }
        .ad-lock-title { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 600; color: #fff; }
        .ad-lock-sub { font-size: 11px; letter-spacing: 3px; color: #ffc864; text-transform: uppercase; margin-top: 4px; }
        .ad-lock-body { padding: 2rem; display: flex; flex-direction: column; }
        .ad-lock-label { font-size: 11px; font-weight: 500; color: #666; margin-bottom: 6px; text-align: left; }
        .ad-lock-input-text { width: 100%; background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 10px; padding: 11px 14px; font-size: 14px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 14px; transition: border-color 0.15s, box-shadow 0.15s; }
        .ad-lock-input-text:focus { border-color: #C45200; box-shadow: 0 0 0 2px rgba(196,82,0,0.12); }
        .ad-lock-error { color: #e05555; font-size: 12px; margin-bottom: 12px; text-align: left; }
        .ad-btn { width: 100%; padding: 13px; background: #C45200; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; letter-spacing: 0.5px; transition: opacity 0.15s; }
        .ad-btn:hover { opacity: 0.88; }
        .ad-btn:disabled { opacity: 0.75; cursor: not-allowed; }

        /* Dashboard shell */
        .ad-wrapper { min-height: 100vh; background: #fdf3ec; }
        .ad-topbar { background: #C45200; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; position: relative; z-index: 50; }
        .ad-topbar-left { display: flex; align-items: center; gap: 12px; }
        .ad-topbar-logo { height: 56px; width: auto; max-width: 140px; border-radius: 8px; object-fit: contain; background: #fff; padding: 4px; }
        .ad-topbar-title { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 600; color: #fff; }
        .ad-topbar-sub { font-size: 10px; letter-spacing: 2px; color: #ffc864; text-transform: uppercase; }
        .ad-topbar-right { display: flex; align-items: center; gap: 14px; }
        .ad-user-email { font-size: 12px; color: rgba(255,255,255,0.85); }
        .ad-logout-btn { background: rgba(255,255,255,0.15); border: 0.5px solid rgba(255,255,255,0.3); color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.15s; }
        .ad-logout-btn:hover { background: rgba(255,255,255,0.25); }
        .ad-settings-btn { background: rgba(255,255,255,0.15); border: 0.5px solid rgba(255,255,255,0.3); color: #fff; width: 34px; height: 34px; border-radius: 8px; font-size: 14px; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; justify-content: center; }
        .ad-settings-btn:hover { background: rgba(255,255,255,0.25); }
        .ad-settings-form { padding: 1.25rem 1.5rem 1.5rem; display: flex; flex-direction: column; }
        .ad-settings-label { font-size: 10.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C45200; margin-bottom: 10px; }
        .ad-settings-success { background: #eef7ee; border: 1px solid #bfe3bf; color: #2c6b2c; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
        .ad-settings-divider { height: 1px; background: #f5e7d8; margin: 0 1.5rem; }

        .ad-content { max-width: 1000px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
        .ad-range-row { display: flex; gap: 8px; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .ad-range-btn { background: #fff; border: 0.5px solid #f5c9a0; color: #8C3700; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .ad-range-btn:hover { border-color: #C45200; }
        .ad-range-btn.active { background: #C45200; color: #fff; border-color: #C45200; }

        .ad-error-banner { background: #fdecea; border: 1px solid #f5b8b8; color: #a83232; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 1rem; }

        .ad-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 1.5rem; }
        .ad-summary-card { background: #fff; border: 0.5px solid rgba(0,0,0,0.06); border-radius: 14px; padding: 14px 16px; }
        .ad-summary-card.primary { background: #C45200; }
        .ad-summary-card.primary .ad-summary-label { color: #ffc864; }
        .ad-summary-card.primary .ad-summary-value { color: #fff; }
        .ad-summary-label { font-size: 10.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #8C3700; margin-bottom: 6px; }
        .ad-summary-value { font-family: 'DM Sans', sans-serif; font-size: 20px; font-weight: 700; color: #111; }

        .ad-panel { background: #fff; border-radius: 16px; border: 0.5px solid rgba(0,0,0,0.06); padding: 1.25rem; margin-bottom: 1.25rem; }
        .ad-overview-section { border-top: 1px solid #f5e7d8; padding-top: 1.25rem; margin-top: 1.25rem; }
        .ad-carousel { margin-bottom: 1.25rem; }
        .ad-carousel .ad-panel { margin-bottom: 0.75rem; }
        .ad-carousel-dots { display: flex; justify-content: center; gap: 8px; }
        .ad-carousel-dot { width: 8px; height: 8px; border-radius: 50%; background: #f5c9a0; border: none; cursor: pointer; padding: 0; transition: all 0.15s; }
        .ad-carousel-dot.active { background: #C45200; width: 22px; border-radius: 4px; }
        .ad-carousel-dot:hover { background: #e08a45; }
        .ad-panel-title { font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #8C3700; }
        .ad-panel-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 1rem; flex-wrap: wrap; }
        .ad-panel-title-row .ad-panel-title { margin-bottom: 0; }
        .ad-search-input { background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 8px 12px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; min-width: 220px; width: 100%; max-width: 280px; }
        .ad-search-input:focus { border-color: #C45200; }

        .ad-loading-block { text-align: center; padding: 3rem 0; color: #8C3700; font-size: 14px; }
        .ad-empty-state { text-align: center; padding: 2rem 0; color: #999; font-size: 13px; }

        .ad-table { display: flex; flex-direction: column; }
        .ad-table-header { display: grid; grid-template-columns: 1.2fr 1fr 1.4fr 0.3fr; padding: 8px 6px; font-size: 10.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #999; border-bottom: 1px solid #f5d5b8; }
        .ad-table-row { display: grid; grid-template-columns: 1.2fr 1fr 1.4fr 0.3fr; padding: 12px 6px; font-size: 13.5px; color: #333; border-bottom: 0.5px solid #f5e7d8; cursor: pointer; transition: background 0.15s; align-items: center; }
        .ad-table-row:hover { background: #fff8f4; }
        .ad-table-total { font-weight: 600; color: #C45200; }
        .ad-table-arrow { color: #ccc; text-align: right; font-size: 16px; }

        /* Weekly report */
        .ad-week-nav { display: flex; align-items: center; gap: 10px; }
        .ad-week-arrow { background: #fff8f4; border: 0.5px solid #f5c9a0; color: #C45200; width: 28px; height: 28px; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ad-week-arrow:hover { background: #fdeede; }
        .ad-week-range { font-size: 12.5px; font-weight: 600; color: #8C3700; white-space: nowrap; }
        .ad-week-detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 1.25rem; padding-top: 0.5rem; border-top: 1px solid #f5e7d8; }
        .ad-week-detail-col { padding-top: 0.75rem; }
        .ad-carry-forward { background: #fff8f4; border: 0.5px dashed #f5c9a0; border-radius: 12px; padding: 14px 16px; margin-top: 0.5rem; }
        .ad-carry-forward-note { font-weight: 400; text-transform: none; letter-spacing: 0; color: #999; font-size: 10.5px; }
        .ad-carry-forward-row { display: flex; gap: 10px; align-items: center; }
        .ad-carry-forward-saved { font-size: 11.5px; color: #999; margin-top: 6px; }
        .ad-input-money { position: relative; display: flex; align-items: center; flex: 1; }
        .ad-input-money span { position: absolute; left: 10px; color: #C45200; font-weight: 600; font-size: 14px; pointer-events: none; }
        .ad-input-money input { width: 100%; background: #fff; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 9px 12px 9px 20px; font-size: 14px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; }
        .ad-input-money input:focus { border-color: #C45200; }

        /* Calendar */
        .ad-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .ad-calendar-weekday { text-align: center; font-size: 10px; font-weight: 700; color: #999; letter-spacing: 0.5px; padding-bottom: 4px; }
        .ad-calendar-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 12.5px; color: #bbb; background: #fdf8f4; }
        .ad-calendar-cell.empty { background: transparent; }
        .ad-calendar-cell.has-report { background: #f9d9b8; color: #8C3700; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .ad-calendar-cell.has-report:hover { opacity: 0.85; }
        .ad-calendar-cell.has-report.in-range { background: #C45200; color: #fff; box-shadow: 0 0 0 2px #ffc864; }

        .ad-back-btn { background: #fff8f4; border: 0.5px solid #f5c9a0; color: #C45200; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-family: 'DM Sans', sans-serif; cursor: pointer; font-weight: 600; transition: background 0.15s; }
        .ad-back-btn:hover { background: #fdeede; }

        .ad-tax-select-body { padding: 1rem 1.5rem 1.5rem; display: flex; flex-direction: column; gap: 10px; }
        .ad-tax-select-option { text-align: left; background: #fff8f4; border: 1px solid #f5c9a0; border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; width: 100%; font-family: 'DM Sans', sans-serif; }
        .ad-tax-select-option:hover { border-color: #C45200; background: #fdeede; }
        .ad-tax-select-option.disabled { opacity: 0.55; cursor: not-allowed; }
        .ad-tax-select-option.disabled:hover { border-color: #f5c9a0; background: #fff8f4; }
        .ad-tax-select-option-title { font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 600; color: #111; margin-bottom: 4px; }
        .ad-tax-select-option-desc { font-size: 12px; color: #666; line-height: 1.4; }

        /* Custom range picker */
        .ad-range-picker-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
        .ad-range-to { font-size: 12px; color: #999; }
        .ad-load-input { background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; }
        .ad-load-input:focus { border-color: #C45200; }

        .ad-taxed-value { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .ad-tax-badge { font-size: 10px; font-weight: 600; color: #C45200; background: #fdeede; padding: 1px 6px; border-radius: 6px; white-space: nowrap; }
        .ad-tax-badge.net { color: #2c6b2c; background: #eef7ee; }

        /* Audit table */
        .ad-audit-table-wrap { overflow-x: auto; border: 1px solid #f5e7d8; border-radius: 12px; }
        .ad-audit-table { border-collapse: collapse; width: 100%; min-width: 900px; font-size: 12px; }
        .ad-audit-table thead th { background: #1a3d2b; color: #fff; font-size: 10px; font-weight: 700; padding: 8px 6px; text-align: center; white-space: nowrap; position: sticky; top: 0; }
        .ad-audit-table tbody td { padding: 6px; text-align: center; border-bottom: 0.5px solid #f5e7d8; color: #333; white-space: nowrap; }
        .ad-audit-table tbody tr:nth-child(even) { background: #fffaf6; }
        .ad-audit-table tbody tr.ad-audit-empty-row td { color: #ccc; }
        .ad-audit-day { font-weight: 700; color: #8C3700 !important; }
        .ad-audit-total-cell { font-weight: 700; color: #C45200 !important; background: #fdeede; }

        /* Report detail modal */
        .ad-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; animation: ad-fade-in 0.2s ease; }
        @keyframes ad-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .ad-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: ad-slide-up 0.25s ease; }
        @keyframes ad-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .ad-modal-lg { max-height: 85vh; display: flex; flex-direction: column; }
        .ad-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem 1rem; border-bottom: 1px solid #f5e7d8; }
        .ad-modal-title { font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 600; color: #111; }
        .ad-modal-subtitle { font-size: 11px; color: #999; margin-top: 2px; }
        .ad-modal-close { background: #f5ece4; border: none; border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 13px; color: #666; }
        .ad-download-btn { background: #C45200; border: none; border-radius: 8px; padding: 0 12px; height: 30px; cursor: pointer; font-size: 12px; font-weight: 600; color: #fff; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s; }
        .ad-download-btn:hover { opacity: 0.88; }
        .ad-detail-scroll { overflow-y: auto; padding: 1rem 1.5rem 1.5rem; }
        .ad-detail-section { margin-bottom: 1rem; }
        .ad-detail-section-label { font-size: 10.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C45200; margin-bottom: 6px; }
        .ad-detail-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #444; }
        .ad-detail-row.bold { font-weight: 700; color: #111; border-top: 1px solid #f5e7d8; padding-top: 8px; margin-top: 2px; }
        .ad-catering-note { background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; color: #444; margin-bottom: 6px; }

        /* --- New: redesigned Tax button + profile avatar dropdown --- */
        .ad-tax-btn { display: flex; align-items: center; gap: 6px; background: #ffc864; border: none; color: #6b3600; padding: 9px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; letter-spacing: 0.3px; transition: transform 0.15s, box-shadow 0.15s; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
        .ad-tax-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
        .ad-tax-btn-icon { font-size: 14px; }

        .ad-profile-wrap { position: relative; }
        .ad-profile-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1.5px solid rgba(255,255,255,0.4); color: #fff; font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .ad-profile-avatar:hover { background: rgba(255,255,255,0.3); }

        .ad-profile-backdrop { position: fixed; inset: 0; z-index: 90; background: transparent; }
        .ad-profile-menu { position: absolute; top: 48px; right: 0; background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.18); min-width: 220px; z-index: 100; overflow: hidden; animation: ad-fade-in 0.15s ease; }
        .ad-profile-menu-email { padding: 12px 16px; font-size: 12px; color: #999; border-bottom: 1px solid #f5e7d8; word-break: break-all; }
        .ad-profile-menu-item { width: 100%; text-align: left; background: none; border: none; padding: 12px 16px; font-size: 13.5px; font-weight: 500; color: #333; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s; }
        .ad-profile-menu-item:hover { background: #fff8f4; }
        .ad-profile-menu-item.danger { color: #c0392b; border-top: 1px solid #f5e7d8; }
        .ad-profile-menu-item.danger:hover { background: #fdecea; }
      `}</style>

      {checking ? (
        <div className="ad-lock-screen">Loading…</div>
      ) : user ? (
        <AdminDashboard user={user} />
      ) : (
        <AdminLogin />
      )}
    </>
  );
}

export default AdminApp;
