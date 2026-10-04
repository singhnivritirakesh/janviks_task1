import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVenue, useCreateBooking } from "../hooks/use-data";
import { useAuth } from "../hooks/use-auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardDescription } from "../components/ui/card";
import { MapPin, Star, Calendar, Clock, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: venue, isLoading, error } = useVenue(id);
  const createBookingMutation = useCreateBooking();

  const [date, setDate] = useState("2026-10-20");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Real-time server-aligned price calculation
  const calculateTotal = () => {
    if (!venue) return 0;
    const [sH, sM] = startTime.split(":").map(Number);
    const [eH, eM] = endTime.split(":").map(Number);
    const hours = (eH * 60 + eM - (sH * 60 + sM)) / 60;
    return hours > 0 ? Math.round(hours * venue.hourly_rate * 100) / 100 : 0;
  };

  const handleBookingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!venue || !id) return;
    setBookingError(null);

    const total = calculateTotal();
    if (total <= 0) {
      setBookingError("End time must be after start time");
      return;
    }

    try {
      const res = await createBookingMutation.mutateAsync({
        venueId: id,
        date,
        startTime,
        endTime,
      });

      navigate(`/booking-confirmed/${res.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to book court";
      setBookingError(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-96 rounded-2xl bg-card mb-8" />
        <div className="h-40 rounded-xl bg-card" />
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Venue Not Found</h2>
        <p className="text-muted-foreground mt-2">The requested sports facility could not be loaded.</p>
        <Button onClick={() => navigate("/venues")} variant="outline" className="mt-4">
          Back to Venues
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Venue Details */}
        <div className="lg:col-span-2 space-y-8">
          <div className="relative h-80 sm:h-96 w-full rounded-2xl overflow-hidden shadow-2xl border border-border/50">
            <img
              src={venue.image_url}
              alt={venue.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full text-sm font-bold text-amber-400">
              <Star className="h-4 w-4 fill-amber-400" />
              <span>{venue.rating.toFixed(1)} / 5.0</span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {venue.sport_types?.map((sport: string) => (
                <Badge key={sport} variant="neon">
                  {sport}
                </Badge>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground">{venue.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2">
              <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
              {venue.address}, {venue.city}
            </p>
          </div>

          <div className="prose prose-invert max-w-none">
            <h3 className="text-lg font-bold text-foreground">Facility Overview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{venue.description}</p>
          </div>

          {venue.amenities && venue.amenities.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3">Amenities &amp; Equipment</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {venue.amenities.map((item: string) => (
                  <div key={item} className="flex items-center gap-2 p-3 rounded-lg bg-card/60 border border-border/40 text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Court Reservation Card */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24 border-border/60 shadow-xl bg-card/90 backdrop-blur">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-foreground">${venue.hourly_rate}</span>
                  <span className="text-xs text-muted-foreground"> / hour</span>
                </div>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">
                  Instant Booking
                </Badge>
              </div>
              <CardDescription className="text-xs pt-1">
                Select your desired date and court duration
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {bookingError && (
                  <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="book-date" className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-emerald-400" /> Date
                  </Label>
                  <Input
                    id="book-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="book-start" className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" /> Start Time
                    </Label>
                    <Input
                      id="book-start"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="book-end" className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" /> End Time
                    </Label>
                    <Input
                      id="book-end"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Base Hourly Rate</span>
                    <span>${venue.hourly_rate}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border/20">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-emerald-400" /> Total Estimated
                    </span>
                    <span className="text-emerald-400">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="neon"
                  className="w-full mt-4"
                  disabled={createBookingMutation.isPending}
                >
                  {createBookingMutation.isPending
                    ? "Processing Reservation..."
                    : isAuthenticated
                    ? "Confirm &amp; Book Court"
                    : "Sign In to Book"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
