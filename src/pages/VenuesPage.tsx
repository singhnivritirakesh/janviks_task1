import { useState } from "react";
import { Link } from "react-router-dom";
import { useVenues } from "../hooks/use-data";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Search, MapPin, Star, Filter } from "lucide-react";
import { Venue } from "../lib/api";

const SPORTS_OPTIONS = ["All Sports", "Football", "Basketball", "Tennis", "Badminton", "Volleyball", "Swimming"];

export default function VenuesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSport, setSelectedSport] = useState("All Sports");
  const [selectedCity, setSelectedCity] = useState("");

  const { data: venues, isLoading } = useVenues({
    search: searchTerm || undefined,
    sport: selectedSport !== "All Sports" ? selectedSport : undefined,
    city: selectedCity || undefined,
  });

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sports Venues &amp; Courts</h1>
          <p className="text-sm text-muted-foreground">Find and reserve verified sports facilities in your area</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-card/60 p-4 rounded-xl border border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search venue name or amenities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            {SPORTS_OPTIONS.map((sport) => (
              <option key={sport} value={sport}>{sport}</option>
            ))}
          </select>
        </div>

        <div>
          <Input
            placeholder="Filter by city (e.g. New York, Brooklyn)"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          />
        </div>
      </div>

      {/* Venues Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : venues && venues.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((venue: Venue) => (
            <Card key={venue.id} className="overflow-hidden border-border/50 hover:border-emerald-500/50 transition-all flex flex-col justify-between hover:shadow-[0_0_20px_rgba(16,185,129,0.12)]">
              <div>
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={venue.image_url}
                    alt={venue.name}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <span>{venue.rating.toFixed(1)}</span>
                  </div>
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">{venue.name}</CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {venue.address}, {venue.city}
                  </p>
                </CardHeader>

                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {venue.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {venue.sport_types?.map((sport: string) => (
                      <Badge key={sport} variant="secondary" className="text-xs">
                        {sport}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </div>

              <div className="p-6 pt-0 flex items-center justify-between border-t border-border/50 mt-4">
                <div>
                  <span className="text-lg font-bold text-foreground">${venue.hourly_rate}</span>
                  <span className="text-xs text-muted-foreground"> / hour</span>
                </div>
                <Link to={`/venues/${venue.id}`}>
                  <Button size="sm" variant="neon">
                    Book Court
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed rounded-xl border-border">
          <p className="text-muted-foreground">No venues found matching your filter criteria.</p>
        </div>
      )}
    </div>
  );
}
