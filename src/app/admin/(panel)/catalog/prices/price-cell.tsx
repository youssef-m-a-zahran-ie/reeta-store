"use client";

import { useState } from "react";
import { margin } from "@/lib/format";

/** Price + cost inputs for one size, with a live margin. */
export function PriceCell({
  templateId,
  valueId,
  price,
  cost,
}: {
  templateId: string;
  valueId: string;
  price: number | null;
  cost: number | null;
}) {
  const [p, setP] = useState(price?.toString() ?? "");
  const [c, setC] = useState(cost?.toString() ?? "");
  const m = margin(p === "" ? null : Number(p), c === "" ? null : Number(c));
  return (
    <div className="grid w-32 gap-1.5">
      <label className="grid gap-0.5">
        <span className="text-[11px] font-semibold text-plum">Price</span>
        <input
          className="input num py-1.5"
          name={`price:${templateId}:${valueId}`}
          inputMode="decimal"
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="EGP"
        />
      </label>
      <label className="grid gap-0.5">
        <span className="text-[11px] font-semibold text-muted">Cost</span>
        <input
          className="input num py-1.5"
          name={`cost:${templateId}:${valueId}`}
          inputMode="decimal"
          value={c}
          onChange={(e) => setC(e.target.value)}
          placeholder="EGP"
        />
      </label>
      <span className={`num text-xs font-semibold ${m === null ? "text-muted" : m < 30 ? "text-[#a33a52]" : "text-[#56633a]"}`}>
        {m === null ? "Margin —" : `Margin ${m}%`}
      </span>
    </div>
  );
}
