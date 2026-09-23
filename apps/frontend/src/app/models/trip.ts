/** Duffel sends segment endpoints as airport objects, not strings. */
export interface Airport {
  iata_code?: string;
  city_name?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
}

export interface FlightSegment {
  // Raw Duffel segments carry Airport objects here; kept as a union so
  // older/normalized data that stored plain IATA strings still types.
  origin?: string | Airport;
  destination?: string | Airport;
  origin_city?: string;
  destination_city?: string;
  departing_at?: string;
  arriving_at?: string;
  carrier?: string;
  flight_number?: string;
  marketing_carrier?: { name?: string; iata_code?: string };
  marketing_carrier_flight_number?: string;
  duration?: string;
}

export interface Flight {
  owner?: string;
  airline?: string;
  id?: string;
  total_amount?: string;
  price?: number;
  currency?: string;
  duration?: string;
  stops?: number;
  is_direct?: boolean;
  layover_airport?: string | null;
  layover_city?: string | null;
  layover_duration_minutes?: number | null;
  overnight_layover?: boolean;
  origin?: string;
  destination?: string;
  origin_city?: string;
  destination_city?: string;
  segments?: FlightSegment[];
}

export interface Hotel {
  id?: string;
  city?: string;
  name?: string;
  address?: string;
  booking_url?: string;
  estimated_price_per_night?: number;
  estimated_total_cost?: number;
  hotel_class?: string;
  rating?: number;
  amenities?: string[];
  budget_fit?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface Place {
  name: string;
  category?: string;
  type?: string;
  maps_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface Weather {
  city?: string;
  location?: string;
  condition?: string;
  temperature?: number;
}

export interface Itinerary {
  flight?: Flight | null;
  hotels: Hotel[];
  total_flight_cost: number;
  total_hotel_cost: number;
  layover_cost: number;
  total_trip_cost: number;
  remaining_budget: number;
  within_budget: boolean;
}

export interface PackageOption {
  profile: string;
  itinerary: Itinerary;
  overall_score: number;
  tradeoffs?: string[];
}

export interface Recommended {
  profile?: string;
  flight?: Flight | null;
  hotel?: Hotel | null;
  itinerary?: Itinerary | null;
}

export interface Trip {
  summary: string;

  recommended?: Recommended;

  itinerary?: Itinerary;

  multi_itineraries?: PackageOption[];

  flights?: Flight[];

  hotels?: Hotel[];

  places: Place[];

  weather?: Weather;

  /** The planner's reading of the request (dates, cities, travelers). */
  parsed_trip?: ParsedTrip;
}

export interface ParsedTrip {
  origin?: string;
  destination?: string;
  destination_city?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  travelers?: number;
}

export interface PlanTripResponse {
  error?: boolean;
  message?: string;
  trip?: Trip;
}
export type SharedTripResponse = {
  summary: string;
  trip: Trip;
};