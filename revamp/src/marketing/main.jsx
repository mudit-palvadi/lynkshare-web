import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";

function MarketingShell() {
  return (
    <main className="shell">
      <p className="eyebrow">Website revamp</p>
      <h1>LynkShare</h1>
      <p>The marketing document is being rebuilt.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MarketingShell />
  </StrictMode>,
);
