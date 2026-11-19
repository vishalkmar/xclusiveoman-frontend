import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '../../api/createApiClient.js';

// Session check for the public landing page (Navbar). The landing page sits
// outside every portal's AuthProvider, so it resumes the session itself the
// same way they do on mount: POST /auth/refresh with the httpOnly refresh
// cookie, then GET /auth/me. Its own createApiClient() instance, so it never
// shares access-token state with the agent/admin/team clients.
const { api, setAccessToken, tryRefresh } = createApiClient();

// Same role routing as shared/components/LoginModal.jsx: team accounts go to
// /team, agency users to /agent, every other staff role to /admin.
const TEAM_ROLES = ['sales_manager', 'relationship_manager'];

export function dashboardPathFor(user) {
  if (!user) return '/agent';
  if (TEAM_ROLES.includes(user.role)) return '/team/dashboard';
  if (user.agencyId) return '/agent/dashboard';
  return '/admin/dashboard';
}

// Same allow-list as admin/context/AuthContext.jsx's ADMIN_ROLES — only these
// accounts can actually use the Admin Console. Any other agency-less staff
// role (e.g. a custom-role employee) would be logged straight back out by
// the admin app, so they must not be redirected there.
const ADMIN_ROLES = ['ops_admin', 'super_admin', 'sales_marketing', 'support', 'finance'];

export function isAdminUser(user) {
  return Boolean(user && !user.agencyId && ADMIN_ROLES.includes(user.role));
}

// `skip` lets a parent that already ran the check (LandingPage) hand its
// result down to Navbar without a second /auth/refresh round trip.
export function useLandingSession({ skip = false } = {}) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    if (skip) return undefined;
    let active = true;
    (async () => {
      try {
        if (!(await tryRefresh())) throw new Error('no session');
        const { user } = await api.get('/auth/me');
        if (active) setState({ status: 'authenticated', user });
      } catch {
        setAccessToken(null);
        if (active) setState({ status: 'anonymous', user: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [skip]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  return { ...state, isAuthenticated: state.status === 'authenticated', logout };
}
