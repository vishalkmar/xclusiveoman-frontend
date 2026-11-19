// Agent Notification UI — maps a notification's referenceType to an
// in-portal detail route (doc §11.8's related_entity_type, using the same
// entity strings already written into audit_logs by miceRfqs.controller.js /
// packageRequests.controller.js). Shared by AgentLayout.jsx's header bell
// and Notifications.jsx's full list so the two mappings never drift apart.
// Only entities with an existing detail route are listed.
const REFERENCE_ROUTES = {
  mice_rfq: (id) => `/agent/mice-requests/${id}`,
  package_request: (id) => `/agent/fit-requests/${id}`,
  // Balance Due Reminder (services/balanceDueReminder.service.js on the
  // backend) — referenceType: 'booking'.
  booking: (id) => `/agent/bookings/${id}`,
  // Visa fee paid / NEFT slip rejected (visaPayment.service.js,
  // visaPayments.controller.js) — referenceType: 'visa_application'.
  visa_application: (id) => `/agent/visa/applications/${id}`,
};

export function resolveNotificationPath(referenceType, referenceId) {
  if (!referenceType || !referenceId) return null;
  return REFERENCE_ROUTES[referenceType]?.(referenceId) || null;
}
