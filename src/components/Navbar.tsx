import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Shield, Trophy, Calendar, Users, MapPin, LogOut, User as UserIcon, ShieldAlert } from "lucide-react";

export function Navbar() {
  const { user, profile, isAuthenticated, isAdmin, isVenueManager, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <Trophy className="h-5 w-5" />
            </span>
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              PlaySphere
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground ml-0.5">Connect</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/venues" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <MapPin className="h-4 w-4" /> Venues
            </Link>
            <Link to="/events" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Calendar className="h-4 w-4" /> Events
            </Link>
            <Link to="/players" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Users className="h-4 w-4" /> Players
            </Link>

            {isAdmin && (
              <div className="flex items-center gap-3 pl-4 border-l border-border">
                <Link to="/admin/users" className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300">
                  <Shield className="h-3.5 w-3.5" /> Users
                </Link>
                <Link to="/admin/audit" className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                  <Shield className="h-3.5 w-3.5" /> Audit Logs
                </Link>
                <Link to="/admin/alerts" className="flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300">
                  <ShieldAlert className="h-3.5 w-3.5" /> Alerts
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-semibold text-foreground">{profile?.full_name || user?.email}</span>
                <div className="flex items-center gap-1">
                  {isAdmin && <Badge variant="destructive" className="h-4 text-[10px] px-1 py-0">ADMIN</Badge>}
                  {isVenueManager && !isAdmin && <Badge variant="secondary" className="h-4 text-[10px] px-1 py-0">MANAGER</Badge>}
                  {!isVenueManager && !isAdmin && <Badge variant="outline" className="h-4 text-[10px] px-1 py-0">PLAYER</Badge>}
                </div>
              </div>

              <Link to="/profile">
                <Button variant="outline" size="sm" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>
              </Link>

              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="neon" size="sm">
                  Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
