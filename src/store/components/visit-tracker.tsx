"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startLiveSignals } from "../events";
import { sendVisit } from "../visits";

/** One page event per page the shopper opens (in-app navigation included), plus the Live view's "still here" signal
 *  and the WhatsApp / language clicks (see events.ts). */
export function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    sendVisit("page");
  }, [path]);
  useEffect(() => startLiveSignals(), []);
  return null;
}
