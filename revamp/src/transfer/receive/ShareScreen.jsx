import { useEffect, useMemo, useState } from "react";
import {
  HistoryStore,
  LynkApi,
  parseFileFragment,
  resolveApiBase,
} from "../../engine/index.js";
import { Shell } from "../Shell.jsx";
import { bootFragment } from "../boot-link.js";
import { downloadShare, loadTransferMetadata } from "./share-receive.js";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveToBrowser({ name, bytes }) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ShareScreen({ transferId }) {
  const link = useMemo(() => parseFileFragment(bootFragment), []);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState([]);

  const hasKey = Boolean(link.key);
  const hasToken = Boolean(link.accessToken);
  const api = useMemo(
    () => new LynkApi({ baseUrl: resolveApiBase() }),
    [],
  );

  useEffect(() => {
    if (!hasKey || !hasToken) return;
    let cancelled = false;
    setBusy(true);
    loadTransferMetadata({ api, transferId, accessToken: link.accessToken })
      .then((next) => {
        if (!cancelled) setMetadata(next);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Transfer not found or expired. Ask the sender for a fresh link.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, hasKey, hasToken, link.accessToken, transferId]);

  async function download() {
    if (!hasKey || !hasToken || busy) return;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const names = await downloadShare({
        api,
        transferId,
        accessToken: link.accessToken,
        key: link.key,
        save: saveToBrowser,
        onProgress: ({ progress: nextProgress, label: nextLabel }) => {
          setProgress(nextProgress);
          setLabel(nextLabel);
        },
      });
      setSaved(names);
      new HistoryStore().add({
        id: transferId,
        type: "received",
        fileNames: names,
        totalSize: metadata?.total_size ?? 0,
        timestamp: Date.now(),
        status: "completed (cloud)",
      });
    } catch {
      setError("Download failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasKey) {
    return (
      <Shell eyebrow="Receive" title="This link is missing its key.">
        <p className="error">
          Open the original link. A reload cannot restore the key from storage.
        </p>
      </Shell>
    );
  }

  if (!hasToken) {
    return (
      <Shell eyebrow="Receive" title="This link cannot open.">
        <p className="error">
          This link is missing its access token. Ask the sender for a fresh link.
        </p>
      </Shell>
    );
  }

  if (saved.length > 0) {
    return (
      <Shell eyebrow="Receive" title="Saved.">
        <p className="lead">
          {saved.length} file{saved.length === 1 ? "" : "s"} handed to the browser.
        </p>
        <ul className="file-list">
          {saved.map((name) => (
            <li className="file-row" key={name}>
              <strong>{name}</strong>
            </li>
          ))}
        </ul>
        <p className="hint">
          The browser saved the file. If it asked where to save, check that
          folder.
        </p>
      </Shell>
    );
  }

  const files = metadata?.files ?? [];
  const names = files.map((file) => file.file_name);

  return (
    <Shell eyebrow="Receive" title="Ready to download.">
      {metadata ? (
        <>
          <p className="lead">
            {files.length === 1 ? files[0].file_name : `${files.length} files`}
          </p>
          <p className="hint">
            {files.length === 1
              ? formatBytes(files[0].file_size)
              : `${names.join(", ")} · ${formatBytes(metadata.total_size)} total`}
          </p>
          {metadata.status !== "ready" && (
            <p className="hint" role="status">
              The sender is still uploading. Try again in a moment.
            </p>
          )}
        </>
      ) : (
        <p className="hint" role="status">
          {busy ? "Checking the transfer…" : "Preparing the download."}
        </p>
      )}

      {busy && label && (
        <div className="progress" role="status" aria-live="polite">
          <span>{label}</span>
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
        onClick={download}
        disabled={busy || metadata?.status !== "ready"}
      >
        {busy ? "Working…" : "Save file"}
      </button>
      <p className="hint">
        The key is read from the original link and never stored.
      </p>
    </Shell>
  );
}
