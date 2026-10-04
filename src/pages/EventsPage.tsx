import { useState } from "react";
import { useEvents, useJoinEvent } from "../hooks/use-data";
import { useAuth } from "../hooks/use-auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Search, Calendar, Users, MapPin, Trophy, CheckCircle } from "lucide-react";
import { Event } from "../lib/api";

const SPORTS_FILTER = ["All Sports", "Football", "Tennis", "Badminton", "Basketball", "Volleyball"];

export default function EventsPage() {
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSport, setSelectedSport] = useState("All Sports");
  const [joinedSuccess, setJoinedSuccess] = useState<string | null>(null);

  const { data: events, isLoading } = useEvents({
    search: searchTerm || undefined,
    sport: selectedSport !== "All Sports" ? selectedSport : undefined,
  });

  const joinMutation = useJoinEvent();

  const handleJoin = async (eventId: string, title: string) => {
    if (!isAuthenticated) {
      alert("Please sign in to register for events.");
      return;
    }

    try {
      await joinMutation.mutateAsync(eventId);
      setJoinedSuccess(`You have successfully registered for '${title}'!`);
      setTimeout(() => setJoinedSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join event";
      alert(msg);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Tournaments &amp; Sports Events</h1>
          <p className="text-sm text-muted-foreground">Join competitive weekend leagues or social pickup games</p>
        </div>
      </div>

      {joinedSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{joinedSuccess}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-card/60 p-4 rounded-xl border border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tournament title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {SPORTS_FILTER.map((sport) => (
            <Button
              key={sport}
              variant={selectedSport === sport ? "neon" : "outline"}
              size="sm"
              onClick={() => setSelectedSport(sport)}
              className="text-xs whitespace-nowrap"
            >
              {sport}
            </Button>
          ))}
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : events && events.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event: Event) => {
            const isFull = event.current_participants >= event.max_participants;
            return (
              <Card key={event.id} className="border-border/50 hover:border-emerald-500/40 transition-colors flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="neon">{event.sport_type}</Badge>
                    <span className="text-sm font-bold text-emerald-400">${event.price} Entry</span>
                  </div>
                  <CardTitle className="text-lg font-bold">{event.title}</CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {event.venue_name || "Premier Sports Arena"}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                        {event.date}
                      </span>
                      <span>{event.start_time} - {event.end_time}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-emerald-400" />
                        Participants
                      </span>
                      <span className={isFull ? "text-destructive font-bold" : "text-foreground font-semibold"}>
                        {event.current_participants} / {event.max_participants} {isFull && "(Full)"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        Skill Level
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{event.skill_level}</Badge>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleJoin(event.id, event.title)}
                    variant={isFull ? "secondary" : "neon"}
                    disabled={isFull || joinMutation.isPending}
                    className="w-full"
                    size="sm"
                  >
                    {isFull ? "Registration Closed (Full)" : "Register for Event"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed rounded-xl border-border">
          <p className="text-muted-foreground">No events found matching your filter criteria.</p>
        </div>
      )}
    </div>
  );
}
