import { useState } from "react";
import { usePlayers } from "../hooks/use-data";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Search, Star, MapPin, Trophy, Shield } from "lucide-react";
import { UserProfile } from "../lib/api";

export default function PlayersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityTerm, setCityTerm] = useState("");

  const { data: players, isLoading } = usePlayers({
    search: searchTerm || undefined,
    city: cityTerm || undefined,
  });

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Athlete Community</h1>
          <p className="text-sm text-muted-foreground">Connect with local players and find sparring partners</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-card/60 p-4 rounded-xl border border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search athlete by name or bio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div>
          <Input
            placeholder="Filter by city (e.g. New York, Brooklyn)"
            value={cityTerm}
            onChange={(e) => setCityTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Players Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-60 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : players && players.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {players.map((player: UserProfile) => (
            <Card key={player.id} className="text-center p-6 border-border/50 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="relative inline-block mb-3">
                  <img
                    src={player.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb"}
                    alt={player.full_name}
                    className="h-20 w-20 rounded-full mx-auto object-cover border-2 border-emerald-500 shadow-md"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-border">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                </div>

                <h3 className="font-bold text-base text-foreground">{player.full_name}</h3>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1 mb-2">
                  <MapPin className="h-3 w-3 text-emerald-400" />
                  {player.location || "New York, NY"}
                </p>

                <p className="text-xs text-muted-foreground line-clamp-2 italic mb-4">
                  "{player.bio || "Active sports enthusiast looking for matches."}"
                </p>
              </div>

              <div>
                <div className="flex items-center justify-center gap-4 py-2 border-y border-border/40 mb-3 text-xs">
                  <div className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <span>{player.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{player.games_played} Games</span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-1">
                  {player.favorite_sports?.map((sport: string) => (
                    <Badge key={sport} variant="secondary" className="text-[10px]">
                      {sport}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed rounded-xl border-border">
          <p className="text-muted-foreground">No athletes found matching your search.</p>
        </div>
      )}
    </div>
  );
}
