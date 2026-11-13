import { Component } from "react";

// Catches any render-phase crash so a manager sees a recovery screen with
// guidance instead of a blank white page. Without this, React 18 unmounts the
// whole tree on an uncaught error and nothing is shown.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "An unexpected error occurred." };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem 1rem", background: "var(--brand-bg, #f5f5f5)", fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{
          width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20,
          border: "0.5px solid rgba(0,0,0,0.08)", overflow: "hidden", textAlign: "center",
        }}>
          <div style={{ background: "var(--brand, #0c2655)", padding: "1.75rem 2rem", color: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</div>
          </div>
          <div style={{ padding: "1.75rem 2rem", color: "#444", lineHeight: 1.5 }}>
            <p style={{ marginBottom: "1rem" }}>
              The page ran into an unexpected problem and had to stop.
            </p>
            <p style={{ marginBottom: "1.5rem", fontSize: 14, color: "#666" }}>
              If you just submitted a report, it may have already been emailed —
              please <strong>check your email before resubmitting</strong>. Reloading will
              bring the form back; if the report was saved, it will say so when you try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "var(--brand, #0c2655)", color: "#fff", border: "none",
                borderRadius: 12, padding: "12px 28px", fontSize: 15, fontWeight: 500, cursor: "pointer",
              }}
            >
              Reload the page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
