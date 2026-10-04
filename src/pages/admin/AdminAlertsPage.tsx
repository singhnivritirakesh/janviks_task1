import { useState, useEffect, useCallback } from "react";
import { api, SecurityAlert } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { ShieldAlert, CheckCircle, RefreshCw, Terminal } from "lucide-react";

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getSecurityAlerts();
      setAlerts(res.alerts);
    } catch (err: unknown) {
      console.error("Failed to load security alerts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.admin.acknowledgeAlert(alertId);
      await fetchAlerts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to acknowledge alert";
      alert(msg);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-rose-500" /> Active Security Threat Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time heuristic &amp; rule-based threat detection engine
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchAlerts} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Alerts
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading threat alerts...</div>
      ) : alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`border-l-4 shadow-md ${
                alert.severity === "CRITICAL"
                  ? "border-l-rose-500 bg-rose-500/5"
                  : alert.severity === "HIGH"
                  ? "border-l-amber-500 bg-amber-500/5"
                  : "border-l-blue-500 bg-card"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={alert.severity === "CRITICAL" ? "destructive" : "default"}
                        className="text-xs font-bold"
                      >
                        {alert.severity}
                      </Badge>
                      <code className="font-mono text-sm font-bold text-foreground">{alert.alert_type}</code>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Status: {alert.status}
                      </Badge>
                    </div>

                    <p className="text-sm text-foreground/90 font-medium">{alert.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono pt-2">
                      <span>Source IP: {alert.source_ip}</span>
                      <span>•</span>
                      <span>Target User: {alert.user_id ? alert.user_id.slice(0, 8) + "..." : "N/A"}</span>
                      <span>•</span>
                      <span>Timestamp: {new Date(alert.timestamp).toLocaleString()}</span>
                    </div>

                    {alert.metadata && (
                      <div className="mt-3 p-2 rounded-md bg-muted/50 border border-border/40 font-mono text-[11px] text-muted-foreground">
                        <Terminal className="h-3 w-3 inline mr-1 text-emerald-400" />
                        {JSON.stringify(alert.metadata)}
                      </div>
                    )}
                  </div>

                  {alert.status === "NEW" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs shrink-0 self-start sm:self-center"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledge
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/50 text-center py-16">
          <CardContent className="space-y-2">
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
            <h3 className="font-bold text-base text-foreground">Zero Active Security Threats</h3>
            <p className="text-xs text-muted-foreground">
              All detection rules reporting normal traffic levels.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
