/**
 * Staff2 — In-app guidance copy
 *
 * Single source of truth for explainer text so tone stays consistent and copy
 * lives outside components. Used by <PageIntro>, <HelpTip>, <EmptyState> and
 * the onboarding checklist.
 *
 * Keep copy short, plain, and jargon-free — it's read by frontline workers on a
 * phone as much as by admins on a laptop.
 */

// ─── Page intros ──────────────────────────────────────────────
// Keyed by page, then optionally by role. `manager` covers admin + manager;
// `worker` covers everyone else. A page can return different copy per role.
const PAGE_INTROS = {
  dashboard: {
    manager: {
      title: 'Your command center',
      body: 'A live snapshot of your team — plus anything waiting on you.',
      bullets: [
        'Review pending leave, time corrections and messages right here.',
        'Jump into scheduling, staff or costs from the quick links.',
        'The Getting started card guides you through first-time setup.',
      ],
    },
    worker: {
      title: 'Welcome back',
      body: 'Everything you need for your shifts, in one place.',
      bullets: [
        'Clock in and out from My Time.',
        'Check your upcoming shifts on the Calendar.',
        'Set when you can work under My Availability.',
      ],
    },
  },
  time: {
    worker: {
      title: 'Track your hours',
      body: 'Clock in when you start, clock out when you finish — that’s it.',
      bullets: [
        'Tap Clock In to start; the timer runs until you clock out.',
        'Forgot to clock in or out? Use Report Issue to ask a manager to fix it.',
        'Request time off under Leave Requests — your manager gets notified.',
      ],
    },
  },
  calendar: {
    manager: {
      title: 'Build and share the schedule',
      body: 'Plan who works when, then let Auto-Schedule do the heavy lifting.',
      bullets: [
        'Tap a day to add shifts, or use Auto-Schedule to fill the week.',
        'Post an Open Shift for anyone to claim.',
        'Export or print the schedule to share it with your team.',
      ],
    },
    worker: {
      title: 'Your schedule',
      body: 'See your upcoming shifts and pick up open ones.',
      bullets: [
        'Tap any day to see its shifts.',
        'Grab an Open Shift if you want extra hours.',
        'Need to swap? Request a swap from one of your shifts.',
      ],
    },
  },
  staff: {
    manager: {
      title: 'Manage your team',
      body: 'Add people, set how they’re paid, and invite them to the app.',
      bullets: [
        'Add Worker creates a record and (optionally) an invite code.',
        'Pay type decides how costs are calculated — hourly or salaried.',
        'Workers stay Inactive until they accept their invite.',
      ],
    },
  },
  costs: {
    manager: {
      title: 'Costs & billing, explained',
      body: 'See labor costs by month and understand exactly what you pay for Staff2.',
      bullets: [
        'Browse past months for actuals or future months for estimates.',
        'Your plan is set automatically by how many workers you have.',
        'Adding workers or shops may change your price — details below.',
      ],
    },
  },
};

/**
 * Get the intro for a page, resolving role.
 * @param {string} pageKey
 * @param {{ role?: string }} ctx
 * @returns {{ title, body, bullets: string[] } | null}
 */
export function getPageIntro(pageKey, { role } = {}) {
  const page = PAGE_INTROS[pageKey];
  if (!page) return null;
  const isManager = role === 'admin' || role === 'manager';
  if (isManager && page.manager) return page.manager;
  if (page.worker) return page.worker;
  return page.manager || null;
}

// ─── Contextual help tips ─────────────────────────────────────
// Short popover copy keyed by a stable id. Reference with <HelpTip tip="..." />.
export const HELP_TIPS = {
  // Time page
  'leave-requests': 'Ask for time off — holiday, sick or personal. Your manager is notified and can approve or decline. Approved leave shows on the schedule.',
  'time-corrections': 'Made a mistake clocking in or out, or the hours look wrong? Report it here and a manager can fix your record.',
  'worker-messages': 'Send a private note to management — a shift swap, a schedule question, anything work-related.',
  'expected-earnings': 'An estimate based on your logged hours and pay rate. Final pay is confirmed once a manager approves your hours.',

  // Staff page
  'pay-type': 'Hourly staff are costed by hours worked × their rate. Salaried staff have a fixed monthly cost regardless of hours.',
  'invite-codes': 'Share an invite code (or QR) so a worker can create their login and link to their record. Until they join, they stay Inactive.',
  'worker-status': 'Active workers count toward your plan and can be scheduled. Inactive workers (invited but not joined, or archived) don’t.',

  // Calendar page
  'shift-types': 'Shifts are colored by time of day — morning, afternoon or night — so the week is easy to read at a glance.',
  'open-shifts': 'A shift with no one assigned yet. Post it and any eligible worker can claim it from their calendar.',
  'auto-schedule': 'Generates a draft week from your templates and each worker’s availability and target hours. Review the preview before you apply it.',

  // Costs page
  'plan-tiers': 'Your plan is chosen automatically from your active employee count: Free up to 4, Basic up to 30 (€2/employee), and Pro from 31 (€249/mo, up to 50 employees included). The price updates to match.',
  'price-drivers': 'On the Basic plan you pay €2 per billable employee plus €15 per extra shop. Your first 4 employees and first shop are free. Pro is a flat €249/mo with Stock, Checklists and Knowledge Base included.',
  'yearly-billing': 'Pay yearly to get roughly two months free versus paying every month.',
  'proration': 'Change your team mid-month and we only charge the difference for the days left in the current month.',
  'services': 'Fixed-price help (like Staff setup) can be paid right away. Larger jobs (Inventory setup, Knowledge base) are quoted to your business first — asking is free.',
};

// ─── Onboarding steps ─────────────────────────────────────────
/**
 * Manager/admin getting-started steps. Each `done` is derived from live data
 * passed in — no stored flags, so it can never drift from reality.
 *
 * @param {{ shops:number, workers:number, shifts:number, hasBilling:boolean, isPaidTier:boolean }} d
 */
export function getManagerOnboardingSteps(d) {
  const steps = [
    { id: 'shop', label: 'Add your first shop or location', href: '/shops', cta: 'Add shop', done: d.shops > 0 },
    { id: 'staff', label: 'Add your team members', href: '/staff', cta: 'Add staff', done: d.workers > 0 },
    { id: 'schedule', label: 'Create your first shift', href: '/calendar', cta: 'Open calendar', done: d.shifts > 0 },
    { id: 'attendance', label: 'See hours as staff clock in', href: '/attendance', cta: 'View attendance', done: d.attendance > 0 },
  ];
  // Only nudge billing once the org is on a paid tier and hasn't set it up.
  if (d.isPaidTier) {
    steps.push({ id: 'billing', label: 'Set up billing for your plan', href: '/costs', cta: 'Review billing', done: !!d.hasBilling });
  }
  return steps;
}

/**
 * Worker getting-started steps.
 * @param {{ clockedInEver:boolean, hasAvailability:boolean, hasShifts:boolean }} d
 */
export function getWorkerOnboardingSteps(d) {
  return [
    { id: 'clock', label: 'Clock in for your first shift', href: '/time', cta: 'My Time', done: !!d.clockedInEver },
    { id: 'availability', label: 'Tell us when you can work', href: '/availability', cta: 'Set availability', done: !!d.hasAvailability },
    { id: 'schedule', label: 'Check your upcoming shifts', href: '/calendar', cta: 'My Schedule', done: !!d.hasShifts },
  ];
}
