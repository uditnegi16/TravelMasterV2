import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ShieldCheck, ShieldOff } from "lucide-react";

import AdminLayout from "./AdminLayout";
import {
  listAdminUsers,
  setAdminUserBanned,
  setAdminUserRole,
} from "../../services/adminApi";
import type { AdminUser, UserRole } from "../../models/admin";
import { AdminCard, ErrorState, LoadingState } from "./components/AdminUI";
import { Button } from "../../components/ui/Button";

const ROLES: UserRole[] = ["user", "admin", "superadmin"];

export default function AdminUsersPage() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");
      const result = await listAdminUsers(token, { limit: 50 });
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRoleChange(userId: string, role: UserRole) {
    setBusyId(userId);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");
      await setAdminUserRole(token, userId, role);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === userId ? { ...u, role } : u)) : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBanToggle(user: AdminUser) {
    setBusyId(user.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in.");
      await setAdminUserBanned(token, user.id, !user.banned);
      setUsers((prev) =>
        prev
          ? prev.map((u) => (u.id === user.id ? { ...u, banned: !u.banned } : u))
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Users</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Roles are stored in Clerk publicMetadata — 2-tier today (user / admin),
          superadmin available for later.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {!users && !error && <LoadingState />}

      {users && (
        <AdminCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{u.email ?? "—"}</td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      disabled={busyId === u.id}
                      onChange={(e) =>
                        handleRoleChange(u.id, e.target.value as UserRole)
                      }
                      className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm font-medium text-ink focus-ring"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {u.banned ? (
                      <span className="text-accent-red font-medium">Banned</span>
                    ) : (
                      <span className="text-accent-green font-medium">Active</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === u.id}
                      icon={u.banned ? <ShieldCheck /> : <ShieldOff />}
                      onClick={() => handleBanToggle(u)}
                    >
                      {u.banned ? "Unban" : "Ban"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}
    </AdminLayout>
  );
}
