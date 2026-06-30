import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 font-mono text-sm text-brand">404</p>
      <h1 className="mb-3 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mb-8 max-w-sm text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
        Back home
      </Link>
    </main>
  );
}
