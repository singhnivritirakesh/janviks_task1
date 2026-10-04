import { Link } from "react-router-dom";
import { useVenues, useEvents, usePlayers } from "../hooks/use-data";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Calendar, MapPin, Users, Star, ArrowRight, ShieldCheck, Flame } from "lucide-react";
import { Venue, Event, UserProfile } from "../lib/api";

export default function Index() {
  const { data: venues, isLoading: venuesLoading } = useVenues({ limit: 3 });
  const { data: events, isLoading: eventsLoading } = useEvents({ limit: 3 });
  const { data: players, isLoading: playersLoading } = usePlayers({ limit: 4 });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32 bg-gradient-to-b from-background via-card/50 to-background border-b border-border/40">
        <div className="container max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Flame className="h-4 w-4" /> Next-Gen Sports &amp; Fitness Discovery Platform
            </div>

            <h1 className="text-4xl sm:text-6xl font-display font-extrabold tracking-tight text-foreground">
              Connect. Compete. <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Elevate Your Game.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl">
              Discover top-rated sports venues, participate in competitive local tournaments, and connect with passionate athletes across your city.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link to="/venues">
                <Button variant="neon" size="lg" className="gap-2">
                  <MapPin className="h-4 w-4" /> Explore Venues
                </Button>
              </Link>
              <Link to="/events">
                <Button variant="outline" size="lg" className="gap-2">
                  <Calendar className="h-4 w-4" /> Browse Events
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Venues */}
      <section className="py-16 container max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Premier Sports Venues</h2>
            <p className="text-sm text-muted-foreground">Book courts and facilities with verified equipment</p>
          </div>
          <Link to="/venues">
            <Button variant="ghost" size="sm" className="gap-1 text-emerald-400">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {venuesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-lg bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {venues?.map((venue: Venue) => (
              <Card key={venue.id} className="overflow-hidden border-border/50 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] flex flex-col">
                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    src={venue.image_url}
                    alt={venue.name}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <span>{venue.rating.toFixed(1)}</span>
                  </div>
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">{venue.name}</CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                    {venue.address}, {venue.city}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between pt-0">
                  <div className="flex flex-wrap gap-1.5 my-3">
                    {venue.sport_types?.slice(0, 3).map((sport: string) => (
                      <Badge key={sport} variant="secondary" className="text-xs">
                        {sport}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <div>
                      <span className="text-lg font-bold text-foreground">${venue.hourly_rate}</span>
                      <span className="text-xs text-muted-foreground"> / hour</span>
                    </div>
                    <Link to={`/venues/${venue.id}`}>
                      <Button size="sm" variant="outline">
                        Book Court
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Tournaments & Events */}
      <section className="py-16 bg-card/30 border-y border-border/40">
        <div className="container max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Upcoming Tournaments &amp; Mixers</h2>
              <p className="text-sm text-muted-foreground">Join competitive leagues or social weekend runs</p>
            </div>
            <Link to="/events">
              <Button variant="ghost" size="sm" className="gap-1 text-emerald-400">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {eventsLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-48 rounded-lg bg-card animate-pulse" />)
            ) : (
              events?.map((event: Event) => (
                <Card key={event.id} className="border-border/50 hover:border-emerald-500/40 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="neon" className="text-xs">{event.sport_type}</Badge>
                      <span className="text-xs font-semibold text-emerald-400">${event.price} Entry</span>
                    </div>
                    <CardTitle className="text-base font-bold">{event.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{event.date} • {event.start_time} - {event.end_time}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{event.current_participants} / {event.max_participants} Participants Registered</span>
                      </div>
                    </div>
                    <Link to="/events" className="block pt-2">
                      <Button size="sm" className="w-full" variant="outline">
                        View Details
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Top Athletes & Community */}
      <section className="py-16 container max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Top Community Athletes</h2>
            <p className="text-sm text-muted-foreground">Find players near your skill level for practice matches</p>
          </div>
          <Link to="/players">
            <Button variant="ghost" size="sm" className="gap-1 text-emerald-400">
              View All <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {playersLoading ? (
            [1, 2, 3, 4].map((i) => <div key={i} className="h-40 rounded-lg bg-card animate-pulse" />)
          ) : (
            players?.map((player: UserProfile) => (
              <Card key={player.id} className="text-center p-4 border-border/50">
                <img
                  src={player.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb"}
                  alt={player.full_name}
                  className="h-16 w-16 rounded-full mx-auto object-cover border-2 border-emerald-500/50 mb-3"
                />
                <h3 className="font-bold text-sm text-foreground">{player.full_name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{player.location || "New York, NY"}</p>
                <div className="flex items-center justify-center gap-1 text-xs text-amber-400 font-semibold mb-3">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{player.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground ml-1">({player.games_played} games)</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1">
                  {player.favorite_sports?.slice(0, 2).map((sport: string) => (
                    <Badge key={sport} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {sport}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Security Assurance Banner */}
      <section className="py-12 border-t border-border/40 bg-gradient-to-r from-emerald-950/20 via-card to-background">
        <div className="container max-w-7xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Enterprise-Grade Security Architecture</h3>
              <p className="text-xs text-muted-foreground">
                Asymmetric RS256 token signing, HttpOnly refresh token rotation, RFC 6238 TOTP MFA, and tamper-evident audit logging.
              </p>
            </div>
          </div>
          <Link to="/venues">
            <Button variant="outline" size="sm">
              Discover Courts
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
