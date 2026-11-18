import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { HistoryStore } from "../engine/index.js";
import { PLAY_URL } from "../components/play-url.js";
import "../styles.css";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RecentActivity() {
  const [records, setRecords] = useState(() => new HistoryStore().list());

  if (records.length === 0) {
    return (
      <section className="section">
        <h2>Recent activity</h2>
        <p className="hint">No transfers in this tab yet.</p>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-heading">
        <h2>Recent activity</h2>
        <button
          className="link-button"
          type="button"
          onClick={() => {
            new HistoryStore().clear();
            setRecords([]);
          }}
        >
          Clear
        </button>
      </div>
      <ul className="file-list">
        {records.map((record) => (
          <li className="file-row" key={`${record.id}-${record.timestamp}`}>
            <span>
              <strong>
                {record.fileNames.length > 1
                  ? `${record.fileNames.length} files`
                  : record.fileNames[0] ?? "Transfer"}
              </strong>
              <small>
                {record.type === "received" ? "Received" : "Sent"} ·{" "}
                {formatBytes(record.totalSize)} · {record.status}
              </small>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        This list stays in this tab. It never stores the key or the link.
      </p>
    </section>
  );
}

export function MarketingApp() {
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="/">
          LynkShare
        </a>
        <nav className="site-nav" aria-label="Main">
          <a href="/how-it-works">How it works</a>
          <a href="/guides">Guides</a>
          <a href="/faq">FAQ</a>
          <a href="/send">Send</a>
        </nav>
      </header>

      <main className="marketing">
        <section className="hero">
          <p className="eyebrow">No account · Client-side encryption</p>
          <h1>Send a file without making an account.</h1>
          <p className="lead">
            Pick a file, share a link or QR, and the other person saves it.
            Encrypted on your device. Up to 10 MB on the web.
          </p>
          <div className="actions">
            <a className="primary" href="/send">
              Send files
            </a>
            <a className="secondary" href="/receive">
              Receive files
            </a>
          </div>
        </section>

        <section className="steps" aria-label="How it works">
          <article>
            <span className="step-number">1</span>
            <h2>Pick a file</h2>
            <p>Choose up to 10 files. The web limit is 10 MB in total.</p>
          </article>
          <article>
            <span className="step-number">2</span>
            <h2>Share the link or QR</h2>
            <p>Send the link or show the sender QR. The receiver scans or opens it.</p>
          </article>
          <article>
            <span className="step-number">3</span>
            <h2>They save it</h2>
            <p>The file is decrypted in their browser or in the Android app.</p>
          </article>
        </section>

        <section className="section">
          <h2>What stays true</h2>
          <div className="feature-grid">
            <article>
              <h3>Encrypted on your device</h3>
              <p>The key stays in the link fragment and is not sent to the server.</p>
            </article>
            <article>
              <h3>Direct when it can be</h3>
              <p>A direct connection is tried first. The encrypted cloud copy is the fallback.</p>
            </article>
            <article>
              <h3>No account</h3>
              <p>No sign-up, email address, or phone number is required to send.</p>
            </article>
            <article>
              <h3>Works on a phone browser</h3>
              <p>iOS users can receive in the browser. No app install is needed.</p>
            </article>
          </div>
        </section>

        <section className="section">
          <h2>Web limit</h2>
          <p>
            The website sends up to <strong>10 MB total</strong> per transfer,
            with a maximum of 10 files. The Android app has higher limits. There
            is no web unlock.
          </p>
        </section>

        <section className="section">
          <h2>Privacy</h2>
          <p>
            The server stores ciphertext and session metadata, including file
            names, sizes, and network addresses. It does not receive the file
            key. Treat a complete link, QR image, or code as sensitive.
          </p>
          <p className="hint">
            Read the <a href="/privacy">privacy policy</a>.
          </p>
        </section>

        <section className="section">
          <h2>Questions</h2>
          <h3>How do I send files across devices without an account?</h3>
          <p>
            Open Send on the sender, choose the files, then share the link or
            QR. On the other device, open the link or scan the QR. iPhone and
            iPad users receive in the browser.
          </p>
          <h3>Where does the key go?</h3>
          <p>
            The key is created on the sending device and stays in the link
            fragment. It is not stored by the service.
          </p>
          <h3>What is the web size limit?</h3>
          <p>10 MB total per transfer, with at most 10 files.</p>
        </section>

        <RecentActivity />

        <section className="section app-note">
          <h2>Prefer the app?</h2>
          <p>
            The Android app has higher size limits and a native transfer flow.{" "}
            <a href={PLAY_URL} target="_blank" rel="noopener noreferrer">
              Get LynkShare for Android
            </a>
            .
          </p>
        </section>
      </main>

      <footer className="footer">
        <a href="/about">About</a>
        <a href="/how-it-works">How it works</a>
        <a href="/guides">Guides</a>
        <a href="/faq">FAQ</a>
        <a href="/privacy">Privacy</a>
        <a href="https://github.com/mudit-palvadi/LynkShare">GitHub</a>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MarketingApp />
  </StrictMode>,
);
