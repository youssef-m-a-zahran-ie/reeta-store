"use client";

import { useEffect } from "react";
import { captureUtm } from "../utm";

export function UtmCapture() {
  useEffect(() => {
    captureUtm();
  }, []);
  return null;
}
