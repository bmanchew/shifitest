
import React from "react";
import ReactDOM from "react-dom/client";
import { Router } from "wouter";
import AppWrapper from "./AppWrapper";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router>
      <AppWrapper />
    </Router>
  </React.StrictMode>
);
