import React, { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { useMyBookings } from "../hooks/use-data";
import { api, Booking } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { ShieldCheck, ShieldAlert, KeyRound, Calendar, MapPin, Clock, CheckCircle, AlertCircle, Copy } from "lucide-react";

export default function ProfilePage() {
  const { user, profile, refreshUser } = useAuth();
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings();

  // MFA Enrollment Modal State
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [mfaHashedCodes, setMfaHashedCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState("");
  const [mfaEnrollLoading, setMfaEnrollLoading] = useState(false);
  const [mfaSuccessMsg, setMfaSuccessMsg] = useState<string | null>(null);
  const [mfaErrorMsg, setMfaErrorMsg] = useState<string | null>(null);

  const startMfaEnrollment = async () => {
    setMfaErrorMsg(null);
    setMfaEnrollLoading(true);
    try {
      const res = await api.auth.mfaEnroll();
      setMfaSecret(res.secret);
      setMfaQrCode(res.qrCodeDataUrl);
      setMfaBackupCodes(res.backupCodes);
      setMfaHashedCodes(res.hashedBackupCodes);
      setMfaModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate MFA keys";
      alert(msg);
    } finally {
      setMfaEnrollLoading(false);
    }
  };

  const confirmMfaEnrollment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMfaErrorMsg(null);
    setMfaEnrollLoading(true);

    try {
      await api.auth.mfaConfirm({
        code: confirmCode,
        hashedBackupCodes: mfaHashedCodes,
      });

      setMfaSuccessMsg("MFA successfully enabled! Your account is now protected with 2FA.");
      await refreshUser();
      setTimeout(() => {
        setMfaModalOpen(false);
        setMfaSuccessMsg(null);
        setConfirmCode("");
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code";
      setMfaErrorMsg(msg);
    } finally {
      setMfaEnrollLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Header Profile Section */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-card/60 p-6 rounded-2xl border border-border/50">
        <img
          src={profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb"}
          alt={profile?.full_name || "User Avatar"}
          className="h-24 w-24 rounded-full object-cover border-4 border-emerald-500 shadow-xl"
        />

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              {profile?.full_name || "Athlete Profile"}
            </h1>
            <Badge variant="neon" className="w-fit mx-auto sm:mx-0 uppercase">
              {user?.role || "user"}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
            <MapPin className="h-3.5 w-3.5 text-emerald-400" />
            {profile?.location || "New York, NY"}
          </p>

          <p className="text-xs text-foreground/80 max-w-xl pt-2">
            {profile?.bio || "Sports enthusiast on PlaySphere Connect."}
          </p>
        </div>

        <div className="bg-muted/40 p-4 rounded-xl border border-border/40 text-center min-w-[140px]">
          <span className="text-2xl font-bold text-emerald-400">{profile?.rating ? profile.rating.toFixed(1) : "5.0"}</span>
          <p className="text-[11px] text-muted-foreground">Community Rating</p>
          <p className="text-xs font-semibold text-foreground mt-1">{profile?.games_played || 0} Matches Played</p>
        </div>
      </div>

      {/* Grid: Reservations & Security Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Reservations (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-foreground">My Court Reservations</h2>
            <span className="text-xs text-muted-foreground">IDOR Protected</span>
          </div>

          {bookingsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : bookings && bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.map((booking: Booking) => (
                <Card key={booking.id} className="border-border/50 hover:border-emerald-500/40 transition-colors">
                  <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">{booking.venue_name || "Apex Sports Arena"}</span>
                        <Badge variant="outline" className="text-xs text-emerald-400 capitalize">
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-emerald-400" />
                        {booking.venue_address || "New York"}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-emerald-400" /> {booking.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-emerald-400" /> {booking.start_time} - {booking.end_time}
                        </span>
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-border/40 sm:pl-6">
                      <span className="text-xl font-bold text-emerald-400">${booking.total_price}</span>
                      <p className="text-[10px] text-muted-foreground font-mono">Ref: {booking.id.slice(0, 8)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed rounded-xl border-border text-muted-foreground">
              You have no active court reservations.
            </div>
          )}
        </div>

        {/* Security & MFA Settings (1 Col) */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-display font-bold text-foreground">Security Settings</h2>

          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  Two-Factor Authentication
                </CardTitle>
                {user?.mfa_enabled ? (
                  <Badge variant="neon" className="text-[10px]">ACTIVE</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">OFF</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                RFC 6238 TOTP Multi-Factor Authentication with one-time backup codes.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {user?.mfa_enabled ? (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>2FA is active on this account using Google Authenticator / Authy.</span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>MFA is currently disabled. Protect your account against credential stuffing.</span>
                </div>
              )}

              <Button
                variant={user?.mfa_enabled ? "outline" : "neon"}
                className="w-full text-xs"
                onClick={startMfaEnrollment}
                disabled={mfaEnrollLoading}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {user?.mfa_enabled ? "Reconfigure MFA Keys" : "Enroll in Two-Factor Auth"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MFA Enrollment Modal */}
      <Dialog open={mfaModalOpen} onOpenChange={setMfaModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-display">Configure Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password)
            </DialogDescription>
          </DialogHeader>

          {mfaSuccessMsg ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center space-y-2">
              <CheckCircle className="h-8 w-8 mx-auto" />
              <p className="font-semibold text-sm">{mfaSuccessMsg}</p>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {/* QR Code */}
              {mfaQrCode && (
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner w-fit mx-auto">
                  <img src={mfaQrCode} alt="TOTP QR Code" className="h-48 w-48" />
                </div>
              )}

              {/* Secret Key */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Manual Setup Secret Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded-md text-xs font-mono text-center tracking-wider">
                    {mfaSecret}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (mfaSecret) navigator.clipboard.writeText(mfaSecret);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Backup Codes */}
              {mfaBackupCodes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-amber-400">
                    Single-Use Emergency Backup Codes (Save These Now)
                  </Label>
                  <div className="grid grid-cols-2 gap-2 bg-card p-3 rounded-lg border border-border/50 font-mono text-xs text-center">
                    {mfaBackupCodes.map((code) => (
                      <span key={code} className="bg-muted/50 p-1 rounded">{code}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation Form */}
              <form onSubmit={confirmMfaEnrollment} className="space-y-4 pt-2 border-t border-border/40">
                {mfaErrorMsg && (
                  <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{mfaErrorMsg}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-code" className="text-xs">
                    Confirm by entering the 6-digit code from your app:
                  </Label>
                  <Input
                    id="mfa-verify-code"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    className="text-center text-lg tracking-widest font-mono"
                    required
                  />
                </div>

                <Button type="submit" variant="neon" className="w-full" disabled={mfaEnrollLoading}>
                  {mfaEnrollLoading ? "Verifying..." : "Activate Two-Factor Authentication"}
                </Button>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
