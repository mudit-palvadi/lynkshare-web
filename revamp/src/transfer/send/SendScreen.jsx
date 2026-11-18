import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  HistoryStore,
  LimitExceededError,
  LynkApi,
  encryptedSize,
  isP2pSupported,
  maxTotalSize,
  parseReceiverQrLink,
  resolveApiBase,
  validateSelection,
} from "../../engine/index.js";
import { Shell } from "../Shell.jsx";
import { createCloudShare } from "./cloud-send.js";
import { startDirectShare } from "./direct-send.js";
import { attachToPairedReceiver } from "./paired-receiver.js";
import { isCameraScanSupported, scanReceiverCode } from "./scan-receiver.js";
import { attachSenderCode, readSenderJoin } from "./sender-code.js";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function fileBadge(name) {
  const extension = (name.split(".").pop() || "").toUpperCase();
  return extension.length > 0 && extension.length <= 4 ? extension : "FILE";
}

function codeStatusText(session) {
  if (!session) return "";
  if (session.status === "waiting") return "";
  if (session.status === "joined") {
    return "A device joined. Check the key below, then choose whether to share.";
  }
  if (session.status === "attaching") {
    return "Sharing the key with this device…";
  }
  if (session.status === "attached") {
    return "Receiver joined — files unlocked.";
  }
  if (session.status === "cancelling") {
    return "Cancelling this code…";
  }
  if (session.status === "cancelled") {
    return "Code cancelled — send the link instead.";
  }
  if (session.status === "expired") {
    return "Code expired — send the link instead.";
  }
  return "Code pairing failed — send the link instead.";
}

export function SendScreen() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState("cloud");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  const [codeSession, setCodeSession] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState("");
  const videoRef = useRef(null);
  const cancelScanRef = useRef(null);

  const directSupported = useMemo(() => isP2pSupported(), []);
  const cipherVersion = mode === "direct" ? 1 : 2;
  const validation = useMemo(
    () => validateSelection(files, "cloud", false, cipherVersion),
    [files, cipherVersion],
  );
  const totalEncrypted = files.reduce(
    (sum, file) => sum + encryptedSize(file.size, cipherVersion),
    0,
  );
  const busy = phase === "encrypting" || phase === "uploading";

  useEffect(() => {
    if (!result) return undefined;
    const tick = () =>
      setRemaining(Math.ceil((result.expiresAt - Date.now()) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [result?.expiresAt]);

  useEffect(() => {
    if (!result) return undefined;
    let cancelled = false;
    let pollTimer;
    let expiryTimer;
    const api = new LynkApi({ baseUrl: resolveApiBase() });

    async function start() {
      try {
        const session = await api.createSenderSession();
        if (cancelled) return;
        const lifetime = session.expiresIn || 600;
        setCodeSession({
          ...session,
          status: "waiting",
          expiresAt: Date.now() + lifetime * 1000,
        });
        expiryTimer = window.setTimeout(() => {
          if (cancelled) return;
          setCodeSession((current) =>
            current?.status === "waiting" || current?.status === "joined"
              ? { ...current, status: "expired", receiverPk: null }
              : current,
          );
        }, lifetime * 1000);

        const poll = async () => {
          if (cancelled) return;
          try {
            const join = await readSenderJoin({
              api,
              sessionId: session.sessionId,
            });
            if (cancelled) return;
            if (join) {
              setCodeSession((current) =>
                current
                  ? {
                      ...current,
                      status: "joined",
                      fingerprint: join.fingerprint,
                      receiverPk: join.receiverPk,
                    }
                  : current,
              );
              return;
            }
          } catch {
            if (!cancelled) {
              setCodeSession((current) =>
                current ? { ...current, status: "error" } : current,
              );
            }
            return;
          }
          if (!cancelled) pollTimer = window.setTimeout(poll, 2000);
        };

        pollTimer = window.setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setCodeSession(null);
      }
    }

    start();
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
      window.clearTimeout(expiryTimer);
    };
  }, [result?.transferId, result?.key, result?.accessToken, result?.mode]);

  useEffect(() => {
    if (!scannerOpen) return undefined;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return undefined;

    scanReceiverCode(video, {
      onCancel: (cleanup) => {
        cancelScanRef.current = cleanup;
      },
    })
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setScannerOpen(false);
          return;
        }
        const parsed = parseReceiverQrLink(new URL(raw));
        if (!parsed.sessionId || !parsed.publicKeyB64) {
          setScannerOpen(false);
          setScanError("That QR code is not a LynkShare receiver code.");
          return;
        }
        setScanError("");
        setScannerOpen(false);
        attachScannedReceiver(parsed);
      })
      .catch((err) => {
        if (cancelled) return;
        setScannerOpen(false);
        setScanError(`Camera unavailable: ${err?.message ?? "permission denied"}`);
      });

    return () => {
      cancelled = true;
      cancelScanRef.current?.();
      cancelScanRef.current = null;
    };
  }, [scannerOpen]);

  function reportProgress(event) {
    if (event.phase) setPhase(event.phase);
    if (typeof event.progress === "number") setProgress(event.progress);
    if (event.label) setLabel(event.label);
  }

  function updateStatus(status) {
    setResult((current) => (current ? { ...current, status } : current));
  }

  function addFiles(incoming) {
    const next = [...files, ...Array.from(incoming ?? [])];
    setFiles(next);
    setCopied(false);
    setError("");
    setNotice("");
  }

  function removeFile(index) {
    if (busy) return;
    setFiles(files.filter((_, i) => i !== index));
  }

  function recordSend(transferId, names, totalSize, status) {
    new HistoryStore().add({
      id: transferId,
      type: "sent",
      fileNames: names,
      totalSize,
      timestamp: Date.now(),
      status,
    });
  }

  function resetSendForm(message = "") {
    setResult(null);
    setFiles([]);
    setPhase("idle");
    setProgress(0);
    setLabel("");
    setCopied(false);
    setCodeSession(null);
    setConfirmClose(false);
    setScanError("");
    setScannerOpen(false);
    setNotice(message);
  }

  async function attachScannedReceiver(pair) {
    if (!result) return;
    try {
      await attachToPairedReceiver({
        api: new LynkApi({ baseUrl: resolveApiBase() }),
        pair,
        transferId: result.transferId,
        key: result.key,
        accessToken: result.accessToken,
      });
      setScanError("");
      updateStatus("Sent to the paired receiver.");
    } catch {
      setScanError("Could not attach to that receiver. Share the link instead.");
    }
  }

  async function startCloud() {
    if (!validation.ok || busy) return;
    setError("");
    setCopied(false);
    setPhase("encrypting");
    setProgress(0);

    try {
      const api = new LynkApi({ baseUrl: resolveApiBase() });
      const share = await createCloudShare({
        files,
        api,
        origin: window.location.origin,
        onProgress: reportProgress,
      });

      setResult({
        ...share,
        mode: "cloud",
        status: "",
        expiresAt: Date.now() + share.expiresIn * 1000,
      });
      setPhase("done");
      recordSend(
        share.transferId,
        share.fileNames,
        share.totalSize,
        "completed (cloud)",
      );
    } catch (err) {
      setPhase("idle");
      setLabel("");
      setProgress(0);
      setError(
        err instanceof LimitExceededError
          ? err.message
          : "Upload failed — check your connection and try again.",
      );
    }
  }

  async function startDirect() {
    if (!validation.ok || busy || !directSupported) return;
    setError("");
    setCopied(false);
    setPhase("encrypting");
    setProgress(0);

    try {
      const api = new LynkApi({ baseUrl: resolveApiBase() });
      const { delivered, session, share } = await startDirectShare({
        files,
        origin: window.location.origin,
        api,
        apiBase: resolveApiBase(),
        onProgress: reportProgress,
        onReady: (ready) => {
          setResult({
            ...ready,
            mode: "direct",
            status: "Waiting for the receiver to connect…",
            expiresAt: Date.now() + ready.expiresIn * 1000,
          });
          setPhase("waiting");
        },
        onStatus: (event, detail) => {
          if (event === "p2p-connected") {
            updateStatus("Receiver connected. Sending directly…");
          } else if (event === "p2p-sending") {
            updateStatus(`Sending ${detail?.name ?? "files"} directly…`);
          } else if (event === "p2p-confirming") {
            updateStatus("Waiting for the receiver to confirm every file…");
          } else if (event === "p2p-delivered") {
            updateStatus("Delivered directly.");
          } else if (
            typeof event === "string" &&
            event.startsWith("p2p-failed")
          ) {
            updateStatus("Direct failed — uploading the cloud copy…");
          }
        },
      });

      if (delivered) {
        setPhase("done");
        updateStatus("Delivered directly. The receiver has every file.");
        recordSend(
          session.transferId,
          share.fileNames,
          share.totalSize,
          "completed (p2p)",
        );
        return;
      }

      setPhase("done");
      updateStatus("Uploaded. The link now works from the cloud.");
      recordSend(
        session.transferId,
        share.fileNames,
        share.totalSize,
        "completed (cloud)",
      );
    } catch (err) {
      setPhase("idle");
      setLabel("");
      setProgress(0);
      setResult(null);
      setError(
        err instanceof LimitExceededError
          ? err.message
          : "Transfer failed — check your connection and try again.",
      );
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", result.link);
    }
  }

  async function extendSession() {
    if (!result) return;
    try {
      const extended = await new LynkApi({
        baseUrl: resolveApiBase(),
      }).extendTransfer(result.transferId, result.senderSecret);
      setResult((current) => ({
        ...current,
        expiresIn: extended.expiresIn,
        expiresAt: Date.now() + extended.expiresIn * 1000,
        status: "Session extended.",
      }));
    } catch {
      updateStatus("Could not extend the session.");
    }
  }

  async function shareWithCodeDevice() {
    if (!result || !codeSession?.receiverPk) return;
    setCodeSession((current) =>
      current ? { ...current, status: "attaching" } : current,
    );
    try {
      await attachSenderCode({
        api: new LynkApi({ baseUrl: resolveApiBase() }),
        session: codeSession,
        transferId: result.transferId,
        key: result.key,
        accessToken: result.accessToken,
        mode: result.mode === "direct" ? "p2p" : "cloud",
        receiverPk: codeSession.receiverPk,
      });
      setCodeSession((current) =>
        current ? { ...current, status: "attached" } : current,
      );
    } catch {
      setCodeSession((current) =>
        current ? { ...current, status: "error" } : current,
      );
    }
  }

  async function rejectCodeDevice() {
    if (!codeSession?.sessionId) return;
    setCodeSession((current) =>
      current ? { ...current, status: "cancelling" } : current,
    );
    try {
      await new LynkApi({
        baseUrl: resolveApiBase(),
      }).cancelSenderSession(codeSession.sessionId, codeSession.senderSecret);
      setCodeSession((current) =>
        current
          ? { ...current, status: "cancelled", code: "", receiverPk: null }
          : current,
      );
    } catch {
      setCodeSession((current) =>
        current ? { ...current, status: "error" } : current,
      );
    }
  }

  async function closeSession() {
    if (!result || closing) return;
    setClosing(true);
    try {
      const api = new LynkApi({ baseUrl: resolveApiBase() });
      await api.cancelTransfer(result.transferId, result.senderSecret);
      if (codeSession?.sessionId && codeSession?.senderSecret) {
        await api
          .cancelSenderSession(codeSession.sessionId, codeSession.senderSecret)
          .catch(() => {});
      }
      resetSendForm("Session closed.");
    } catch {
      updateStatus("Could not close the session. Try again.");
      setConfirmClose(false);
    } finally {
      setClosing(false);
    }
  }

  if (result) {
    return (
      <Shell eyebrow="Send" title="They can open this link.">
        <div className="result">
          <div className="qr" aria-label="Share link QR code">
            <QRCodeSVG value={result.link} size={220} level="M" />
          </div>
          <p className="hint">Scan this code, or copy the link.</p>
          {result.status && (
            <p className="hint" role="status">
              {result.status}
            </p>
          )}
          <p className="hint" role="status">
            {remaining > 0
              ? `Session ends in ${formatTime(remaining)}.`
              : "This session has expired."}
          </p>
          {codeSession && (
            <div className="code-panel">
              {codeSession.code && (
                <>
                  <p className="hint">Or the receiver can enter this code</p>
                  <p className="sender-code" aria-label="Six-digit code">
                    {codeSession.code}
                  </p>
                </>
              )}
              {codeStatusText(codeSession) && (
                <p
                  className={
                    codeSession.status === "error" ? "error" : "hint"
                  }
                  role="status"
                >
                  {codeStatusText(codeSession)}
                </p>
              )}
              {codeSession.fingerprint && (
                <p className="hint">Key check {codeSession.fingerprint}</p>
              )}
              {codeSession.status === "joined" && (
                <div className="actions">
                  <button
                    className="primary"
                    type="button"
                    onClick={shareWithCodeDevice}
                  >
                    Share with this device
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={rejectCodeDevice}
                  >
                    Not this device
                  </button>
                </div>
              )}
            </div>
          )}
          {isCameraScanSupported() && (
            <div className="scan-row">
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setScanError("");
                  setScannerOpen(true);
                }}
              >
                Scan receiver QR
              </button>
              {scanError && <p className="error">{scanError}</p>}
            </div>
          )}
          {scannerOpen && (
            <div className="scanner-card">
              <video ref={videoRef} playsInline muted />
              <p className="hint">Point the camera at the receiver QR code.</p>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  cancelScanRef.current?.();
                  setScannerOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {phase === "uploading" && (
            <div className="progress" role="status" aria-live="polite">
              <span>{label || "Uploading…"}</span>
              <span>{Math.round(progress * 100)}%</span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
          <button className="primary" type="button" onClick={copyLink}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={extendSession}
            disabled={remaining <= 0}
          >
            Extend to 30 minutes
          </button>
          {!confirmClose ? (
            <button
              className="secondary"
              type="button"
              onClick={() => setConfirmClose(true)}
            >
              Close session
            </button>
          ) : (
            <div className="close-panel">
              <p className="hint">Close this session for everyone?</p>
              <div className="actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  disabled={closing}
                >
                  Keep open
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={closeSession}
                  disabled={closing}
                >
                  {closing ? "Closing…" : "Close session"}
                </button>
              </div>
            </div>
          )}
          <p className="hint">Leave this tab open. A reload needs a new link.</p>
          <button
            className="secondary"
            type="button"
            onClick={() => resetSendForm()}
          >
            Create another
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Send" title="You are sending.">
      <p className="lead">
        Up to {maxTotalSize("cloud", false) / (1024 * 1024)} MB on the web.
      </p>

      {notice && (
        <p className="hint" role="status">
          {notice}
        </p>
      )}

      <div
        className={dragging ? "drop-zone drag-active" : "drop-zone"}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <label className="file-picker" htmlFor="send-files">
          Choose files
        </label>
        <input
          className="file-input"
          id="send-files"
          type="file"
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <p className="hint">Drop files here, or choose up to 10 files.</p>
      </div>

      {files.length > 0 && (
        <ul className="file-list" aria-label="Selected files">
          {files.map((file, index) => (
            <li className="file-row" key={`${file.name}-${index}`}>
              <span className="file-name-cell">
                <span className="file-badge">{fileBadge(file.name)}</span>
                <span>
                  <strong>{file.name}</strong>
                  <small>{formatBytes(file.size)}</small>
                </span>
              </span>
              <button
                className="link-button"
                type="button"
                onClick={() => removeFile(index)}
                disabled={busy}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p
        className={validation.ok || files.length === 0 ? "hint" : "error"}
        role="status"
      >
        {files.length === 0
          ? "Pick at least one file."
          : validation.ok
            ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(totalEncrypted)} encrypted`
            : validation.reason}
      </p>

      {files.length > 0 && (
        <>
          <p className="hint">
            Choose how to send {files.length === 1 ? "this file" : "these files"}.
          </p>

          <div className="choices" role="group" aria-label="Transfer mode">
            <button
              className={
                mode === "direct" ? "choice choice-selected" : "choice"
              }
              type="button"
              onClick={() => setMode("direct")}
              disabled={busy || !directSupported}
              aria-pressed={mode === "direct"}
            >
              <strong>Direct</strong>
              <span>
                {directSupported
                  ? "Both devices connect and the file streams peer to peer. Falls back to Cloud."
                  : "Direct needs WebRTC in this browser. Use Cloud instead."}
              </span>
            </button>
            <button
              className={mode === "cloud" ? "choice choice-selected" : "choice"}
              type="button"
              onClick={() => setMode("cloud")}
              disabled={busy}
              aria-pressed={mode === "cloud"}
            >
              <strong>Cloud</strong>
              <span>The link works while the 10-minute session is open.</span>
            </button>
          </div>

          {busy && (
            <div className="progress" role="status" aria-live="polite">
              <span>{label || "Working…"}</span>
              <span>{Math.round(progress * 100)}%</span>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button
            className="primary"
            type="button"
            onClick={mode === "direct" ? startDirect : startCloud}
            disabled={
              !validation.ok || busy || (mode === "direct" && !directSupported)
            }
          >
            {busy
              ? "Working…"
              : mode === "direct"
                ? "Start direct transfer"
                : "Create link"}
          </button>
        </>
      )}
    </Shell>
  );
}
