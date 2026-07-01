export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-8">
          <span className="font-display text-sm font-semibold text-foreground">DataBrief</span>
          <div className="hidden items-center gap-6 sm:flex">
            <span className="font-mono text-xs text-muted-foreground">VERSION  1.0.0</span>
            <span className="font-mono text-xs text-muted-foreground">BUILD  stable</span>
            <span className="font-mono text-xs text-muted-foreground">DATA  SEC EDGAR</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="mailto:ratibkhan907@gmail.com"
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            CONTACT
          </a>
          <a
            href="https://github.com/son1cleo"
            className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            GITHUB
          </a>
        </div>
      </div>
    </footer>
  );
}
