import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  LynkApi,
  generateReceiverKeyPair,
  resolveApiBase,
  unwrapDelivery,
} from "../../engine/index.js";
import { Shell } from "../Shell.jsx";
import {
  PAIRING_POLL_MS,
  buildDeliveryLink,
  readReceiverAttachment,
  startReceiverPairing,
} from "./receiver-pairing.js";

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function ReceiveScreen() {
  const api = useMemo(
    () => new LynkApi({ baseUrl: resolveApiBase() }),
    [],
  );
  const [code, setCode] = useState("");
  const [flow, setFlow] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);

  async function startQr() {
    if (phase === "starting") return;
    setError("");
    setCopied(false);
    setPhase("starting");
    try {
      const pairing = await startReceiverPairing({
        api,
        origin: window.location.origin,
        version: 2,
      });
      setFlow({
        kind: "qr",
        ...pairing,
        expiresAt: Date.now() + pairing.expiresIn * 1000,
      });
      setPhase("waiting");
    } catch {
      setPhase("error");
      setError("Could not create a receiver code. Check your connection and try again.");
    }
  }

  async function startCode() {
    if (phase === "starting") return;
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Type the 6-digit code the sender shows.");
      return;
    }
    setError("");
    setPhase("starting");
    try {
      const receiver = await generateReceiverKeyPair();
      const session = await api.joinSenderSession(
        digits,
        receiver.publicKeyB64,
      );
      setCode("");
      setFlow({
        kind: "code",
        sessionId: session.sessionId,
        receiverSecret: session.receiverSecret,
        privateKeySeed: receiver.privateKeySeed,
        expiresAt: Date.now() + session.expiresIn * 1000,
      });
      setPhase("waiting");
    } catch {
      setPhase("error");
      setError("That code was not accepted. Ask the sender for a fresh code.");
    }
  }

  useEffect(() => {
    if (!flow || phase !== "waiting") return undefined;
    const tick = () => {
      const left = Math.ceil((flow.expiresAt - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) setPhase("expired");
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [flow, phase]);

  useEffect(() => {
    if (!flow || phase !== "waiting") return undefined;
    let cancelled = false;
    let timer;

    const poll = async () => {
      try {
        let delivery;
        if (flow.kind === "qr") {
          delivery = await readReceiverAttachment({
            api,
            sessionId: flow.sessionId,
            privateKeySeed: flow.privateKeySeed,
          });
        } else {
          const key = await api.getSenderSessionKey(
            flow.sessionId,
            flow.receiverSecret,
          );
          if (key) {
            const unwrapped = await unwrapDelivery({
              wrappedBase64: key.wrappedKey,
              privateKeySeed: flow.privateKeySeed,
              sessionId: flow.sessionId,
            });
            delivery = {
              transferId: key.transferId,
              aesKey: unwrapped.aesKey,
              accessToken: unwrapped.accessToken,
            };
          }
        }

        if (cancelled) return;
        if (delivery) {
          window.location.assign(
            buildDeliveryLink({
              origin: window.location.origin,
              ...delivery,
            }),
          );
          return;
        }
      } catch {
        if (cancelled) return;
        setPhase("error");
        setError("Could not read the sender's key. Start again.");
        return;
      }

      if (!cancelled) timer = window.setTimeout(poll, PAIRING_POLL_MS);
    };

    timer = window.setTimeout(poll, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, flow, phase]);

  async function copyLink() {
    if (!flow?.link) return;
    try {
      await navigator.clipboard.writeText(flow.link);
      setCopied(true);
    } catch {
      window.prompt("Copy this receiver link:", flow.link);
    }
  }

  function reset() {
    setFlow(null);
    setPhase("idle");
    setError("");
    setRemaining(0);
    setCopied(false);
  }

  if (flow && phase === "waiting" && flow.kind === "qr") {
    return (
      <Shell eyebrow="Receive" title="They can scan this code.">
        <div className="result">
          <div className="qr" aria-label="Receiver QR code">
            <QRCodeSVG value={flow.link} size={220} level="M" />
          </div>
          <p className="hint">
            Keep this screen open. The sender scans this code, then attaches the
            files to it.
          </p>
          <p className="hint" role="status">
            {remaining > 0
              ? `Code expires in ${formatTime(remaining)}.`
              : "This code has expired."}
          </p>
          <button className="primary" type="button" onClick={copyLink}>
            {copied ? "Link copied" : "Copy receiver link"}
          </button>
          <button className="secondary" type="button" onClick={reset}>
            Start again
          </button>
        </div>
      </Shell>
    );
  }

  if (flow && phase === "waiting" && flow.kind === "code") {
    return (
      <Shell eyebrow="Receive" title="Waiting for the sender.">
        <p className="lead">
          The sender has your key check. Keep this screen open while they share
          the file key.
        </p>
        <p className="hint" role="status">
          {remaining > 0
            ? `Code expires in ${formatTime(remaining)}.`
            : "This code has expired."}
        </p>
        <button className="secondary" type="button" onClick={reset}>
          Start again
        </button>
      </Shell>
    );
  }

  if (flow && (phase === "expired" || phase === "error")) {
    return (
      <Shell eyebrow="Receive" title="This code did not complete.">
        <p className={phase === "error" ? "error" : "hint"} role="status">
          {phase === "error"
            ? error
            : "The code expired before the sender attached the files."}
        </p>
        <button className="primary" type="button" onClick={reset}>
          Start again
        </button>
      </Shell>
    );
  }

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
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <p className="hint">Six digits. Ask the sender for the code.</p>
      </div>
      <button
        className="primary"
        type="button"
        onClick={startCode}
        disabled={phase === "starting"}
      >
        {phase === "starting" ? "Working…" : "Continue"}
      </button>
      <button
        className="secondary"
        type="button"
        onClick={startQr}
        disabled={phase === "starting"}
      >
        Show my receiver QR
      </button>
      <p className="hint">
        The other person scans this screen. If they sent a link, open that link
        instead.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Shell>
  );
}
