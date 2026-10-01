import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Apply the persisted theme before first paint so every route (including the
// public marketing/login pages that don't mount the theme hook) is consistent.
// Dark is the default; the `light` class opts into the light theme.
if (localStorage.getItem("devos.theme") === "light") {
  document.documentElement.classList.add("light");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
