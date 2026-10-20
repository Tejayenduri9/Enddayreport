import { useState } from "react";
import "./notifications.css";

/**
 * Bell in the dashboard top bar. Shows a count of things needing attention;
 * tapping it opens the list.
 *
 * items: [{ id, tone: "warn" | "info", title, body?, list?: string[], action?: { label, onClick } }]
 */
export default function NotificationBell({ items }) {
  const [open, setOpen] = useState(false);
  const count = items.length;

  return (
    <div className="nb-wrap">
      <button
        className={`nb-bell${count ? " has-items" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `Notifications: ${count}` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6.5 1.8 6.5H4.2S6 14 6 9.5Z" />
          <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
        </svg>
        {count > 0 && <span className="nb-count">{count}</span>}
      </button>

      {open && (
        <>
          <div className="nb-backdrop" onClick={() => setOpen(false)} />
          <div className="nb-panel" role="dialog" aria-label="Notifications">
            <div className="nb-head">Notifications</div>
            {count === 0 ? (
              <div className="nb-empty">You&apos;re all caught up.</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className={`nb-item ${item.tone}`}>
                  <span className="nb-dot" aria-hidden="true" />
                  <div className="nb-main">
                    <div className="nb-title">{item.title}</div>
                    {item.list && (
                      <ul className="nb-list">
                        {item.list.map((line) => <li key={line}>{line}</li>)}
                      </ul>
                    )}
                    {item.body && <div className="nb-body">{item.body}</div>}
                    {item.action && (
                      <button className="nb-action" onClick={() => { setOpen(false); item.action.onClick(); }}>
                        {item.action.label} →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
