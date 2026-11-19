import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import AgentLayout from './components/AgentLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ItineraryPrint from './pages/ItineraryPrint.jsx';
import DepartureItineraryPrint from './pages/DepartureItineraryPrint.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Departures from './pages/Departures.jsx';
import DepartureDetail from './pages/DepartureDetail.jsx';
import PackageBuilder from './pages/PackageBuilder.jsx';
import FitRequests from './pages/FitRequests.jsx';
import QuoteDetail from './pages/QuoteDetail.jsx';
import MiceBuilder from './pages/MiceBuilder.jsx';
import MiceProposalDetail from './pages/MiceProposalDetail.jsx';
import ContentHub from './pages/ContentHub.jsx';
import Bookings from './pages/Bookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import Payment from './pages/Payment.jsx';
import PaymentReturn from './pages/PaymentReturn.jsx';
import Transactions from './pages/Transactions.jsx';
import Revenue from './pages/Revenue.jsx';
import Notifications from './pages/Notifications.jsx';
import Support from './pages/Support.jsx';
import Profile from './pages/Profile.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VisaApply from './pages/VisaApply.jsx';
import VisaTravellers from './pages/VisaTravellers.jsx';
import VisaPhotos from './pages/VisaPhotos.jsx';
import VisaPassports from './pages/VisaPassports.jsx';
import VisaPassportDetails from './pages/VisaPassportDetails.jsx';
import VisaApplications from './pages/VisaApplications.jsx';
import VisaApplicationDetail from './pages/VisaApplicationDetail.jsx';
import VisaPayment from './pages/VisaPayment.jsx';
import VisaPaymentReturn from './pages/VisaPaymentReturn.jsx';

export default function App() {
  return (
    <AuthProvider>
      {/* Portal-wide brand type + ink: Europa Nuova body/headings on #222222,
          scoped to the agent tree so admin/team keep the default stack. Every
          agent page inherits from here — no per-page font class. */}
      <div className="font-agent text-agent-ink">
      <Routes>
        {/* /agent is the agent login (Sign up shown; staff are refused and
            pointed at /login). /agent/login kept as a redirect for old links. */}
        <Route index element={<Login />} />
        <Route path="login" element={<Navigate to="/agent" replace />} />
        <Route path="register" element={<Register />} />
        {/* Public: the emailed "Forgot password" link lands here. */}
        <Route path="reset-password" element={<ResetPassword />} />
        {/* No forgot/reset-password routes — there's no password anywhere
            to forget or reset (email OTP is the sole sign-in mechanism). */}
        {/* Not wrapped in ProtectedRoute/AgentLayout — this is the page the
            itinerary PDF download loads in a hidden iframe (see
            lib/itineraryPdf.js). Authenticates itself via the short-lived
            pdfToken query param, not a login session, so it can't sit behind
            the normal auth gate. */}
        <Route path="itinerary/:id/print" element={<ItineraryPrint />} />
        {/* Same reasoning as above, for FD departure itineraries. */}
        <Route path="departures/:id/print" element={<DepartureItineraryPrint />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AgentLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="departures" element={<Departures />} />
            <Route path="departures/:id" element={<DepartureDetail />} />
            <Route path="package-builder" element={<PackageBuilder />} />
            <Route path="package-builder/:id" element={<PackageBuilder />} />
            <Route path="fit-requests" element={<FitRequests />} />
            <Route path="fit-requests/:id" element={<QuoteDetail />} />
            <Route path="mice-builder" element={<MiceBuilder />} />
            <Route path="mice-builder/:id" element={<MiceBuilder />} />
            {/* My MICE Requests merged into "My Requests / Quotes"
                (fit-requests, above) — old links to the list route just
                land there instead. The detail route is untouched. */}
            <Route path="mice-requests" element={<Navigate to="/agent/fit-requests" replace />} />
            <Route path="mice-requests/:id" element={<MiceProposalDetail />} />
            <Route path="content-hub" element={<ContentHub />} />
            <Route path="visa" element={<VisaApply />} />
            {/* Static "applications" outranks the :id routes below. */}
            <Route path="visa/applications" element={<VisaApplications />} />
            <Route path="visa/applications/:id" element={<VisaApplicationDetail />} />
            <Route path="visa/payments/return" element={<VisaPaymentReturn />} />
            <Route path="visa/:id/pay" element={<VisaPayment />} />
            <Route path="visa/:id/travellers" element={<VisaTravellers />} />
            <Route path="visa/:id/photos" element={<VisaPhotos />} />
            <Route path="visa/:id/passports" element={<VisaPassports />} />
            <Route path="visa/:id/passports/:applicantId" element={<VisaPassportDetails />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:bookingId" element={<BookingDetail />} />
            <Route path="payments/return" element={<PaymentReturn />} />
            <Route path="payments/:bookingId" element={<Payment />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="profile" element={<Profile />} />
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
        </Route>
        <Route index element={<Navigate to="/agent/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/agent/dashboard" replace />} />
      </Routes>
      </div>
    </AuthProvider>
  );
}
