import Link from "next/link";

export function Nav() {
  return (
    <nav className="flex items-center gap-6">
      <Link
        href="/"
        className="hover:text-primary text-sm font-medium transition-colors"
      >
        Home
      </Link>
      <Link
        href="/dashboard"
        className="hover:text-primary text-sm font-medium transition-colors"
      >
        Dashboard
      </Link>
      <Link
        href="/upload"
        className="hover:text-primary text-sm font-medium transition-colors"
      >
        Upload
      </Link>
    </nav>
  );
}
