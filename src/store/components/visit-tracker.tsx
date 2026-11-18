"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { sendVisit } from "../visits";

/** One page event per page the shopper opens (in-app navigation included). */
export function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    sendVisit("page");
  }, [path]);
  return null;
}
