"use client";

import { useEffect } from "react";
import { stopTracking } from "@/store/visits";

/** A browser that opens the admin is the team's own: leave its store visits out of Analytics. */
export function NoTrack() {
  useEffect(() => stopTracking(), []);
  return null;
}
