import { useEffect, useState } from "react";
import { parseTransferRoute } from "./router.js";
import {
  ErrorScreen,
  LegacyRedirect,
  MarketingRedirect,
  NotFound,
  PairingScreen,
  ReceiveScreen,
  SendScreen,
  ShareScreen,
} from "./screens.jsx";

function currentRoute() {
  return parseTransferRoute(window.location.pathname, window.location.hash);
}

export function TransferApp() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);

  switch (route.kind) {
    case "send":
      return <SendScreen />;
    case "receive":
      return <ReceiveScreen />;
    case "share":
      return <ShareScreen transferId={route.transferId} />;
    case "pairing":
      return <PairingScreen route={route} />;
    case "legacy":
      return <LegacyRedirect path={route.path} />;
    case "error":
      return <ErrorScreen reason={route.reason} />;
    case "marketing":
      return <MarketingRedirect />;
    case "not-found":
      return <NotFound />;
    default:
      return <NotFound />;
  }
}
