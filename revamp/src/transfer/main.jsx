import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { parseFileFragment } from "../engine/index.js";
import "../styles.css";

const boot = parseFileFragment(window.location.hash);

function TransferShell() {
  return (
    <main className="shell">
      <p className="eyebrow">Transfer document</p>
      <h1>LynkShare</h1>
      <p>The transfer document is being rebuilt.</p>
      <p>File format: version {boot.version}</p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TransferShell />
  </StrictMode>,
);
