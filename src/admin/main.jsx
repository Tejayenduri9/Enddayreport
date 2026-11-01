import React from "react";
import ReactDOM from "react-dom/client";
import AdminApp from "./AdminApp";
import { restaurantTheme } from "../restaurantConfig.js";
import { applyThemeToDom } from "../themeUtils.js";

applyThemeToDom(restaurantTheme);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
