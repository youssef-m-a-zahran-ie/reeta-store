"use client";

import { useState } from "react";

export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard blocked: the number is selectable text next to the button.
        }
      }}
      className="rounded-full border-2 border-plum px-4 py-1.5 font-display text-sm font-semibold text-plum hover:bg-blush"
    >
      {copied ? done : label}
    </button>
  );
}
