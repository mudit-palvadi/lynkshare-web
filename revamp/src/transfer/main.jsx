import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";

function TransferShell() {
  return (
    <main className="shell">
      <p className="eyebrow">Transfer document</p>
      <h1>LynkShare</h1>
      <p>The transfer document is being rebuilt.</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TransferShell />
  </StrictMode>,
);
