import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const homeFor = (role) => (role === 'CUSTOMER' ? '/portal' : '/app/dashboard');

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50" role="status" aria-label="Loading">
        <div className="h-7 w-7 rounded-full border-[2.5px] border-slate-300 border-t-brand-600 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
