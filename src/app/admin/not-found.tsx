import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main className="dot-grid grid min-h-screen place-items-center bg-page px-4 text-center">
      <div className="grid justify-items-center gap-4">
        <span className="mark mark-full size-16 text-plum" aria-hidden="true" />
        <h1 className="text-3xl font-semibold">Not found</h1>
        <p className="text-muted">This page doesn&apos;t exist, or the record was deleted.</p>
        <Link href="/admin" className="btn btn-primary">
          Back to the overview
        </Link>
      </div>
    </main>
  );
}
