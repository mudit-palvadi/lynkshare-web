import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  HistoryStore,
  LimitExceededError,
  encryptedSize,
  maxTotalSize,
  validateSelection,
} from "../../engine/index.js";
import { Shell } from "../Shell.jsx";
import { createCloudShare } from "./cloud-send.js";

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
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);

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
    const deadline = Date.now() + result.expiresIn * 1000;
    const tick = () => setRemaining(Math.ceil((deadline - Date.now()) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [result]);

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

  async function createCloudLink() {
    if (!validation.ok || busy) return;
    setError("");
    setCopied(false);
    setPhase("encrypting");
    setProgress(0);

    try {
      const share = await createCloudShare({
        files,
        origin: window.location.origin,
        onProgress: ({ phase: nextPhase, progress: nextProgress, label: nextLabel }) => {
          setPhase(nextPhase);
          setProgress(nextProgress);
          setLabel(nextLabel);
        },
      });

      setResult({
        link: share.link,
        transferId: share.transferId,
        expiresIn: share.expiresIn,
      });
      new HistoryStore().add({
        id: share.transferId,
        type: "sent",
        fileNames: share.fileNames,
        totalSize: share.totalSize,
        timestamp: Date.now(),
        status: "completed (cloud)",
      });
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

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      setError("Could not copy the link. Try again.");
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
          <p className="hint" role="status">
            {remaining > 0
              ? `Session ends in ${formatTime(remaining)}.`
              : "This session has expired."}
          </p>
          <button className="primary" type="button" onClick={copyLink}>
            {copied ? "Link copied" : "Copy link"}
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
      <p className="lead">Up to {maxTotalSize("cloud", false) / (1024 * 1024)} MB on the web.</p>

      <div className="choices" role="group" aria-label="Transfer mode">
        <button className="choice" type="button" disabled>
          <strong>Direct</strong>
          <span>Direct transfer is next. Cloud is available now.</span>
        </button>
        <button className="choice choice-selected" type="button" aria-pressed="true">
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
        <label htmlFor="send-files">Choose files</label>
        <input
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

      <p className={validation.ok || files.length === 0 ? "hint" : "error"} role="status">
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

      {error && <p className="error" role="alert">{error}</p>}

      <button
        className="primary"
        type="button"
        onClick={createCloudLink}
        disabled={!validation.ok || busy}
      >
        {busy ? "Working…" : "Create link"}
      </button>
    </Shell>
  );
}
