import { useEffect, useRef } from "react";
import { PLAY_URL } from "./play-url.js";

export function AppPromo() {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="promo"
      aria-labelledby="app-promo-title"
    >
      <p className="eyebrow">Android app</p>
      <h2 id="app-promo-title">Get LynkShare for Android.</h2>
      <p>
        Higher size limits, fewer ads, and the same no-account flow in a native
        app.
      </p>
      <div className="actions">
        <a
          className="primary"
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get it on Google Play
        </a>
        <button
          className="secondary"
          type="button"
          onClick={() => dialogRef.current?.close()}
        >
          Continue on the web
        </button>
      </div>
    </dialog>
  );
}
