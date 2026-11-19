import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LuBanknote,
  LuBell,
  LuBuilding2,
  LuChevronDown,
  LuClipboardCheck,
  LuContact,
  LuFileText,
  LuHeadset,
  LuInbox,
  LuLandmark,
  LuLayoutDashboard,
  LuLayoutGrid,
  LuImages,
  LuLogOut,
  LuMegaphone,
  LuStar,
  LuPresentation,
  LuReceipt,
  LuScale,
  LuShieldCheck,
  LuSlidersHorizontal,
  LuStamp,
  LuListChecks,
  LuTag,
  LuTicket,
  LuTruck,
  LuUserCheck,
  LuWallet,
} from "react-icons/lu";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { setInlineInr } from "../../shared/currency.js";
import { useFxRate } from "../../shared/useFxRate.js";
import { getSocket } from "../lib/socket.js";
import { NotificationBell } from "../../shared/components/NotificationBell.jsx";
import { Button } from "./ui.jsx";

// Maps a notification's referenceType to an in-portal route — mirrors
// AgentLayout.jsx's own resolveNotificationPath, just admin's own routes.
// 'agency' (New Agent Added — see auth.controller.js's
// notifyAdminsOfNewAgent) resolves to the Agent Approvals list: there's no
// per-agency detail route in the admin portal yet, so the list is as close
// as navigation can currently get.
// 'marketing_campaign' (Marketing campaign scheduled/sent/partially failed/
// failed/cancelled — backend's marketingActivity.service.js#recordCampaignEvent,
// Task 8) resolves to the Marketing Center; Campaign History (Task 7) is a
// tab there, not its own route, so this lands as close as the current
// routing supports — same "list, not per-record detail route" reasoning as
// 'agency' above.
const REFERENCE_ROUTES = {
  agency: () => "/admin/approvals",
  marketing_campaign: () => "/admin/marketing",
  // Visa NEFT slip submitted (visaPayments.controller.js).
  visa_payment: () => "/admin/neft-verification",
  // New paid visa request (visaPayment.service.js) -> that request.
  visa_request: (id) =>
    id ? `/admin/visa-requests/${id}` : "/admin/visa-status",
};

function resolveNotificationPath(referenceType, referenceId) {
  if (!referenceType) return null;
  return REFERENCE_ROUTES[referenceType]?.(referenceId) || null;
}

// Grouped, task-oriented sidebar. Order and wording follow the master
// wireframe (Xclusive-Oman-Wireframes.html / Xclusive-Oman-Master-
// Documentation.pdf §7)'s admin screen sequence: Access & Team (09-11) ->
// Content Catalog (12-13, 35) -> Quotes & Pricing (14-16) -> Marketing
// Center (17) -> Sales, Revenue & Profit (18) -> FD Operations Tracker (19)
// -> Booking & Visa Processing (23) -> Payments (Merchandising & Finance)
// (29-31) -> Support & Helpdesk (28) -> Reviews Management (33) -> Content &
// CMS Management (34). Labels drop the redundant "Admin —" prefix the doc
// uses only to disambiguate admin vs. agent screens in one shared document.
// Dashboard has no wireframe screen (it's a real-app addition as the
// post-login landing page) so it stays first regardless. Icons are
// react-icons (Lucide set) rather than hand-rolled SVGs.
//
// Relationship Managers and Sales Managers used to be two separate sub-items
// (each its own page) — now one "Employees & Roles" entry, whose page has a
// tab per staff type (Employees.jsx).
const NAV_ITEMS = [
  {
    key: "dashboard",
    to: "/admin/dashboard",
    label: "Dashboard",
    Icon: LuLayoutDashboard,
  },
  {
    key: "agencies-team",
    label: "Access & Team",
    Icon: LuBuilding2,
    children: [
      { to: "/admin/approvals", label: "Agent Approvals", Icon: LuUserCheck },
      { to: "/admin/employees", label: "Employees & Roles", Icon: LuContact },
    ],
  },
  {
    key: "catalog",
    label: "Content Catalogue",
    Icon: LuLayoutGrid,
    children: [
      { to: "/admin/catalog", label: "Product Catalogue", Icon: LuLayoutGrid },
      {
        to: "/admin/mice-catalog",
        label: "MICE Catalogue Manager",
        Icon: LuPresentation,
      },
    ],
  },
  // Deals — admin-uploaded promo card photos feeding the agent dashboard's
  // "Deals For You" carousel (agent/pages/Dashboard.jsx), which up to now
  // only ever showed one hardcoded placeholder slide. Flat top-level item,
  // same as Marketing Center/Terms & Conditions below, since it isn't part
  // of either Product or MICE catalog management.
  { key: "deals", to: "/admin/deals", label: "Deals", Icon: LuTag },
  {
    key: "gallery",
    label: "Gallery Management",
    Icon: LuImages,
    children: [
      { to: "/admin/gallery", label: "Landing Images", Icon: LuImages },
      { to: "/admin/gallery/sidebar", label: "Sidebar Image", Icon: LuImages },
    ],
  },
  {
    key: "quotes-pricing",
    label: "Quotes & Pricing",
    Icon: LuInbox,
    children: [
      { to: "/admin/quote-inbox", label: "Quote Inbox", Icon: LuInbox },
      {
        to: "/admin/mice-requests",
        label: "MICE Requests",
        Icon: LuPresentation,
      },
    ],
  },
  {
    key: "marketing",
    to: "/admin/marketing",
    label: "Marketing Center",
    Icon: LuMegaphone,
  },
  // Revenue is the focused admin revenue workspace.
  { key: "revenue", to: "/admin/revenue", label: "Revenue", Icon: LuBanknote },
  {
    key: "operations",
    to: "/admin/operations",
    label: "FD Operations Tracker",
    Icon: LuTruck,
  },
  {
    key: "bookings-documents",
    to: "/admin/bookings-documents",
    label: "Booking & Visa Processing",
    Icon: LuClipboardCheck,
  },
  // Voucher management is part of the booking/document workflow. Keep a
  // dedicated sidebar shortcut while routing into that existing workspace.
  {
    key: "voucher",
    to: "/admin/voucher",
    label: "Voucher Manager",
    Icon: LuTicket,
  },
  // Visa System: Application Tracker (every applied request — as a list or
  // grouped by agency — opening onto the request page where visas are
  // uploaded; it absorbed the old "Visa Issuance" page), and Visa Packages
  // (what agents apply for).
  {
    key: "visa-system",
    label: "Visa Administration",
    Icon: LuStamp,
    children: [
      {
        to: "/admin/visa-setup",
        label: "Create Visa",
        Icon: LuSlidersHorizontal,
      },
      {
        to: "/admin/visa-status",
        label: "Application Tracker",
        Icon: LuListChecks,
        activeFor: ["/admin/visa-requests"],
      },
    ],
  },
  {
    key: "finance",
    label: "Payments",
    Icon: LuWallet,
    children: [
      {
        to: "/admin/transactions",
        label: "Transaction Ledger",
        Icon: LuReceipt,
      },
      {
        to: "/admin/neft-verification",
        label: "NEFT Verification",
        Icon: LuLandmark,
      },
      // FD pre-booking (deposit) rules — global + per package.
      {
        to: "/admin/package-controller",
        label: "Package Controller",
        Icon: LuSlidersHorizontal,
      },
    ],
  },
  {
    key: "support",
    to: "/admin/support",
    label: "Chat Support",
    Icon: LuHeadset,
  },
  // Public legal documents share the same rich-text editor and policy API.
  {
    key: "terms",
    label: "Legal & Policies",
    Icon: LuScale,
    children: [
      {
        to: "/admin/terms?policy=terms",
        label: "Terms & Conditions",
        Icon: LuScale,
      },
      {
        to: "/admin/terms?policy=privacy",
        label: "Privacy Policy",
        Icon: LuShieldCheck,
      },
      {
        to: "/admin/terms?policy=disclaimer",
        label: "Disclaimer",
        Icon: LuFileText,
      },
      {
        to: "/admin/terms?policy=refund",
        label: "Refund Policy",
        Icon: LuFileText,
      },
    ],
  },
  // Security — sign-in / account security settings (currently just a 2FA
  // enable/disable switch, stored client-side until a backend settings route
  // exists). Flat top-level item, same as Terms & Conditions above.
  {
    key: "security",
    to: "/admin/security",
    label: "Security",
    Icon: LuShieldCheck,
  },
  // Admin Reviews Management (Task 21 — Item 33) — ops_admin/super_admin
  // gated on the backend only; not filtered out of NAV_ITEMS for other
  // roles, matching the existing convention for other ops_admin+-only pages
  // (FD Operations, Bookings & Documents above) rather than CMS's own
  // explicit super_admin-only override just below.
  {
    key: "reviews",
    to: "/admin/reviews",
    label: "Reviews Management",
    Icon: LuStar,
  },
];

const EXPANDED_WIDTH = 288; // w-72
const COLLAPSED_WIDTH = 76;

function isActive(pathname, to) {
  const [targetPath, targetQuery] = to.split("?");
  const [currentPath, currentQuery] = pathname.split("?");
  if (currentPath !== targetPath && !currentPath.startsWith(`${targetPath}/`))
    return false;
  return targetQuery ? currentQuery === targetQuery : true;
}

// A nav entry is also active on any of its `activeFor` paths (e.g. the
// tracker stays lit on the visa request pages it opens).
function isItemActive(pathname, item) {
  return (
    isActive(pathname, item.to) ||
    (item.activeFor?.some((p) => isActive(pathname, p)) ?? false)
  );
}

function groupHasActiveChild(pathname, item) {
  return item.children?.some((c) => isItemActive(pathname, c)) ?? false;
}

export default function AdminLayout() {
  const { user, logout, socketConnected, isSuperAdmin } = useAuth();
  // INR sits in small text under each OMR amount here (shared/components/
  // Money.jsx), so the inline "/INR" form of formatCurrency is switched off
  // for as long as the admin console is open.
  useEffect(() => {
    setInlineInr(false);
    return () => setInlineInr(true);
  }, []);
  useFxRate(() => api.get("/fx-rate"));
  const { pathname, search } = useLocation();
  const currentLocation = `${pathname}${search}`;
  const navigate = useNavigate();
  // Starts collapsed (icon rail) — hovering over the sidebar expands it,
  // moving the mouse away collapses it back to give the page its width back.
  const [collapsed, setCollapsed] = useState(true);
  // Content & CMS (Task 21 — Item 34) is the only superAdminOnly entry today
  // — filtered here rather than in NAV_ITEMS itself so the module-level
  // array stays a plain static list every other reader (openGroups init,
  // the active-group effect) can keep using unfiltered; neither of those
  // ever touches this flat, childless item anyway.
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  );
  const [openGroups, setOpenGroups] = useState(() =>
    NAV_ITEMS.filter(
      (item) => item.children && groupHasActiveChild(currentLocation, item)
    ).map((item) => item.key)
  );

  // Keep whichever group holds the current route expanded as navigation happens.
  useEffect(() => {
    const activeGroup = NAV_ITEMS.find(
      (item) => item.children && groupHasActiveChild(currentLocation, item)
    );
    if (activeGroup) {
      setOpenGroups((groups) =>
        groups.includes(activeGroup.key) ? groups : [...groups, activeGroup.key]
      );
    }
  }, [currentLocation]);

  function toggleGroup(key) {
    setOpenGroups((groups) =>
      groups.includes(key) ? groups.filter((g) => g !== key) : [...groups, key]
    );
  }

  // Clicking a group's icon while the rail is collapsed expands straight
  // into that group, rather than needing a separate flyout submenu for the
  // collapsed state.
  function handleGroupClick(key) {
    if (collapsed) {
      setOpenGroups((groups) =>
        groups.includes(key) ? groups : [...groups, key]
      );
    } else {
      toggleGroup(key);
    }
  }

  return (
    <div className='flex min-h-screen bg-[#F4F7FF]'>
      <motion.aside
        initial={{ x: -28, opacity: 0, width: COLLAPSED_WIDTH }}
        animate={{
          x: 0,
          opacity: 1,
          width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        style={{
          background:
            "linear-gradient(180deg, #0F1B4D 0%, #172B68 55%, #24145F 100%)",
        }}
        className='sticky top-0 flex h-screen flex-none flex-col border-r border-white/10'
      >
        {/* Fixed row height/padding regardless of collapsed state — matching
            AgentLayout.jsx's own SidebarContent header (see its comment):
            swapping padding/justify classes on collapse made this whole row
            (and everything below it) shift by a few px instead of just
            crossfading in place. */}
        <div className='flex items-center justify-between border-b border-white/10 px-3 py-5'>
          <div className='relative h-12 flex-1 overflow-hidden'>
            <img
              src='/logo_scroll_closed.png'
              alt='Xclusive Oman'
              className={`absolute left-0 top-1/2 h-10 w-auto -translate-y-1/2 object-contain transition-opacity duration-300 ease-out ${
                collapsed ? "opacity-100" : "opacity-0"
              }`}
            />
            <img
              src='/Xclusive_Oman_Logo_New.png'
              alt='Xclusive Oman'
              className={`absolute left-0 top-1/2 h-12 w-auto -translate-y-1/2 object-contain transition-opacity duration-300 ease-out ${
                collapsed ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>
          <span
            className={`flex-none overflow-hidden whitespace-nowrap rounded-full border border-transparent bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-2.5 py-1 text-xs font-semibold uppercase text-white shadow-sm shadow-black/20 transition-[max-width,opacity] duration-300 ease-out ${
              collapsed ? "max-w-0 !px-0 opacity-0" : "max-w-[80px] opacity-100"
            }`}
          >
            Admin
          </span>
        </div>

        <nav className='flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-5'>
          {visibleNavItems.map((item) => {
            if (!item.children) {
              const active = isActive(currentLocation, item.to);
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-transparent bg-accent-soft text-ink-dark shadow-md shadow-black/15"
                      : "border-transparent text-white/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.Icon className='flex-none' size={18} />
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
                      collapsed
                        ? "max-w-0 opacity-0"
                        : "max-w-[200px] opacity-100"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            }

            const open = !collapsed && openGroups.includes(item.key);
            const hasActiveChild = groupHasActiveChild(currentLocation, item);

            return (
              <div key={item.key}>
                <button
                  type='button'
                  onClick={() => handleGroupClick(item.key)}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg border-l-[3px] px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                    hasActiveChild
                      ? "border-transparent bg-white/10 text-white"
                      : "border-transparent text-white/90 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.Icon className='flex-none' size={18} />
                  <span
                    className={`flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
                      collapsed
                        ? "max-w-0 opacity-0"
                        : "max-w-[200px] opacity-100"
                    }`}
                  >
                    <span>{item.label}</span>
                    <LuChevronDown
                      size={14}
                      className={`flex-none transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className='overflow-hidden'
                    >
                      <div className='ml-3 mt-1 space-y-0.5 border-l border-white/10 pl-4'>
                        {item.children.map((child) => {
                          const active = isItemActive(currentLocation, child);
                          return (
                            <Link
                              key={child.to}
                              to={child.to}
                              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                active
                                  ? "bg-accent-soft text-ink-dark shadow-md shadow-black/15"
                                  : "text-white/85 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <child.Icon className='flex-none' size={15} />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        <div className='space-y-3 border-t border-white/10 px-2 py-5'>
          <div className='flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs'>
            <span
              className={`h-2.5 w-2.5 flex-none rounded-full ${
                socketConnected
                  ? "bg-[#10B981] shadow-[0_0_0_4px_rgba(16,185,129,0.25)]"
                  : "bg-white/30"
              }`}
            />
            <span
              className={`overflow-hidden whitespace-nowrap text-white/70 transition-[max-width,opacity] duration-300 ease-out ${
                collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
              }`}
            >
              {socketConnected ? "Live connection active" : "Connecting…"}
            </span>
          </div>
          <div
            className={`overflow-hidden px-1 text-xs transition-[max-height,opacity] duration-300 ease-out ${
              collapsed ? "max-h-0 opacity-0" : "max-h-12 opacity-100"
            }`}
          >
            <div className='whitespace-nowrap font-semibold text-white'>
              {user?.fullName}
            </div>
            <div className='whitespace-nowrap text-white/60'>{user?.role}</div>
          </div>
          <Button
            onClick={logout}
            title={collapsed ? "Log out" : undefined}
            className='w-full !justify-start gap-2 border-white/15 bg-white/10 px-4 text-white hover:border-white/30 hover:bg-white/20'
          >
            <LuLogOut size={16} className='flex-none' />
            <span
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out ${
                collapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
              }`}
            >
              Log out
            </span>
          </Button>
        </div>
      </motion.aside>

      <div className='min-w-0 flex-1'>
        {/* Slim top bar — just the notification bell for now. print:hidden so
            pages with a printable document (e.g. the agent portal's Review &
            Submit) that ever get reused/rendered under this layout don't pick
            up chrome around the document; harmless here today either way. */}
        <div
          style={{
            background: "linear-gradient(90deg, #EEF4FF, #F5EEFF, #FFF4EC)",
          }}
          className='sticky top-0 z-30 flex items-center justify-end border-b border-[#E4E9FB] px-4 py-2.5 backdrop-blur print:hidden lg:px-8'
        >
          <NotificationBell
            api={api}
            getSocket={getSocket}
            socketConnected={socketConnected}
            resolvePath={resolveNotificationPath}
            onNavigate={navigate}
            icon={LuBell}
            buttonClassName='h-9 w-9 rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white'
          />
        </div>
        <AnimatePresence mode='wait'>
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className='min-h-screen'
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
