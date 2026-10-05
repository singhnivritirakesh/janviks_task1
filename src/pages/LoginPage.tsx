import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Shield, KeyRound, Lock, Mail, User, AlertCircle, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, verifyMfa } = useAuth();

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regRole, setRegRole] = useState("user");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // MFA Dialog state
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const result = await login({ email: loginEmail, password: loginPassword });

      if (result.requireMfa && result.preAuthToken) {
        setPreAuthToken(result.preAuthToken);
        setMfaDialogOpen(true);
      } else {
        navigate("/");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!preAuthToken) return;

    setMfaError(null);
    setMfaLoading(true);

    try {
      await verifyMfa({ preAuthToken, code: totpCode });
      setMfaDialogOpen(false);
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid MFA code";
      setMfaError(msg);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    setRegLoading(true);

    try {
      await register({
        email: regEmail,
        password: regPassword,
        fullName: regFullName,
        role: regRole,
      });

      setRegSuccess("Account registered successfully! You may now sign in.");
      setRegEmail("");
      setRegPassword("");
      setRegFullName("");
    } catch (err: unknown) {
      let msg = "Registration failed";
      if (err instanceof Error) {
        msg = err.message;
        const customErr = err as { details?: unknown };
        if (Array.isArray(customErr.details) && customErr.details.length > 0) {
          msg = `${err.message}: ${customErr.details.join('. ')}`;
        }
      }
      setRegError(msg);
    } finally {
      setRegLoading(false);
    }
  };

  const isMinLength = regPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(regPassword);
  const hasNumber = /[0-9]/.test(regPassword);

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-display font-bold">PlaySphere Connect</CardTitle>
          <CardDescription>Secure Authentication &amp; Access Control</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="player@playsphere.local"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" variant="neon" className="w-full" disabled={loginLoading}>
                  {loginLoading ? "Authenticating..." : "Sign In"}
                </Button>

                <div className="text-center pt-2">
                  <p className="text-[11px] text-muted-foreground">
                    Protected by Argon2/Bcrypt Cost 12 &amp; Rate-Limiting Lockout
                  </p>
                </div>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {regError && (
                  <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                {regSuccess && (
                  <div className="p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{regSuccess}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reg-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="Alex Morgan"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="alex@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password (NIST Policy: Min 8 Characters)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="StrongPass2026!"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>

                  {/* NIST Password Checklist */}
                  {regPassword.length > 0 && (
                    <div className="rounded-md bg-muted/40 p-2 text-xs space-y-1 mt-1 border border-border/40">
                      <div className={`flex items-center gap-1.5 ${isMinLength ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isMinLength ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                        At least 8 characters ({regPassword.length}/8)
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasLetter ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                        At least one letter (a-z, A-Z)
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
                        At least one number (0-9)
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-role">Role</Label>
                  <select
                    id="reg-role"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    <option value="user">Athlete / Player</option>
                    <option value="venue_manager">Venue Manager / Organizer</option>
                  </select>
                </div>

                <Button type="submit" variant="default" className="w-full" disabled={regLoading}>
                  {regLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Mandatory MFA Challenge Dialog */}
      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-2">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-center font-display">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Enter the 6-digit TOTP code from your authenticator app or an 8-character single-use backup code.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMfaSubmit} className="space-y-4 pt-2">
            {mfaError && (
              <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{mfaError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-center block">Verification Code</Label>
              <Input
                id="mfa-code"
                type="text"
                placeholder="123456 or ABC12345"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="text-center text-lg tracking-widest font-mono"
                maxLength={8}
                autoFocus
                required
              />
            </div>

            <Button type="submit" variant="neon" className="w-full" disabled={mfaLoading}>
              {mfaLoading ? "Verifying..." : "Verify & Complete Sign In"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
