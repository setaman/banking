import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex items-center gap-6">
      <Link
        href="/"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Home
      </Link>
      <Link
        href="/dashboard"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Dashboard
      </Link>
      <Link
        href="/upload"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Upload
      </Link>
    </nav>
  );
}
