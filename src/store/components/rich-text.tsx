import type { ReactNode } from "react";

/**
 * Renders page text written in the admin. An empty line starts a new block,
 * "## " starts a heading and "- " starts a bullet. Everything else is a paragraph.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => {
      if (para.length) out.push(<p key={`p${bi}-${out.length}`}>{para.join("\n")}</p>);
      para = [];
    };
    const flushList = () => {
      if (list.length)
        out.push(
          <ul key={`u${bi}-${out.length}`} className="grid gap-2">
            {list.map((li, i) => (
              <li key={i} className="relative ps-6">
                <span className="absolute top-[0.62em] start-0 size-2.5 rounded-full bg-rose/80 shadow-[inset_-1px_-2px_0_rgb(0_0_0/.15)]" aria-hidden="true" />
                {li}
              </li>
            ))}
          </ul>,
        );
      list = [];
    };
    for (const line of lines) {
      if (line.startsWith("## ")) {
        flushPara();
        flushList();
        out.push(
          <h2 key={`h${bi}-${out.length}`} className="reveal pt-4 text-2xl font-semibold md:text-[28px]">
            {line.slice(3).trim()}
          </h2>,
        );
      } else if (line.startsWith("- ")) {
        flushPara();
        list.push(line.slice(2).trim());
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  });
  return <div className={`grid gap-5 whitespace-pre-line ${className}`}>{out}</div>;
}
