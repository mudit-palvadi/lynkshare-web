import { useEffect } from "react";
import { Shell } from "./Shell.jsx";
export { SendScreen } from "./send/SendScreen.jsx";

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
