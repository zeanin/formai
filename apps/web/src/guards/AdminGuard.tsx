import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AdminGuardProps {
  currentUser: any;
  currentRole: string | null;
  children: React.ReactNode;
}

/**
 * AdminGuard — blocks access to /admin/* routes for non-admin users.
 * Redirects to /apps (end-user portal).
 */
export function AdminGuard({ currentUser, currentRole, children }: AdminGuardProps) {
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isAdmin =
    currentRole === 'root' ||
    currentRole === 'admin' ||
    currentRole === 'developer';

  if (!isAdmin) {
    return <Navigate to="/apps" replace />;
  }

  return <>{children}</>;
}
