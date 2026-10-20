import logo from "./assets/logo.png";
import "./auth.css";

// Layout shared by the "front door" screens (see auth.css).
export function AuthScreen({ subtitle, children }) {
  return (
    <div className="au-screen">
      <main className="au-card">
        <header className="au-head">
          <div className="au-logo"><img src={logo} alt="Restaurant logo" /></div>
          <div className="au-title">Restaurant Sales</div>
          {subtitle && <div className="au-sub">{subtitle}</div>}
        </header>
        <div className="au-body">{children}</div>
      </main>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="au-screen" aria-busy="true">
      <div className="au-spinner dark" role="status" aria-label="Loading" />
    </div>
  );
}

export const Spinner = () => <span className="au-spinner" aria-hidden="true" />;
