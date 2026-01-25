export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-background/30 backdrop-blur-md mt-auto">
      <div className="container flex h-16 items-center justify-center">
        <p className="text-muted-foreground text-sm font-medium">
          © {new Date().getFullYear()} BanKing. Crafted for the future.
        </p>
      </div>
    </footer>
  );
}
