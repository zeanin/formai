import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AppGuardProps {
  currentUser: any;
  children: React.ReactNode;
}

/**
 * AppGuard — ensures user is authenticated before accessing /apps/*.
 * Redirects to /login if not authenticated.
 */
export function AppGuard({ currentUser, children }: AppGuardProps) {
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
