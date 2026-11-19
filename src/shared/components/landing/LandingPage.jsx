// Public marketing homepage — rendered at "/" (see src/App.jsx). Portal-
// agnostic like shared/components/LoginModal.jsx (no admin/agent/team
// Tailwind tokens), and purely a composition of the section components
// below: each section owns its own layout/content, this file just orders
// them top to bottom to match the reference design.
//
// Section-by-section breakdown lives in ./sections/*, small pieces reused
// across multiple sections (card, heading, button) live in ./components/*,
// and every placeholder image/copy value lives in ./data.js — swapping in
// real photography or final copy later is a data.js edit, not a rewrite of
// any component here.
import { useEffect, useState } from 'react';
import { isAdminUser, useLandingSession } from './useLandingSession.js';
import { Navbar } from './sections/Navbar.jsx';
import { Hero } from './sections/Hero.jsx';
import { WeOperateSection } from './sections/WeOperateSection.jsx';
import { SignatureToursSection } from './sections/SignatureToursSection.jsx';
import { ActivitiesSection } from './sections/ActivitiesSection.jsx';
import { TransfersSection } from './sections/TransfersSection.jsx';
import { CtaSection } from './sections/CtaSection.jsx';
import { Footer } from './sections/Footer.jsx';
import { api as publicApi } from '../../../pages/publicApi.js';
import { useFxRate } from '../../useFxRate.js';

// `expireAdminSession` (set only on the "/" route in App.jsx): a signed-in
// admin who opens the public homepage is logged out — their session is
// ended server-side (POST /auth/logout clears the shared refresh cookie),
// so getting back into the Admin Console means signing in again at /admin.
// /admin itself still sends a signed-in admin straight to the dashboard
// (admin/pages/Login.jsx). Visitors, agents and team users are unaffected,
// and the page renders normally while the session check runs.
export default function LandingPage({ expireAdminSession = false }) {
  useFxRate(() => publicApi.get('/fx-rate'));
  const session = useLandingSession();
  const expiringAdmin = expireAdminSession && isAdminUser(session.user);
  const { logout } = session;

  useEffect(() => {
    if (expiringAdmin) logout();
  }, [expiringAdmin, logout]);

  return (
    <div className="min-h-screen bg-[#F7F3EA]">
      {/* Shown as logged out straight away rather than flashing the admin's
          account menu until the logout call returns. */}
      <Navbar
        session={
          expiringAdmin ? { ...session, status: 'anonymous', user: null, isAuthenticated: false } : session
        }
      />
      <Hero />
      <WeOperateSection />
      <SignatureToursSection />
      <ActivitiesSection />
      <TransfersSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
