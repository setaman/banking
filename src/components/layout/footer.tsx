export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container flex h-16 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} BanKing. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
