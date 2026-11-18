import { useEffect } from "react";
import { Shell } from "./Shell.jsx";
export { SendScreen } from "./send/SendScreen.jsx";
export { ReceiveScreen } from "./receive/ReceiveScreen.jsx";
export { ShareScreen } from "./receive/ShareScreen.jsx";

export function PairingScreen({ route }) {
  return (
    <Shell eyebrow="Receive" title="This is a receiver code.">
      <p className="lead">
        The sender scans this code from their own device. The files attach to
        the receiver screen that created it.
      </p>
      <p className="hint">
        If you created this code, return to that tab and keep it open. If you
        opened someone else's code, ask them for the transfer link instead.
      </p>
      <p className="hint">Session {route.sessionId}</p>
      <a className="secondary" href="/receive">
        Start a new receiver code
      </a>
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
