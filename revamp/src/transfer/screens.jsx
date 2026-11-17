import { useEffect } from "react";

export function Shell({ eyebrow, title, children }) {
  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="/">
          LynkShare
        </a>
      </header>
      <section className="panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function SendScreen() {
  return (
    <Shell eyebrow="Send" title="You are sending.">
      <p className="lead">Up to 10 MB on the web.</p>
      <div className="choices">
        <button className="choice" type="button">
          <strong>Direct</strong>
          <span>The other person needs to stay online. Falls back to Cloud.</span>
        </button>
        <button className="choice" type="button">
          <strong>Cloud</strong>
          <span>The link works while the 10-minute session is open.</span>
        </button>
      </div>
      <div className="field">
        <label htmlFor="send-files">Choose files</label>
        <input id="send-files" type="file" multiple />
        <p className="hint">Drop files here, or choose up to 10 files.</p>
      </div>
      <button className="primary" type="button" disabled>
        Create link
      </button>
    </Shell>
  );
}

export function ReceiveScreen() {
  return (
    <Shell eyebrow="Receive" title="You are receiving.">
      <div className="field">
        <label htmlFor="receive-code">Their code</label>
        <input
          id="receive-code"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder=""
        />
        <p className="hint">Six digits. Ask the sender for the code.</p>
      </div>
      <button className="primary" type="button">
        Continue
      </button>
      <button className="secondary" type="button">
        Show my code
      </button>
      <p className="hint">
        The other person scans this screen. If they sent a link, open that link
        instead.
      </p>
    </Shell>
  );
}

export function ShareScreen({ transferId }) {
  return (
    <Shell eyebrow="Receive" title="Open this link.">
      <p className="lead">Transfer {transferId}</p>
      <p className="hint">
        The download control appears after the key and access token are read
        from the original link.
      </p>
      <button className="primary" type="button" disabled>
        Save file
      </button>
    </Shell>
  );
}

export function PairingScreen({ route }) {
  return (
    <Shell eyebrow="Pair" title="Waiting for them to confirm.">
      <p className="lead">Session {route.sessionId}</p>
      <p className="hint">
        The wrapped key is not released until the sender confirms this device.
      </p>
      <p className="hint">Public key fingerprint: {route.publicKey.slice(0, 8)}…</p>
    </Shell>
  );
}

export function ErrorScreen({ reason }) {
  const message =
    reason === "not-a-transfer-link"
      ? "This is not a transfer link. Open the original link the sender shared."
      : "This link is missing its key. Open the original link.";
  return (
    <Shell eyebrow="Receive" title="This link cannot open.">
      <p className="error">{message}</p>
    </Shell>
  );
}

export function LegacyRedirect({ path }) {
  useEffect(() => {
    const target = path.includes("receive") ? "/receive" : "/send";
    window.location.replace(target);
  }, [path]);
  return (
    <Shell eyebrow="Redirect" title="Taking you to the new page.">
      <p className="hint">This old address has moved.</p>
    </Shell>
  );
}

export function MarketingRedirect() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return null;
}

export function NotFound() {
  return (
    <Shell eyebrow="Not found" title="That page does not exist.">
      <p className="hint">Check the address, or start from the home page.</p>
    </Shell>
  );
}
