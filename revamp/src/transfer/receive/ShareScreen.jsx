import { useEffect, useMemo, useRef, useState } from "react";
import {
  HistoryStore,
  LynkApi,
  acquireReceiverOwnership,
  isP2pSupported,
  parseFileFragment,
  resolveApiBase,
} from "../../engine/index.js";
import { Shell } from "../Shell.jsx";
import { AppPromo } from "../../components/AppPromo.jsx";
import { bootFragment } from "../boot-link.js";
import { receiveDirectOnce } from "./receive-flow.js";
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

function describeFailure(err) {
  if (err?.status === 409 || err?.name === "TransferStillUploadingError") {
    return "The sender is still uploading. Wait a moment and try again.";
  }
  if (err?.status === 404 || err?.name === "TransferNotFoundError") {
    return "Transfer not found or expired. Ask the sender for a fresh link.";
  }
  return "Download failed. Check your connection and try again.";
}

export function ShareScreen({ transferId }) {
  const link = useMemo(() => parseFileFragment(bootFragment), []);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState([]);
  const [partial, setPartial] = useState([]);
  const cancelDirect = useRef(null);

  const hasKey = Boolean(link.key);
  const hasToken = Boolean(link.accessToken);
  const api = useMemo(
    () => new LynkApi({ baseUrl: resolveApiBase() }),
    [],
  );

  useEffect(() => {
    if (!hasKey || !hasToken) return undefined;
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

  useEffect(() => {
    const stop = () => cancelDirect.current?.();
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      cancelDirect.current?.();
    };
  }, []);

  function record(names, statusText) {
    new HistoryStore().add({
      id: transferId,
      type: "received",
      fileNames: names,
      totalSize: metadata?.total_size ?? 0,
      timestamp: Date.now(),
      status: statusText,
    });
  }

  async function download() {
    if (!hasKey || !hasToken || busy || !metadata) return;
    setBusy(true);
    setError("");
    setProgress(0);
    setStatus("");
    setPartial([]);

    try {
      if (metadata.status !== "ready" && isP2pSupported()) {
        const apiBase = resolveApiBase();
        const ownership = await acquireReceiverOwnership({
          apiBase,
          transferId,
        });
        if (ownership.status === "busy") {
          setError(
            "This transfer is already receiving in another tab. Finish or close that tab, then try again.",
          );
          return;
        }

        try {
          const attempt = receiveDirectOnce({
            apiBase,
            transferId,
            accessToken: link.accessToken,
            aesKey: link.key,
            expectedFiles: Math.max(
              metadata.total_files ?? metadata.files?.length ?? 1,
              1,
            ),
            expectedBytes:
              metadata.total_size > 0
                ? metadata.total_size + 1024
                : undefined,
            onStatus: (event, info) => {
              if (event === "p2p-connected") {
                setStatus("Connected. Receiving directly…");
                setLabel("Receiving directly…");
              } else if (event === "p2p-header" && info?.name) {
                setLabel(`Receiving ${info.name}…`);
              }
            },
            onProgress: ({ received, expected }) => {
              if (expected > 0) {
                setProgress(Math.min((received / expected) * 0.9, 0.9));
                setLabel(
                  `${formatBytes(received)} of ${formatBytes(expected)}`,
                );
              }
            },
            onSave: saveToBrowser,
          });
          cancelDirect.current = attempt.cancel;

          try {
            const result = await attempt.promise;
            if (result.status === "cancelled") return;
            if (result.status === "delivered") {
              setSaved(result.names);
              record(result.names, "completed (p2p)");
              return;
            }
            if (result.names.length > 0) {
              setPartial(result.names);
              setError(
                "Some files were handed to the browser. Check Downloads before retrying.",
              );
              return;
            }
          } finally {
            cancelDirect.current = null;
            await ownership.release?.();
          }
        } catch (err) {
          setError(describeFailure(err));
          return;
        }

        setStatus("Direct did not connect. Waiting for the sender's cloud copy…");
      }

      setLabel("Waiting for the sender…");
      const names = await downloadShare({
        api,
        transferId,
        accessToken: link.accessToken,
        key: link.key,
        version: link.version,
        save: saveToBrowser,
        waitForReady: metadata.status !== "ready",
        onWait: () => setLabel("The sender is still uploading…"),
        onProgress: ({ progress: nextProgress, label: nextLabel }) => {
          setProgress(nextProgress);
          if (nextLabel) setLabel(nextLabel);
        },
      });
      setSaved(names);
      record(names, "completed (cloud)");
    } catch (err) {
      setError(describeFailure(err));
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
        <AppPromo />
      </Shell>
    );
  }

  if (partial.length > 0) {
    return (
      <Shell eyebrow="Receive" title="Some files were saved.">
        <p className="hint">
          The direct connection stopped after these files reached the browser.
          Check Downloads before trying again.
        </p>
        <ul className="file-list">
          {partial.map((name) => (
            <li className="file-row" key={name}>
              <strong>{name}</strong>
            </li>
          ))}
        </ul>
        <button
          className="primary"
          type="button"
          onClick={() => {
            setPartial([]);
            setError("");
            download();
          }}
        >
          Retry
        </button>
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
              {isP2pSupported()
                ? "The sender is waiting for a direct connection. Save file starts it."
                : "The sender is still uploading. Save file waits for the cloud copy."}
            </p>
          )}
        </>
      ) : (
        <p className="hint" role="status">
          {busy ? "Checking the transfer…" : "Preparing the download."}
        </p>
      )}

      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}

      {(busy && label) && (
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
        disabled={busy || !metadata}
      >
        {busy ? "Working…" : "Save file"}
      </button>
    </Shell>
  );
}
