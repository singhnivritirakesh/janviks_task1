import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Venue, type Event, type UserProfile, type Booking } from '../lib/api';
export type { Venue, Event, UserProfile, Booking };

export interface VenueFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  sport?: string;
}

export interface EventFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  sport?: string;
}

export interface PlayerFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  sport?: string;
  city?: string;
}

/**
 * Hook to query sports venues with search and filter parameters
 */
export function useVenues(params?: VenueFilterParams) {
  return useQuery({
    queryKey: ['venues', params],
    queryFn: async () => {
      const res = await api.venues.getAll(params);
      return res.venues;
    },
  });
}

/**
 * Hook to query a single venue by ID
 */
export function useVenue(id?: string) {
  return useQuery({
    queryKey: ['venue', id],
    queryFn: async () => {
      if (!id) throw new Error('Venue ID required');
      return api.venues.getById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to query sports events
 */
export function useEvents(params?: EventFilterParams) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: async () => {
      const res = await api.events.getAll(params);
      return res.events;
    },
  });
}

/**
 * Hook to query a single event
 */
export function useEvent(id?: string) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      if (!id) throw new Error('Event ID required');
      return api.events.getById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to query players / athlete community
 */
export function usePlayers(params?: PlayerFilterParams) {
  return useQuery({
    queryKey: ['players', params],
    queryFn: async () => {
      const res = await api.players.getAll(params);
      return res.players;
    },
  });
}

/**
 * Hook to query current user's bookings (IDOR protected)
 */
export function useMyBookings() {
  return useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const res = await api.bookings.getMyBookings();
      return res.bookings;
    },
  });
}

/**
 * Hook to query a specific booking by ID (IDOR protected)
 */
export function useBooking(id?: string) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      if (!id) throw new Error('Booking ID required');
      return api.bookings.getById(id);
    },
    enabled: Boolean(id),
  });
}

/**
 * Mutations for booking creation and event joining
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { venueId: string; date: string; startTime: string; endTime: string }) =>
      api.bookings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
  });
}

export function useJoinEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.events.join(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}
