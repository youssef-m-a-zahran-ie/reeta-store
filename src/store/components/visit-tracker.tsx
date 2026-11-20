"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { sendVisit } from "../visits";

const PING = 2 * 60 * 1000;

/** One page event per page the shopper opens (in-app navigation included), and a light "still here" every
 *  2 minutes while the tab is on screen, so someone reading one page stays on the Live view. */
export function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    sendVisit("page");
  }, [path]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") sendVisit("ping");
    }, PING);
    return () => clearInterval(t);
  }, []);
  return null;
}
