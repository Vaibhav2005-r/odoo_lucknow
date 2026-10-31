import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const homeFor = (role) => (role === 'CUSTOMER' ? '/portal' : '/app/dashboard');

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (user === undefined) return <div className="grid h-screen place-items-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
