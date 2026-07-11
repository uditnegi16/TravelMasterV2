import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";

/**
 * Gate for /admin/*. This is UX only, same as everywhere else in the
 * app — the actual security boundary is `require_admin` on the
 * backend (core/auth.py), which checks the signed session token, not
 * this client-side read of publicMetadata.
 */
export default function AdminRoute() {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-muted">
        Loading...
      </div>
    );
  }

  const role = (user?.publicMetadata?.role as string | undefined) ?? "user";
  const isAdmin = role === "admin" || role === "superadmin";

  return (
    <>
      <SignedIn>
        {isAdmin ? (
          <Outlet />
        ) : (
          <Navigate to="/chat" replace />
        )}
      </SignedIn>

      <SignedOut>
        <Navigate to="/" replace />
      </SignedOut>
    </>
  );
}
