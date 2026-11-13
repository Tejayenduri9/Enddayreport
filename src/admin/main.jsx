import React from "react";
import ReactDOM from "react-dom/client";
import AdminApp from "./AdminApp";
import ErrorBoundary from "../ErrorBoundary.jsx";
import { restaurantTheme } from "../restaurantConfig.js";
import { applyThemeToDom } from "../themeUtils.js";

applyThemeToDom(restaurantTheme);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </React.StrictMode>
);
