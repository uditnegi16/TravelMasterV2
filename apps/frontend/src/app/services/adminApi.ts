import { API_URL } from "./api";
import type {
  AdminDashboard,
  AdminUser,
  AnalyticsOverview,
  ContactSubmission,
  MlopsDashboard,
  MonitoringSnapshot,
  UserRole,
} from "../models/admin";

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.json();
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function getAdminDashboard(token: string): Promise<AdminDashboard> {
  const res = await fetch(`${API_URL}/admin/dashboard`, {
    headers: authHeaders(token),
  });
  return handle(res);
}

export async function listAdminUsers(
  token: string,
  opts?: { limit?: number; offset?: number; query?: string },
): Promise<{ total: number; users: AdminUser[] }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  if (opts?.query) params.set("query", opts.query);

  const res = await fetch(`${API_URL}/admin/users?${params.toString()}`, {
    headers: authHeaders(token),
  });
  return handle(res);
}

export async function setAdminUserRole(
  token: string,
  userId: string,
  role: UserRole,
): Promise<{ id: string; role: UserRole }> {
  const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ role }),
  });
  return handle(res);
}

export async function setAdminUserBanned(
  token: string,
  userId: string,
  banned: boolean,
): Promise<{ id: string; banned: boolean }> {
  const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ banned }),
  });
  return handle(res);
}

export async function listContactSubmissions(
  token: string,
  status?: string,
): Promise<{ submissions: ContactSubmission[] }> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_URL}/admin/contact-submissions${params}`, {
    headers: authHeaders(token),
  });
  return handle(res);
}

export async function updateContactSubmissionStatus(
  token: string,
  submissionId: string,
  status: ContactSubmission["status"],
): Promise<ContactSubmission> {
  const res = await fetch(`${API_URL}/admin/contact-submissions/${submissionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ status }),
  });
  return handle(res);
}

export async function getAdminAnalytics(
  token: string,
  days = 7,
): Promise<AnalyticsOverview> {
  const res = await fetch(`${API_URL}/admin/analytics?days=${days}`, {
    headers: authHeaders(token),
  });
  return handle(res);
}

export async function getAdminMonitoring(token: string): Promise<MonitoringSnapshot> {
  const res = await fetch(`${API_URL}/admin/monitoring`, {
    headers: authHeaders(token),
  });
  return handle(res);
}

export async function getAdminMlops(token: string): Promise<MlopsDashboard> {
  const res = await fetch(`${API_URL}/admin/mlops`, {
    headers: authHeaders(token),
  });
  return handle(res);
}
