export type UserRole = "user" | "admin" | "superadmin";

export interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: number | string | null;
  last_active_at: number | string | null;
  banned: boolean;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  created_at: string;
}

export interface AnalyticsOverview {
  window_days: number;
  total_sessions: number;
  new_sessions_in_window: number;
  total_messages: number;
  trips_generated: number;
  user_messages_by_day: Record<string, number>;
  conversation_type_distribution: Record<string, number>;
}

export interface MonitoringSnapshot {
  checks: Record<string, { ok: boolean; latency_ms?: number; error?: string }>;
  cache: { hits: number; misses: number };
  chat: { success: number; errors: number };
  rag: { calls: number; errors: number };
  generated_at: string;
}

export interface LatencyStats {
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  max_ms: number;
  count: number;
}

export interface MlopsDashboard {
  pipeline_latency: {
    end_to_end_chat_turn: LatencyStats;
    rag_retrieval: LatencyStats;
  };
  retrieval_quality: {
    avg_docs_retrieved: number | null;
    retrieval_calls: number;
    retrieval_errors: number;
  };
  cache: { hit_rate: number | null; hits: number; misses: number };
  conversation_routing: Record<string, number>;
  reliability: {
    chat_turn_success: number;
    chat_turn_errors: number;
    error_rate: number;
  };
  recent_chat_turns: Array<{ ms: number; t: number; conversation_type?: string }>;
  note: string;
}

export interface AdminDashboard {
  analytics: AnalyticsOverview;
  monitoring: MonitoringSnapshot;
  open_contact_submissions: number;
}
