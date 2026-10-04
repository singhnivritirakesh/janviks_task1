import { useParams, Link } from "react-router-dom";
import { useBooking } from "../hooks/use-data";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardTitle, CardDescription } from "../components/ui/card";
import { CheckCircle2, Calendar, Clock, DollarSign, ArrowLeft } from "lucide-react";

export default function BookingConfirmedPage() {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading, error } = useBooking(id);

  if (isLoading) {
    return (
      <div className="container max-w-xl mx-auto px-4 py-20 animate-pulse">
        <div className="h-80 rounded-2xl bg-card" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold">Booking Details Unavailable</h2>
        <p className="text-xs text-muted-foreground mt-2">
          Unable to retrieve booking information. You may not have authorization to view this booking.
        </p>
        <Link to="/profile">
          <Button variant="outline" className="mt-4">
            View My Profile
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-xl mx-auto px-4 py-16">
      <Card className="border-border/60 shadow-2xl text-center overflow-hidden">
        <div className="bg-emerald-500/10 py-8 border-b border-emerald-500/20">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.5)]">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-display font-extrabold text-foreground mt-4">
            Court Booking Confirmed!
          </CardTitle>
          <CardDescription className="text-xs text-emerald-400 mt-1">
            Your court reservation is secured and verified.
          </CardDescription>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="bg-muted/40 p-4 rounded-xl border border-border/40 text-left space-y-3 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <span className="text-muted-foreground">Booking Reference</span>
              <code className="font-mono font-bold text-foreground text-sm">{booking.id.slice(0, 13)}...</code>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Venue</span>
              <span className="font-bold text-foreground">{booking.venue_name || "Premier Sports Arena"}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" /> Date
              </span>
              <span className="font-semibold text-foreground">{booking.date}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-emerald-400" /> Reserved Time
              </span>
              <span className="font-semibold text-foreground">{booking.start_time} - {booking.end_time}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-border/40 text-sm font-bold">
              <span className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-emerald-400" /> Total Paid
              </span>
              <span className="text-emerald-400 font-extrabold text-base">${booking.total_price}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/profile" className="flex-1">
              <Button variant="neon" className="w-full">
                View My Reservations
              </Button>
            </Link>
            <Link to="/venues" className="flex-1">
              <Button variant="outline" className="w-full gap-1">
                <ArrowLeft className="h-4 w-4" /> Discover More
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
