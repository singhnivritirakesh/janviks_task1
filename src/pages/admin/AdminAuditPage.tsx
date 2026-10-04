import { useState, useEffect, useCallback } from "react";
import { api, AuditLogEntry } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ShieldCheck, ShieldAlert, Download, RefreshCw, FileText } from "lucide-react";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [integrity, setIntegrity] = useState<{ valid: boolean; totalEntries: number; corruptedAt?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getAuditLogs();
      setLogs(res.logs);
      setIntegrity(res.integrity);
    } catch (err: unknown) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = async () => {
    setExportLoading(true);
    try {
      const csv = await api.admin.exportData("audit_logs");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export data";
      alert(msg);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-cyan-400" /> Tamper-Evident Security Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Cryptographic SHA-256 hash-chained immutable audit records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button variant="neon" size="sm" onClick={handleExportCsv} disabled={exportLoading} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Cryptographic Hash Chain Integrity Banner */}
      {integrity && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
          integrity.valid
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {integrity.valid ? (
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
            )}
            <span>
              {integrity.valid
                ? `Cryptographic Chain Integrity Verified: All ${integrity.totalEntries} audit log entries match their sequential SHA-256 prev_hash signatures.`
                : `CHAIN TAMPERING DETECTED: Tamper detected at log ID ${integrity.corruptedAt}.`}
            </span>
          </div>

          <Badge variant={integrity.valid ? "neon" : "destructive"}>
            {integrity.valid ? "CHAIN VALID" : "COMPROMISED"}
          </Badge>
        </div>
      )}

      {/* Audit Log Table */}
      <Card className="border-border/60 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-bold">Chronological Audit Events Trail</CardTitle>
          <CardDescription className="text-xs">
            Append-only DB role permissions prevent UPDATE and DELETE modifications.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading audit records...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Actor / Role</TableHead>
                  <TableHead>Resource &amp; Action</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Hash Signature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>

                    <TableCell>
                      <code className="font-mono font-semibold text-foreground text-[11px]">
                        {log.event_type}
                      </code>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          log.severity === "CRITICAL"
                            ? "destructive"
                            : log.severity === "WARNING"
                            ? "outline"
                            : "secondary"
                        }
                        className="text-[9px] px-1.5 py-0"
                      >
                        {log.severity}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-[11px] text-foreground">
                        {log.actor_id ? log.actor_id.slice(0, 8) + "..." : "Anonymous"}
                      </span>
                      {log.actor_role && (
                        <span className="block text-[10px] text-muted-foreground uppercase">{log.actor_role}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-[11px]">{log.action}</span>
                      <span className="block text-[10px] text-muted-foreground truncate max-w-[150px]">
                        {log.resource}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={log.outcome === "SUCCESS" ? "neon" : "destructive"}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {log.outcome}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <code className="font-mono text-[10px] text-muted-foreground truncate block max-w-[120px]" title={log.hash}>
                        {log.hash.slice(0, 12)}...
                      </code>
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
