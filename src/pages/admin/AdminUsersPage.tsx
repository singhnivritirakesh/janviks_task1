import { useState, useEffect, useCallback } from "react";
import { api, User } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Users, Shield, Lock, Unlock, CheckCircle } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Array<User & { full_name?: string; is_locked: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.admin.getUsers();
      setUsers(res.users);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      setActionMsg(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.admin.updateUserRole(userId, newRole);
      setActionMsg(`Role updated to '${newRole}' successfully.`);
      await fetchUsers();
      setTimeout(() => setActionMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      alert(msg);
    }
  };

  const handleToggleLock = async (userId: string, currentLock: boolean) => {
    try {
      await api.admin.updateUserLock(userId, !currentLock, 120); // 2 hours lock
      setActionMsg(currentLock ? "Account unlocked." : "Account locked.");
      await fetchUsers();
      setTimeout(() => setActionMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle lock";
      alert(msg);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-emerald-400" /> User &amp; Access Governance
          </h1>
          <p className="text-sm text-muted-foreground">Manage user accounts, assign RBAC roles, and enforce account lockouts</p>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      <Card className="border-border/60 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" /> Registered Accounts Directory
          </CardTitle>
          <CardDescription className="text-xs">
            Server-side authorization enforced. Only administrators with verified MFA can execute modifications.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading accounts...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User / Email</TableHead>
                  <TableHead>Role (RBAC)</TableHead>
                  <TableHead>MFA Status</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground text-sm">{u.full_name || "Anonymous User"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                    </TableCell>

                    <TableCell>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-background border border-input rounded px-2 py-1 text-xs"
                      >
                        <option value="user">User / Player</option>
                        <option value="venue_manager">Venue Manager</option>
                        <option value="admin">Administrator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </TableCell>

                    <TableCell>
                      {u.mfa_enabled ? (
                        <Badge variant="neon" className="text-[10px]">MFA ACTIVE</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">NO 2FA</Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {u.is_locked ? (
                        <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                          <Lock className="h-3 w-3" /> LOCKED
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40 w-fit">
                          NORMAL
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={u.is_locked ? "outline" : "destructive"}
                        className="text-xs h-8"
                        onClick={() => handleToggleLock(u.id, u.is_locked)}
                      >
                        {u.is_locked ? (
                          <span className="flex items-center gap-1">
                            <Unlock className="h-3.5 w-3.5" /> Unlock
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Lock className="h-3.5 w-3.5" /> Lock Account
                          </span>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
