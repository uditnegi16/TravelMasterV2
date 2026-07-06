export interface Flight {
  owner?: string;
  airline?: string;
  id?: string;
  total_amount?: string;
  currency?: string;
}

export interface Hotel {
  city?: string;
  name?: string;
  address?: string;
  booking_url?: string;
}

export interface Place {
  name: string;
  category?: string;
  type?: string;
  maps_url?: string;
}

export interface Weather {
  city?: string;
  location?: string;
  condition?: string;
  temperature?: number;
}

export interface Recommended {
  flight?: Flight;
  hotel?: Hotel;
}

export interface Trip {
  summary: string;
  recommendation?: string;
  user_query?: string;
  final_response?: string;

  recommended?: Recommended;

  places: Place[];

  weather?: Weather;
}

export interface PlanTripResponse {
    error?: boolean;
    message?: string;
    trip?: Trip;
}