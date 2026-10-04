import { ShieldCheck, Trophy } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/50 py-10 mt-20">
      <div className="container max-w-7xl px-4 sm:px-8 mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Trophy className="h-4 w-4" />
          </span>
          <span className="font-display font-bold text-foreground">PlaySphere Connect</span>
          <span className="text-xs text-muted-foreground ml-2">© 2026 All Rights Reserved</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Hardened RS256 JWT &amp; ModSecurity WAF Protection</span>
          </div>
          <span>•</span>
          <span>NIST SP 800-63B Authentication</span>
        </div>
      </div>
    </footer>
  );
}
