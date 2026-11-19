import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LuEye, LuPencil, LuShieldCheck, LuUserPlus, LuUsers } from "react-icons/lu";
import { api } from "../api/client.js";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorText,
  FieldLabel,
  Pagination,
  Select,
  Table,
  TextInput,
} from "../components/ui.jsx";
import { formatDateTime } from "../../shared/components/formatDateTime.js";

// Access Features — the checkboxes that decide both what an LM/RM's /team
// sidebar shows (team/components/TeamLayout.jsx) and, for real, which
// admin.* API routes they can call (backend middleware/auth.js#requireFeature).
// Keys/labels/defaults mirror the backend's own config/accessFeatures.js by
// hand (no shared package between the two repos) — keep the two in sync if
// either ever changes.
const RM_FEATURES = [
  { key: "approvedAgents", label: "Approved Agents" },
  { key: "quotesPricing", label: "Quotes & Pricing" },
  { key: "supportTickets", label: "Support Tickets" },
  { key: "bookingsDocs", label: "Bookings & Docs" },
];
const RM_DEFAULT_PERMISSIONS = {
  approvedAgents: true,
  quotesPricing: false,
  supportTickets: false,
  bookingsDocs: false,
};

const EMPLOYEE_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];
const REGISTERED_DATE_OPTIONS = [
  { value: '', label: 'All registered dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'previous_month', label: 'Previous month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom date range' },
];

const LM_FEATURES = [
  { key: "catalog", label: "Catalogue" },
  { key: "quotesPricing", label: "Quotes & Pricing" },
  { key: "bookingsDocs", label: "Bookings & Docs" },
  { key: "fdOperations", label: "FD Operation" },
];
const LM_DEFAULT_PERMISSIONS = {
  catalog: true,
  quotesPricing: true,
  bookingsDocs: false,
  fdOperations: false,
};

const PAGE_SIZE = 10;

// Keyed by the literal DB role value (users.role) rather than a made-up UI
// alias — the role dropdown below is populated straight from
// GET /admin/employees/roles (employees.controller.js), which returns real
// role strings, so a lookup here only ever needs one identity, never a
// second mapping between "tab key" and "role value". Only these two roles
// are "known" — each still has its own dedicated Create/Edit endpoint and
// Access Features; every other role (Employees.jsx's Add modal "Other"
// branch) has no entry here and gets a synthesized generic kind instead
// (see EmployeeTypeTab/ViewEmployeeModal/EditEmployeeModal's own
// `effectiveKind` below).
const EMPLOYEE_KINDS = {
  relationship_manager: {
    tabLabel: "Relationship Managers",
    heading: "Relationship Managers",
    singular: "Relationship Manager",
    description: "Create and manage the staff assigned as agencies' RMs.",
    endpoint: "/admin/relationship-managers",
    showAssignedAgencies: true,
    features: RM_FEATURES,
    defaultPermissions: RM_DEFAULT_PERMISSIONS,
  },
  sales_manager: {
    tabLabel: "Lead Managers",
    heading: "Lead Managers",
    singular: "Lead Manager",
    description: "Create and manage the lead manager staff pool.",
    endpoint: "/admin/sales-managers",
    showAssignedAgencies: false,
    features: LM_FEATURES,
    defaultPermissions: LM_DEFAULT_PERMISSIONS,
  },
};

// Any role without a dedicated entry above (i.e. everything typed through
// the Add modal's "Other" field) — no Access Features, no dedicated
// create/edit endpoint of its own. Edits for such an employee go through
// the generic PATCH /admin/employees/:id (basic fields + status only,
// employees.controller.js#update) instead of a role-specific one.
function syntheticKind(role, roleLabel) {
  return {
    tabLabel: roleLabel,
    heading: roleLabel,
    singular: roleLabel,
    description:
      "Staff with this role — no Access Features are defined for it yet.",
    endpoint: "/admin/employees",
    showAssignedAgencies: false,
    features: null,
    defaultPermissions: {},
  };
}

function resolveKind(role, roleLabel) {
  return EMPLOYEE_KINDS[role] || syntheticKind(role, roleLabel);
}

// Same local-Modal convention Marketing.jsx and AgentApprovals.jsx already
// use — a plain overlay, not a shared component pulled in from elsewhere.
function Modal({ title, onClose, children, footer, size = "md" }) {
  const sizeClass = size === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='fixed inset-0 bg-black/30' onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[85vh] w-full ${sizeClass} flex-col rounded-lg border border-line-light bg-white p-5 shadow-lg sm:p-6`}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <h3 className='text-lg font-bold text-ink'>{title}</h3>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='text-lg leading-none text-muted hover:text-ink'
          >
            ×
          </button>
        </div>
        <div className='overflow-y-auto'>{children}</div>
        {footer && (
          <div className='mt-5 flex flex-wrap justify-end gap-2 border-t border-line-light pt-4'>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldTile({ label, children }) {
  return (
    <div className='rounded-md bg-panel px-3 py-2'>
      <div className='text-[10px] font-semibold uppercase text-muted'>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

// Shared by the create form and the manage panel — a titled block of
// Access Feature checkboxes for whichever `kind` is active. Only ever
// rendered by callers when `kind.features` is non-null (i.e. a known,
// functional kind) — never called for a synthesized custom-role kind.
function AccessFeaturesFields({ kind, permissions, onChange }) {
  return (
    <div>
      <FieldLabel>Access Features</FieldLabel>
      <div className='rounded-md border border-line-light bg-panel px-3 py-2'>
        {kind.features.map(({ key, label }) => (
          <Checkbox
            key={key}
            checked={!!permissions[key]}
            onChange={(checked) => onChange({ ...permissions, [key]: checked })}
            label={label}
          />
        ))}
      </div>
    </div>
  );
}

// Role choices for the unified Add modal below — the two functional kinds
// (each still goes through its own dedicated endpoint/Access Features,
// unchanged) plus 'other', a free-typed role with no functional kind behind
// it yet (see AddEmployeeModal's own comment).
const ROLE_CHOICES = [
  {
    value: "relationship_manager",
    label: EMPLOYEE_KINDS.relationship_manager.singular,
  },
  { value: "sales_manager", label: EMPLOYEE_KINDS.sales_manager.singular },
  { value: "other", label: "Other" },
];

// No password field — nothing in this app ever collects one anymore. The
// new employee signs in the same way everyone else does: email OTP, using
// the work email entered here.
//
// Single "Add" entry point for both staff kinds (replaces the old two
// separate per-tab "Add Relationship Manager" / "Add Lead Manager" buttons,
// each with their own copy of this same modal) — a Role field picks which
// of the two functional kinds to create (unchanged behavior/endpoint/Access
// Features per kind below), or "Other" to type any other role name. An
// "Other" role is deliberately minimal (product decision): no Access
// Features, no /team portal — it's saved straight onto the new user's
// `role` column (POST /admin/employees/custom-role,
// customRoleEmployees.controller.js) with no dashboard built for it yet.
// Once created, it shows up in the role dropdown below (GET
// /admin/employees/roles) the moment at least one person holds it.
function AddEmployeeModal({ onCreated, onClose }) {
  const [roleChoice, setRoleChoice] = useState("relationship_manager");
  const [customRole, setCustomRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [permissions, setPermissions] = useState(
    EMPLOYEE_KINDS.relationship_manager.defaultPermissions
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const kind = roleChoice === "other" ? null : EMPLOYEE_KINDS[roleChoice];

  function selectRole(value) {
    setRoleChoice(value);
    setError("");
    // Reset permissions to the newly-picked kind's own defaults — carrying
    // RM's Access Features over onto a freshly-selected Lead Manager (or
    // vice versa) would silently save the wrong kind's feature keys.
    if (value !== "other")
      setPermissions(EMPLOYEE_KINDS[value].defaultPermissions);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (kind) {
        const { user } = await api.post(kind.endpoint, {
          fullName,
          email,
          phone: phone || undefined,
          whatsappNumber: whatsappNumber || undefined,
          permissions,
        });
        onCreated({ role: roleChoice, user });
      } else {
        const { user } = await api.post("/admin/employees/custom-role", {
          fullName,
          email,
          phone: phone || undefined,
          whatsappNumber: whatsappNumber || undefined,
          role: customRole,
        });
        onCreated({ role: user.role, user });
      }
    } catch (err) {
      setError(err.message || "Unable to create employee");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title='Add Employee' onClose={onClose}>
      <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-3'>
        <div>
          <FieldLabel>Role</FieldLabel>
          <Select
            value={roleChoice}
            onChange={(e) => selectRole(e.target.value)}
          >
            {ROLE_CHOICES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        {roleChoice === "other" && (
          <div>
            <FieldLabel>Custom role name</FieldLabel>
            <TextInput
              required
              placeholder='e.g. Marketing Manager'
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
            />
            <p className='mt-1 text-xs text-muted'>
              This role has no Access Features or portal login yet — it just
              records the person and their title.
            </p>
          </div>
        )}

        <div>
          <FieldLabel>Full name</FieldLabel>
          <TextInput
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Work email</FieldLabel>
          <TextInput
            type='email'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <FieldLabel>WhatsApp number</FieldLabel>
          <TextInput
            placeholder='+968…'
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
          />
        </div>
        {kind && (
          <AccessFeaturesFields
            kind={kind}
            permissions={permissions}
            onChange={setPermissions}
          />
        )}
        <ErrorText>{error}</ErrorText>
        <div className='flex justify-end gap-2 pt-1'>
          <Button type='button' disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button variant='accent' type='submit' disabled={submitting}>
            {submitting ? "Creating…" : "Create Employee"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Read-only glance — mirrors AgentApprovals.jsx's "View Profile" vs "View
// Details" split: this is the quick view, EditEmployeeModal below is the
// full manage workflow.
function ViewEmployeeModal({ kind, employee, onClose }) {
  return (
    <Modal
      title={employee.fullName}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className='mb-4 flex flex-wrap items-center gap-2'>
        <Badge tone={employee.status === "active" ? "green" : "grey"}>
          {employee.status}
        </Badge>
        <Badge tone='grey'>{employee.roleLabel || kind.singular}</Badge>
      </div>
      <div className='grid gap-3 text-sm sm:grid-cols-2'>
        <FieldTile label='Email address'>{employee.email}</FieldTile>
        <FieldTile label='Phone'>{employee.phone || "—"}</FieldTile>
        <FieldTile label='WhatsApp number'>
          {employee.whatsappNumber || "—"}
        </FieldTile>
        {kind.showAssignedAgencies && (
          <FieldTile label='Assigned agencies'>
            {employee.assignedAgencies.length}
          </FieldTile>
        )}
      </div>
      {kind.showAssignedAgencies && (
        <div className='mt-4'>
          <FieldLabel>Assigned agencies</FieldLabel>
          {employee.assignedAgencies.length === 0 ? (
            <p className='text-xs text-muted'>
              Not yet assigned to any agency.
            </p>
          ) : (
            <div className='space-y-1.5'>
              {employee.assignedAgencies.map((a) => (
                <Link
                  key={a.id}
                  to={`/admin/manage-agents/${a.id}`}
                  className='block rounded-md bg-panel px-3 py-2 text-xs font-semibold text-accent hover:bg-indigo-50 hover:underline'
                >
                  {a.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditEmployeeModal({ kind, employee, onClose, onUpdated }) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [phone, setPhone] = useState(employee.phone || "");
  const [whatsappNumber, setWhatsappNumber] = useState(
    employee.whatsappNumber || ""
  );
  const [permissions, setPermissions] = useState({
    ...kind.defaultPermissions,
    ...employee.permissions,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState("");

  async function save(fields, key) {
    setError("");
    setSubmitting(key);
    try {
      const { user } = await api.patch(
        `${kind.endpoint}/${employee.id}`,
        fields
      );
      onUpdated({ ...employee, ...user });
    } catch (err) {
      setError(
        err.message || `Unable to update ${kind.singular.toLowerCase()}`
      );
    } finally {
      setSubmitting("");
    }
  }

  return (
    <Modal
      title={`Edit ${employee.fullName}`}
      onClose={onClose}
      size='lg'
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className='space-y-5'>
        <Card label='Details' className='border-white shadow-none'>
          <div className='space-y-4 text-sm'>
            <div>
              <FieldLabel>Full name</FieldLabel>
              <TextInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <TextInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>WhatsApp number</FieldLabel>
              <TextInput
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
            </div>

            <ErrorText>{error}</ErrorText>

            <div className='flex flex-wrap gap-2 pt-1'>
              <Button
                variant='accent'
                disabled={!!submitting}
                onClick={() =>
                  save({ fullName, phone, whatsappNumber }, "details")
                }
              >
                {submitting === "details" ? "Saving…" : "Save Changes"}
              </Button>
              {employee.status === "active" ? (
                <Button
                  variant='danger'
                  disabled={!!submitting}
                  onClick={() => save({ status: "disabled" }, "status")}
                >
                  {submitting === "status" ? "Disabling…" : "Disable Account"}
                </Button>
              ) : (
                <Button
                  disabled={!!submitting}
                  onClick={() => save({ status: "active" }, "status")}
                >
                  {submitting === "status" ? "Enabling…" : "Re-enable Account"}
                </Button>
              )}
            </div>
          </div>
        </Card>

        {kind.features && (
          <Card label='Access Features' className='border-white shadow-none'>
            <p className='mb-3 text-xs text-muted'>
              Decides what shows in this {kind.singular.toLowerCase()}'s /team
              sidebar.
            </p>
            <AccessFeaturesFields
              kind={kind}
              permissions={permissions}
              onChange={setPermissions}
            />
            <Button
              variant='accent'
              className='mt-3'
              disabled={!!submitting}
              onClick={() => save({ permissions }, "permissions")}
            >
              {submitting === "permissions"
                ? "Saving…"
                : "Save Access Features"}
            </Button>
          </Card>
        )}

        {kind.showAssignedAgencies && (
          <Card
            label={`Assigned agencies (${employee.assignedAgencies.length})`}
            className='border-white shadow-none'
          >
            {employee.assignedAgencies.length === 0 ? (
              <p className='text-xs text-muted'>
                Not yet assigned to any agency — assign this RM from Agent
                Approvals.
              </p>
            ) : (
              <div className='space-y-1.5'>
                {employee.assignedAgencies.map((a) => (
                <Link
                    key={a.id}
                  to={`/admin/manage-agents/${a.id}`}
                  className='block rounded-md bg-panel px-3 py-2 text-xs font-semibold text-accent hover:bg-indigo-50 hover:underline'
                  >
                    {a.name}
                </Link>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </Modal>
  );
}

// One role's full server-paginated table — remounted (via the parent's
// key=`${role}:${reloadKey}`) on every role switch *and* every successful
// Add-Employee submission, so each staff type gets its own clean
// list/search/page state rather than needing to share or reset it across
// roles. Listing always goes through the one generic, role-filtered
// endpoint (GET /admin/employees?role=…, employees.controller.js) —
// including for Relationship Manager/Lead Manager, which used to each hit
// their own dedicated list endpoint; Create/Edit for those two still use
// their own dedicated endpoints (kind.endpoint), unchanged.
function EmployeeTypeTab({ role, roleLabel }) {
  const kind = resolveKind(role, roleLabel);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [registeredRange, setRegisteredRange] = useState("");
  const [registeredFrom, setRegisteredFrom] = useState("");
  const [registeredTo, setRegisteredTo] = useState("");

  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  function updateSearch(v) {
    setSearch(v);
    setPage(1);
  }

  // Pagination is fully server-side (Task: Employees table), same
  // convention as AgentApprovals.jsx — search and the page slicing itself
  // both round-trip to the API rather than being done client-side.
  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("role", role);
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (registeredRange) params.set("registeredRange", registeredRange);
      if (registeredRange === "custom" && registeredFrom) params.set("registeredFrom", registeredFrom);
      if (registeredRange === "custom" && registeredTo) params.set("registeredTo", registeredTo);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      const data = await api.get(`/admin/employees?${params.toString()}`);
      setEmployees(data.employees);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || `Unable to load ${kind.tabLabel.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, registeredRange, registeredFrom, registeredTo, page]);

  function handleUpdated(updated) {
    setEmployees((list) =>
      list.map((e) => (e.id === updated.id ? updated : e))
    );
    setEditing(updated);
  }

  return (
    <div className='mx-auto max-w-7xl px-6 pb-8 pt-2 lg:px-10'>
      <Card className='mb-5 border-white p-4 sm:p-5'>
        <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px] lg:items-center'>
          <TextInput
            className='w-full'
            placeholder='Search by name, email or phone…'
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
          <Select aria-label='Filter employees by status' value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {EMPLOYEE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Select aria-label='Filter employees by registration date' value={registeredRange} onChange={(e) => { setRegisteredRange(e.target.value); setPage(1); }}>
            {REGISTERED_DATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
        {registeredRange === 'custom' && <div className='mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-[460px]'><div><FieldLabel>Registered from</FieldLabel><TextInput type='date' value={registeredFrom} onChange={(e) => { setRegisteredFrom(e.target.value); setPage(1); }} /></div><div><FieldLabel>Registered to</FieldLabel><TextInput type='date' value={registeredTo} onChange={(e) => { setRegisteredTo(e.target.value); setPage(1); }} /></div></div>}
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className='text-sm text-muted'>Loading…</p>
      ) : employees.length === 0 ? (
        <p className='rounded-lg border border-line-light bg-white p-5 text-sm text-muted shadow-sm'>
          {search
            ? "No one matches that search."
            : `No ${kind.tabLabel.toLowerCase()} yet — click "Add" above to create one.`}
        </p>
      ) : (
        <>
          <Card className='overflow-hidden border-white p-0'>
          <Table
            columns={[
              "Employee",
              "Email",
              "Phone",
              "WhatsApp Number",
              ...(kind.showAssignedAgencies ? ["Assigned Agencies"] : []),
              "Status",
              "Updated",
              { label: "Actions", align: "right" },
            ]}
            rows={employees}
            renderRow={(e) => (
              <tr
                key={e.id}
                className='border-b border-line-light transition-colors last:border-0 hover:bg-panel/50'
              >
                <td className='px-3 py-3 align-middle'>
                  <div className='font-semibold text-ink'>{e.fullName}</div>
                  <div className='mt-1 whitespace-nowrap text-[11px] font-normal text-muted'>
                    Created {formatDateTime(e.createdAt ?? e.created_at)}
                  </div>
                </td>
                <td className='px-3 py-3 align-middle'>{e.email}</td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {e.phone || "—"}
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap'>
                  {e.whatsappNumber || "—"}
                </td>
                {kind.showAssignedAgencies && (
                  <td className='px-3 py-3 align-middle whitespace-nowrap'>
                    {e.assignedAgencies.length === 0 ? (
                      <span className='text-muted'>—</span>
                    ) : (
                      <div className='flex flex-wrap gap-1.5'>
                        {e.assignedAgencies.map((agency) => (
                          <Link
                            key={agency.id}
                            to={`/admin/manage-agents/${agency.id}`}
                            className='rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-accent hover:bg-indigo-100 hover:underline'
                          >
                            {agency.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                )}
                <td className='px-3 py-3 align-middle'>
                  <Badge tone={e.status === "active" ? "green" : "grey"}>
                    {e.status}
                  </Badge>
                </td>
                <td className='px-3 py-3 align-middle whitespace-nowrap text-[11px] text-muted'>
                  {formatDateTime(e.updatedAt ?? e.updated_at)}
                </td>
                <td className='px-3 py-3 align-middle'>
                  <div className='flex flex-nowrap items-center justify-end gap-2'>
                    <Button
                      size='sm'
                      className='whitespace-nowrap'
                      onClick={() => setViewing(e)}
                    >
                      <LuEye className='mr-1.5 flex-shrink-0' size={14} />
                      View
                    </Button>
                    <Button
                      size='sm'
                      className='whitespace-nowrap'
                      onClick={() => setEditing(e)}
                    >
                      <LuPencil className='mr-1.5 flex-shrink-0' size={14} />
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />

          <div className='px-4 pb-4 sm:px-5'><Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onChange={setPage}
            itemLabel={kind.tabLabel.toLowerCase()}
          /></div>
          </Card>
        </>
      )}

      {viewing && (
        <ViewEmployeeModal
          kind={kind}
          employee={viewing}
          onClose={() => setViewing(null)}
        />
      )}
      {editing && (
        <EditEmployeeModal
          kind={kind}
          employee={editing}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

export default function Employees() {
  // The full role list — Relationship Manager and Lead Manager always
  // present (even with zero staff), plus whatever custom roles
  // (Employees.jsx's Add modal "Other" branch) currently have at least one
  // person holding them (GET /admin/employees/roles,
  // employees.controller.js#listRoles). Replaces the old fixed two-tab row:
  // the dropdown below is built entirely from this, so a brand-new custom
  // role appears there with no code change the moment someone's created
  // with it.
  const [roles, setRoles] = useState([]);
  const [rolesError, setRolesError] = useState("");

  async function loadRoles() {
    try {
      const { roles: list } = await api.get("/admin/employees/roles");
      setRoles(list);
    } catch (err) {
      setRolesError(err.message || "Unable to load roles");
    }
  }

  useEffect(() => {
    loadRoles();
  }, []);

  // URL-driven (?role=relationship_manager|sales_manager|…) rather than
  // plain useState — lets Dashboard.jsx's two separate "Relationship
  // Managers"/"Sales Managers" quick links each deep-link straight to their
  // role instead of always landing on whichever happens to be first.
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get("role");
  // Falls back to the first role in the fetched list (or the
  // Relationship Manager default while that fetch is still in flight) —
  // never an arbitrary/unknown value even if roleParam is stale (e.g. a
  // bookmarked link to a custom role that's since had everyone moved off
  // it, and so no longer appears in `roles`).
  const validRoleValues = roles.map((r) => r.role);
  const role =
    roleParam &&
    (validRoleValues.includes(roleParam) || EMPLOYEE_KINDS[roleParam])
      ? roleParam
      : roles[0]?.role || "relationship_manager";
  const roleLabel =
    roles.find((r) => r.role === role)?.label ||
    EMPLOYEE_KINDS[role]?.singular ||
    role;

  function setRole(next) {
    setSearchParams({ role: next });
  }

  const [showAdd, setShowAdd] = useState(false);
  // Bumped on every successful Add-Employee submission and folded into
  // EmployeeTypeTab's own key below — forces a full remount (so its
  // search/page reset and it refetches) whether the new employee's role
  // matches the one already showing or setRole below just changed it (a
  // setSearchParams call to the *same* value it already holds doesn't
  // reliably re-trigger a key change on its own).
  const [reloadKey, setReloadKey] = useState(0);
  // Only meaningful for a brand-new custom role with no prior members —
  // there's a brief window where `roles` (fetched again below) hasn't
  // caught up yet, so this is a fallback confirmation of a successful
  // create rather than something the dropdown/table can show immediately.
  const [addedNote, setAddedNote] = useState("");

  async function handleEmployeeCreated({ role: createdRole, user }) {
    setShowAdd(false);
    setReloadKey((k) => k + 1);
    await loadRoles();
    setRole(createdRole);
    setAddedNote(
      EMPLOYEE_KINDS[createdRole]
        ? ""
        : `${user.fullName} was added with role "${user.role}".`
    );
  }

  return (
    <div className='min-h-screen bg-[#F4F7FF]'>
      <div className='px-6 pb-2 pt-7 lg:px-10 lg:pt-9'>
        <div className='mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-4'>
          <div>
            <h2 className='text-3xl font-bold text-ink'>Employees &amp; Roles</h2>
            <p className='mt-1 text-sm text-muted'>
              Manage internal staff — Relationship Managers, Lead Managers, and
              other roles.
            </p>
          </div>
          <Button variant='accent' className='px-4 py-2.5' onClick={() => setShowAdd(true)}>
            <LuUserPlus className='mr-1.5' size={15} /> Add Employee
          </Button>
        </div>
        <div className='mx-auto mt-6 max-w-7xl'>
          <ErrorText>{rolesError}</ErrorText>
          <div className='max-w-sm'>
            <FieldLabel>Selected role</FieldLabel>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label} ({r.count})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className='mx-auto grid max-w-7xl grid-cols-1 gap-3 px-6 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-10'>
        <Card className='border-white p-4'><div className='flex items-center gap-3'><span className='flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600'><LuUsers size={17} /></span><div><div className='text-[10px] font-semibold uppercase tracking-wide text-muted'>Total employees</div><div className='mt-1 text-2xl font-bold text-ink'>{roles.reduce((sum, item) => sum + Number(item.count || 0), 0)}</div><div className='text-[11px] text-muted'>All internal staff</div></div></div></Card>
        <Card className='border-white p-4'><div className='flex items-center gap-3'><span className='flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600'><LuUserPlus size={17} /></span><div><div className='text-[10px] font-semibold uppercase tracking-wide text-muted'>Relationship managers</div><div className='mt-1 text-2xl font-bold text-ink'>{roles.find((item) => item.role === 'relationship_manager')?.count || 0}</div><div className='text-[11px] text-muted'>Managing agency relations</div></div></div></Card>
        <Card className='border-white p-4'><div className='flex items-center gap-3'><span className='flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600'><LuUserPlus size={17} /></span><div><div className='text-[10px] font-semibold uppercase tracking-wide text-muted'>Other roles</div><div className='mt-1 text-2xl font-bold text-ink'>{roles.filter((item) => item.role !== 'relationship_manager').reduce((sum, item) => sum + Number(item.count || 0), 0)}</div><div className='text-[11px] text-muted'>Lead managers and staff</div></div></div></Card>
        <Card className='border-white p-4'><div className='flex items-center gap-3'><span className='flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600'><LuShieldCheck size={17} /></span><div><div className='text-[10px] font-semibold uppercase tracking-wide text-muted'>Active employees</div><div className='mt-1 text-2xl font-bold text-ink'>{roles.reduce((sum, item) => sum + Number(item.count || 0), 0)}</div><div className='text-[11px] text-muted'>Currently active</div></div></div></Card>
      </div>

      {addedNote && (
        <div className='mx-auto mt-4 max-w-7xl px-6 lg:px-10'>
          <div className='flex items-center justify-between gap-3 rounded-md border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-xs font-semibold text-[#047857]'>
            {addedNote}
            <button
              type='button'
              onClick={() => setAddedNote("")}
              className='text-[#047857]/70 hover:text-[#047857]'
            >
              ×
            </button>
          </div>
        </div>
      )}

      <EmployeeTypeTab
        key={`${role}:${reloadKey}`}
        role={role}
        roleLabel={roleLabel}
      />

      {showAdd && (
        <AddEmployeeModal
          onCreated={handleEmployeeCreated}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
