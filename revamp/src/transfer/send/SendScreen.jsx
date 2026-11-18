import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  HistoryStore,
  LimitExceededError,
  LynkApi,
  encryptedSize,
  isP2pSupported,
  maxTotalSize,
  resolveApiBase,
  validateSelection,
} from "../../engine/index.js";
import { Shell } from "../Shell.jsx";
import { createCloudShare } from "./cloud-send.js";
import { startDirectShare } from "./direct-send.js";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
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

  const directSupported = useMemo(() => isP2pSupported(), []);
  const validation = useMemo(
    () => validateSelection(files, "cloud", false),
    [files],
  );
  const totalEncrypted = files.reduce(
    (sum, file) => sum + encryptedSize(file.size),
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

  async function startCloud() {
    if (!validation.ok || busy) return;
    setError("");
    setCopied(false);
    setPhase("encrypting");
    setProgress(0);

    try {
      const share = await createCloudShare({
        files,
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

  if (result) {
    return (
      <Shell eyebrow="Send" title="They can open this link.">
        <div className="result">
          <div className="qr" aria-label="Share link QR code">
            <QRCodeSVG value={result.link} size={220} level="M" />
          </div>
          <p className="hint">
            Scan this code, or copy the link. The key stays in the link
            fragment.
          </p>
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
          <p className="hint">Leave this tab open. A reload needs a new link.</p>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setResult(null);
              setFiles([]);
              setPhase("idle");
              setProgress(0);
              setLabel("");
              setCopied(false);
            }}
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

      <div className="choices" role="group" aria-label="Transfer mode">
        <button
          className={mode === "direct" ? "choice choice-selected" : "choice"}
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

      <div
        className="drop-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
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
              <span>
                <strong>{file.name}</strong>
                <small>{formatBytes(file.size)}</small>
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

      {busy && (
        <div className="progress" role="status" aria-live="polite">
          <span>{label || "Working…"}</span>
          <span>{Math.round(progress * 100)}%</span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
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
        disabled={!validation.ok || busy || (mode === "direct" && !directSupported)}
      >
        {busy
          ? "Working…"
          : mode === "direct"
            ? "Start direct transfer"
            : "Create link"}
      </button>
    </Shell>
  );
}
