"use client";

export function PrintButton() {
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => window.close()}>
        Close
      </button>
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        Print
      </button>
    </>
  );
}
