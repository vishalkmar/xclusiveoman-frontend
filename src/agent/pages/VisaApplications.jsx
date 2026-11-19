import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LuArrowRight,
  LuChevronDown,
  LuEye,
  LuInbox,
  LuPlus,
  LuSearchX,
  LuStamp,
} from "react-icons/lu";
import { api } from "../api/client.js";
import { ErrorText } from "../components/ui.jsx";
import { Amount } from "../components/ledger/Amount.jsx";
import {
  EmptyState,
  ListCaption,
  ListSkeleton,
} from "../components/ledger/ListStates.jsx";
import { PageHeading } from "../components/ledger/PageHeading.jsx";
import { Pagination } from "../components/ledger/Pagination.jsx";
import { SearchFilters } from "../components/ledger/SearchFilters.jsx";
import { StatusBadge } from "../components/ledger/StatusBadge.jsx";
import {
  formatLedgerDate,
  storedApplicationReference,
  matchesQuery,
  plural,
  shortId,
} from "../components/ledger/ledgerUtils.js";
import { usePagination } from "../components/ledger/usePagination.js";
import {
  STATUS_GROUPS,
  applicationProgress,
  applicationStage,
  continuePath,
  progressShare,
  stageMeta,
} from "../components/visa/visaMeta.js";

// Visa Hub → Track Applications: every visa application of the agency,
// with its live status. Each application is tied to the agent who started it
// (visa_applications.created_by_user_id → users), shown as "Applied by" and
// filterable to "Only mine". Reuses GET /visa/applications; filtering and
// paging run client-side over that list, like Bookings.

const ICON = { strokeWidth: 1.75, "aria-hidden": true };
const FIELD =
  "h-10 w-full appearance-none rounded-lg border border-agent-line-light bg-white pl-3 pr-8 text-[13px] text-agent-ink focus:border-agent-accent-dark focus:outline-none focus:ring-2 focus:ring-agent-accent/20";

const PERIODS = [
  { key: "all", label: "Any time" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
];

const totalOf = (a) =>
  a.visaCategory?.price != null
    ? a.visaCategory.price * (a.applicantCount || 0)
    : null;
const searchParts = (a) => [
  a.id,
  a.visaType?.name,
  a.visaCategory?.name,
  stageMeta(applicationStage(a)).label,
  a.createdBy?.name,
  ...(a.travellerNames || []),
];

function MiniSelect({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className='sr-only'>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <LuChevronDown
        aria-hidden
        className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-agent-muted'
      />
    </label>
  );
}

// Names · Photos · Passports — done / total for each step.
function ProgressSteps({ application, compact = false }) {
  const p = applicationProgress(application);
  const steps = [
    ["Names", p.names],
    ["Photos", p.photos],
    ["Passports", p.passports],
  ];
  return (
    <div className={compact ? "" : "min-w-0"}>
      <div
        className='flex h-1.5 overflow-hidden rounded-full bg-bk-line-soft'
        aria-hidden
      >
        <span
          className='h-full rounded-full bg-bk-accent transition-all'
          style={{ width: `${Math.round(progressShare(application) * 100)}%` }}
        />
      </div>
      <p className='mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-bk-muted'>
        {steps.map(([label, done]) => (
          <span key={label} className='whitespace-nowrap'>
            {label}{" "}
            <span
              className={`font-semibold tabular-nums ${
                done === p.total ? "text-bk-success-ink" : "text-bk-ink"
              }`}
            >
              {done}/{p.total}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

function Travellers({ application }) {
  const names = application.travellerNames || [];
  const count = application.applicantCount || 0;
  return (
    <span className='block min-w-0'>
      <span className='block text-[13px] font-semibold text-bk-ink'>
        {count} {plural(count, "traveller")}
      </span>
      <span
        className='block truncate text-[12px] text-bk-muted'
        title={names.join(", ")}
      >
        {names.length ? names.join(", ") : "Names not added yet"}
      </span>
    </span>
  );
}

function Actions({ application, stretch = false }) {
  const next =
    application.status === "draft" ? continuePath(application) : null;
  const size = `h-8 gap-1.5 rounded-lg text-[12.5px] font-semibold ${
    stretch ? "flex-1" : ""
  }`;
  return (
    <div
      className={`flex items-center gap-2 ${stretch ? "" : "justify-end"}`}
      onClick={(e) => e.stopPropagation()}
    >
      {next && (
        <Link
          to={next}
          className={`inline-flex items-center justify-center whitespace-nowrap bg-[#9A6A3A] px-3 text-white shadow-sm transition-colors hover:bg-[#7F552E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A3A]/40 ${size}`}
        >
          {applicationStage(application) === "ready" ? "Pay fee" : "Continue"}{" "}
          <LuArrowRight {...ICON} className='h-3.5 w-3.5 text-[#FFCA75]' />
        </Link>
      )}
      <Link
        to={`/agent/visa/applications/${application.id}`}
        className={`inline-flex items-center justify-center whitespace-nowrap border border-bk-line bg-white px-3 text-bk-ink transition-colors hover:border-bk-ink/30 hover:bg-bk-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent/40 ${size}`}
      >
        <LuEye {...ICON} className='h-3.5 w-3.5 text-bk-muted' /> Details
      </Link>
    </div>
  );
}

function VisaTitle({ application }) {
  return (
    <span className='flex min-w-0 items-center gap-2'>
      <LuStamp {...ICON} className='h-4 w-4 flex-none text-bk-accent' />
      <span className='truncate text-[13.5px] font-semibold text-bk-ink'>
        {application.visaType?.name}{" "}
        <span className='font-normal text-bk-muted'>
          · {application.visaCategory?.name}
        </span>
      </span>
    </span>
  );
}

const appliedBy = (a) => (a.createdBy?.isMe ? "You" : a.createdBy?.name || "—");

function ApplicationsList({ applications }) {
  const navigate = useNavigate();
  const open = (a) => navigate(`/agent/visa/applications/${a.id}`);
  return (
    <>
      <div className='hidden overflow-x-auto xl:block'>
        <table className='w-full min-w-[1000px] table-fixed text-left'>
          <colgroup>
            <col />
            <col className='w-[220px]' />
            <col className='w-[200px]' />
            <col className='w-[132px]' />
            <col className='w-[160px]' />
            <col className='w-[210px]' />
          </colgroup>
          <thead>
            <tr className='text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted'>
              <th scope='col' className='px-5 pb-3 pt-4 font-semibold'>
                Visa · Applied
              </th>
              <th scope='col' className='px-3 pb-3 pt-4 font-semibold'>
                Travellers
              </th>
              <th scope='col' className='px-3 pb-3 pt-4 font-semibold'>
                Progress
              </th>
              <th
                scope='col'
                className='px-3 pb-3 pt-4 text-right font-semibold'
              >
                Total
              </th>
              <th scope='col' className='pb-3 pl-6 pr-3 pt-4 font-semibold'>
                Status
              </th>
              <th
                scope='col'
                className='px-5 pb-3 pt-4 text-right font-semibold'
              >
                <span className='sr-only'>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => {
              const meta = stageMeta(applicationStage(a));
              const total = totalOf(a);
              return (
                <tr
                  key={a.id}
                  onClick={() => open(a)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(a);
                    }
                  }}
                  tabIndex={0}
                  role='link'
                  aria-label={`Open visa application ${shortId(a.id)}`}
                  className='group cursor-pointer border-t border-bk-line-soft transition-colors hover:bg-bk-hover focus:outline-none focus-visible:bg-bk-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bk-accent'
                >
                  <td className='relative px-5 py-4 align-middle'>
                    {meta.group === "in_progress" && (
                      <span
                        aria-hidden
                        className='absolute inset-y-3 left-0 w-[3px] rounded-r bg-bk-pending'
                      />
                    )}
                    <VisaTitle application={a} />
                    <span className='mt-1 flex items-center gap-2 whitespace-nowrap text-[12px] text-bk-muted'>
                      <span className='font-mono tracking-tight' title={a.id}>
                        ID: {storedApplicationReference(a)}
                      </span>
                      <span
                        aria-hidden
                        className='h-0.5 w-0.5 rounded-full bg-bk-muted'
                      />
                      <span className='tabular-nums'>
                        {formatLedgerDate(a.createdAt)}
                      </span>
                      {/* <span className='truncate'>by {appliedBy(a)}</span> */}
                    </span>
                  </td>
                  <td className='px-3 py-4 align-middle'>
                    <Travellers application={a} />
                  </td>
                  <td className='px-3 py-4 align-middle'>
                    <ProgressSteps application={a} />
                  </td>
                  <td className='px-3 py-4 align-middle'>
                    {total != null ? (
                      <Amount value={total} align='right' />
                    ) : (
                      <span className='block text-right text-[12px] text-bk-muted'>
                        —
                      </span>
                    )}
                  </td>
                  <td className='py-4 pl-6 pr-3 align-middle'>
                    <StatusBadge tone={meta.tone} label={meta.label} />
                  </td>
                  <td className='px-5 py-4 align-middle'>
                    <Actions application={a} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Below xl: one card per application (two across on tablets). */}
      {/* grid-cols-1 (= minmax(0,1fr)) so long traveller names truncate
          instead of widening the card past the screen. */}
      <ul className='grid grid-cols-1 gap-3 p-3 sm:p-4 md:grid-cols-2 xl:hidden'>
        {applications.map((a) => {
          const meta = stageMeta(applicationStage(a));
          const total = totalOf(a);
          return (
            <li
              key={a.id}
              onClick={() => open(a)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(a);
                }
              }}
              tabIndex={0}
              role='link'
              aria-label={`Open visa application ${shortId(a.id)}`}
              className={`flex min-w-0 cursor-pointer flex-col rounded-xl border bg-white p-4 transition-colors hover:border-bk-accent/50 hover:bg-bk-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-bk-accent ${
                meta.group === "in_progress"
                  ? "border-bk-pending/40"
                  : "border-bk-line"
              }`}
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <VisaTitle application={a} />
                  <p className='mt-1 truncate text-[12px] text-bk-muted'>
                    <span className='font-mono' title={a.id}>
                      ID: {storedApplicationReference(a)}
                    </span>{" "}
                    · {formatLedgerDate(a.createdAt)} · by {appliedBy(a)}
                  </p>
                </div>
                <StatusBadge tone={meta.tone} label={meta.label} />
              </div>
              <div className='mt-3 grid grid-cols-2 gap-3 rounded-xl bg-bk-hover px-3.5 py-3'>
                <Travellers application={a} />
                <div className='min-w-0'>
                  <p className='text-[10.5px] font-semibold uppercase tracking-[0.12em] text-bk-muted'>
                    Total
                  </p>
                  <div className='mt-1'>
                    {total != null ? (
                      <Amount value={total} />
                    ) : (
                      <span className='text-[12px] text-bk-muted'>—</span>
                    )}
                  </div>
                </div>
              </div>
              <div className='mt-3'>
                <ProgressSteps application={a} compact />
              </div>
              <div className='mt-auto pt-3'>
                <Actions application={a} stretch />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function VisaApplications() {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");

  useEffect(() => {
    api
      .get("/visa/applications")
      .then(({ applications: list }) => setApplications(list || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Visa-type tabs from the types actually applied for.
  const typeTabs = useMemo(() => {
    const seen = new Map();
    applications.forEach(
      (a) => a.visaType && seen.set(a.visaType.id, a.visaType.name)
    );
    return [
      { key: "all", label: "All visas" },
      ...[...seen.entries()].map(([key, label]) => ({ key, label })),
    ];
  }, [applications]);
  const typeCounts = useMemo(() => {
    const counts = { all: applications.length };
    applications.forEach(
      (a) => (counts[a.visaType?.id] = (counts[a.visaType?.id] || 0) + 1)
    );
    return counts;
  }, [applications]);

  // The overview follows the type tab only; status, period and search
  // then narrow the list beneath it.
  const ofType = useMemo(
    () =>
      type === "all"
        ? applications
        : applications.filter((a) => a.visaType?.id === type),
    [applications, type]
  );
  const visible = useMemo(() => {
    const since =
      period === "all" ? null : Date.now() - Number(period) * 86400000;
    return ofType.filter(
      (a) =>
        (group === "all" || stageMeta(applicationStage(a)).group === group) &&
        (!since || new Date(a.createdAt).getTime() >= since) &&
        matchesQuery(searchParts(a), query)
    );
  }, [ofType, group, period, query]);
  const pager = usePagination(
    visible,
    [type, group, period, query],
    "visa-applications-list"
  );

  const stats = useMemo(() => {
    const travellers = ofType.reduce((s, a) => s + (a.applicantCount || 0), 0);
    const value = ofType.reduce((s, a) => s + (totalOf(a) || 0), 0);
    const visasIssued = ofType.reduce((s, a) => s + (a.visasIssued || 0), 0);
    return {
      travellers,
      value,
      visasIssued,
    };
  }, [ofType]);

  const scopeLabel = typeTabs.find((t) => t.key === type)?.label;
  const filtered = group !== "all" || period !== "all" || query.trim() !== "";
  const filterLabel = [
    group !== "all" && STATUS_GROUPS.find((g) => g.key === group)?.label,
    period !== "all" && PERIODS.find((p) => p.key === period)?.label,
  ]
    .filter(Boolean)
    .join(" · ");

  function clearFilters() {
    setGroup("all");
    setPeriod("all");
    setQuery("");
  }

  return (
    <div className='w-full p-4 sm:p-5 lg:p-6'>
      <PageHeading
        compact
        theme='agent'
        title='Track Applications'
        subtitle='Every visa application your agency has started, with its live status.'
      />

      {error && (
        <div className='mt-4'>
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <div className='rounded-xl border border-agent-line-light bg-white p-4'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.14em] text-agent-muted'>Total visa fees · {scopeLabel}</p>
            <Amount theme='agent' value={stats.value} size='lg' className='mt-1' />
          </div>
          <div className='rounded-xl border border-agent-line-light bg-white p-4'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.14em] text-agent-muted'>Total travellers</p>
            <p className='mt-2 text-2xl font-bold tabular-nums text-agent-ink'>{stats.travellers}</p>
          </div>
          <div className='rounded-xl border border-agent-line-light bg-white p-4'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.14em] text-agent-muted'>Applications</p>
            <p className='mt-2 text-2xl font-bold tabular-nums text-agent-ink'>{ofType.length}</p>
          </div>
          <div className='rounded-xl border border-agent-line-light bg-white p-4'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.14em] text-agent-muted'>Visas issued</p>
            <p className='mt-2 text-2xl font-bold tabular-nums text-agent-ink'>{stats.visasIssued} <span className='text-xs font-normal text-agent-muted'>of {stats.travellers}</span></p>
          </div>
        </div>
      )}

      <div className='mt-4 flex flex-col gap-2.5 rounded-xl border border-agent-line-light bg-white/70 p-2.5 shadow-[0_1px_3px_rgba(23,36,58,0.03)] xl:flex-row xl:items-center'>
        <div className='flex w-full flex-col gap-2 sm:flex-row xl:justify-start'>
          <SearchFilters
            theme='agent'
            className='xl:flex-1 xl:[&>label:first-child]:w-auto xl:[&>label:first-child]:flex-1'
            query={query}
            onQueryChange={setQuery}
            placeholder='Search traveller, visa or ID'
            filter={group}
            onFilterChange={setGroup}
            options={STATUS_GROUPS}
          />
          <MiniSelect
            label='Visa type'
            className='sm:w-44'
            value={type}
            onChange={setType}
            options={typeTabs.map((tab) => ({ ...tab, label: `${tab.label} (${typeCounts[tab.key] || 0})` }))}
          />
          <MiniSelect
            label='Date applied'
            className='sm:w-36'
            value={period}
            onChange={setPeriod}
            options={PERIODS}
          />
        </div>
      </div>

      <section
        id='visa-applications-list'
        aria-label='Visa applications'
        className='mt-4 scroll-mt-6 overflow-hidden rounded-2xl border border-bk-line bg-white'
      >
        {!loading && applications.length > 0 && (
          <ListCaption
            filtered={filtered}
            shown={visible.length}
            total={ofType.length}
            noun='application'
            scopeLabel={scopeLabel}
            filterLabel={filterLabel || undefined}
            onClear={clearFilters}
          />
        )}

        {loading ? (
          <ListSkeleton />
        ) : applications.length === 0 ? (
          error ? (
            <EmptyState
              icon={LuInbox}
              title="Visa applications couldn't be loaded"
            >
              Refresh the page to try again.
            </EmptyState>
          ) : (
            <EmptyState icon={LuStamp} title='No visa applications yet'>
              <Link
                to='/agent/visa'
                className='inline-flex items-center gap-1 font-semibold text-bk-accent-strong hover:underline'
              >
                <LuPlus {...ICON} className='h-3.5 w-3.5' /> Start a visa
                application
              </Link>
            </EmptyState>
          )
        ) : visible.length === 0 ? (
          <EmptyState icon={LuSearchX} title='No applications match'>
            {filtered ? (
              <button
                type='button'
                onClick={clearFilters}
                className='font-semibold text-bk-accent-strong hover:underline'
              >
                Clear the filters
              </button>
            ) : (
              `There are no ${scopeLabel} applications yet.`
            )}
          </EmptyState>
        ) : (
          <>
            <ApplicationsList applications={pager.rows} />
            <Pagination {...pager.pagination} itemLabel='applications' />
          </>
        )}
      </section>
    </div>
  );
}
