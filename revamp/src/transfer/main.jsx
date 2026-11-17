import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TransferApp } from "./App.jsx";
import "../styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TransferApp />
  </StrictMode>,
);
