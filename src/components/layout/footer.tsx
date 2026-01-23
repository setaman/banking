export function Footer() {
  return (
    <footer className="border-border/40 bg-background border-t">
      <div className="container flex h-16 items-center justify-center">
        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} BanKing. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
