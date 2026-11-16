import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading)
    return <div className="auth-loading">Restoring your secure session…</div>;
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  return <>{children}</>;
}
