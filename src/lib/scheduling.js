/**
 * ╔═════════════════════════════════════════════════════════════╗
 * ║  Weekly Shift Scheduling Algorithm                         ║
 * ║                                                            ║
 * ║  Features:                                                 ║
 * ║  • Day-specific templates (different shifts per day)       ║
 * ║  • Worker availability per day of week                     ║
 * ║  • Min/max hours per week constraints                      ║
 * ║  • Contracted hours targeting (prefers reaching target)    ║
 * ║  • Shift preference scoring (morning/afternoon/evening)    ║
 * ║  • Salaried workers get priority                           ║
 * ║  • Leave/permit blocking                                   ║
 * ║  • No overlapping shifts                                   ║
 * ║  • No night→morning back-to-back                           ║
 * ║  • Fair distribution across workers                        ║
 * ╚═════════════════════════════════════════════════════════════╝
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Helpers ──────────────────────────────────────────

function getShiftPeriod(startTime) {
  const h = parseInt(startTime);
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17) return 'evening';
  return 'night';
}

function calcHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h <= 0) h += 24;
  return Math.round(h * 10) / 10;
}

function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(s1, e1, s2, e2) {
  const a1 = toMinutes(s1), b1 = toMinutes(e1);
  const a2 = toMinutes(s2), b2 = toMinutes(e2);
  // Handle overnight shifts
  if (b1 <= a1) return true; // overnight shift — simplify: always conflicts
  if (b2 <= a2) return true;
  return a1 < b2 && a2 < b1;
}

function isNightShift(startTime) {
  const h = parseInt(startTime);
  return h >= 20 || h < 4;
}

function isMorningShift(startTime) {
  const h = parseInt(startTime);
  return h >= 5 && h < 10;
}

/**
 * Get which days a template applies to.
 * If template has `daysOfWeek` array (e.g. [1,2,3,4,5] for Mon–Fri), use that.
 * Otherwise, assume all 7 days.
 */
function getTemplateDays(template) {
  if (template.daysOfWeek && Array.isArray(template.daysOfWeek) && template.daysOfWeek.length > 0) {
    return template.daysOfWeek;
  }
  return [0, 1, 2, 3, 4, 5, 6]; // all days
}

/**
 * Get required workers for a template on a specific day.
 * Supports per-day overrides: template.requiredByDay = { 0: 2, 6: 3, ... }
 */
function getRequiredWorkers(template, dayOfWeek) {
  if (template.requiredByDay && template.requiredByDay[String(dayOfWeek)] !== undefined) {
    return parseInt(template.requiredByDay[String(dayOfWeek)]) || 1;
  }
  return template.requiredWorkers || 1;
}

/**
 * Check if a worker is available on a given day.
 */
function isWorkerAvailable(worker, dateStr, dayOfWeek, leaves) {
  // Check availability days (worker.availableDays = [1,2,3,4,5] for Mon–Fri)
  if (worker.availableDays && Array.isArray(worker.availableDays) && worker.availableDays.length > 0) {
    if (!worker.availableDays.includes(dayOfWeek)) return false;
  }

  // Check approved leaves/permits
  if (leaves && leaves.length > 0) {
    const onLeave = leaves.some(
      l => l.workerId === worker.id && dateStr >= l.startDate && dateStr <= (l.endDate || l.startDate)
    );
    if (onLeave) return false;
  }

  // Status check
  if (worker.status !== 'active') return false;

  return true;
}

// ─── Scoring ──────────────────────────────────────────

function scoreWorker(worker, template, workerHours, dayOfWeek) {
  let score = 0;
  const period = getShiftPeriod(template.startTime);
  const pref = worker.shiftPreference || 'any';
  const tplHours = calcHours(template.startTime, template.endTime);

  // 1. Shift preference match (0–25 points)
  if (pref === period) score += 25;
  else if (pref === 'any') score += 10;
  else score += 0; // mismatch — still eligible but low priority

  // 2. Salaried priority (+50) — salaried workers should be scheduled first
  //    to ensure their contracted hours are filled before hourly workers
  if (worker.payType === 'salaried') score += 50;

  // 3. Hours balancing — prefer workers who are under their target (0–20 points)
  const currentHours = workerHours[worker.id] || 0;
  const targetHours = worker.payType === 'salaried'
    ? (worker.fixedHoursWeek || 40)
    : (worker.contractedHours || 20);
  const maxHours = worker.maxHoursWeek || targetHours + 8;
  const minHours = worker.minHoursWeek || 0;

  // Would exceed max?
  if (currentHours + tplHours > maxHours) return -1; // ineligible

  // How far from target? Workers further under target score higher
  const hoursDeficit = Math.max(0, targetHours - currentHours);
  const hoursRatio = Math.min(1, hoursDeficit / Math.max(targetHours, 1));
  score += Math.round(hoursRatio * 20);

  // 4. Shop assignment preference (+8 if assigned to this shop)
  if (worker.shopId && worker.shopId === template.shopId) score += 8;

  // 5. Small random tiebreaker to avoid same worker always winning ties (0–3)
  score += Math.floor(Math.random() * 4);

  return score;
}

// ─── Main Algorithm ───────────────────────────────────

/**
 * Generate a weekly schedule.
 *
 * @param {Object} params
 * @param {Array} params.workers       - All workers (will be filtered to active)
 * @param {Array} params.templates     - Shift templates (with daysOfWeek, requiredByDay)
 * @param {string} params.weekStart    - ISO date string (Monday of the week)
 * @param {Array} params.leaves        - Approved permits/leaves (with startDate, endDate, workerId)
 * @param {Array} params.existingShifts - Already scheduled shifts for this week (to avoid duplicates)
 * @returns {{ assignments: Array, stats: Object, warnings: Array }}
 */
export function generateWeeklySchedule({ workers, templates, weekStart, leaves = [], existingShifts = [] }) {
  const assignments = [];
  const warnings = [];
  const workerHours = {};
  const workerDayShifts = {}; // workerId -> { dateStr: [{ startTime, endTime }] }
  const workerLastShift = {}; // workerId -> { date, startTime }

  const activeWorkers = workers.filter(w => w.status === 'active');
  activeWorkers.forEach(w => { workerHours[w.id] = 0; workerDayShifts[w.id] = {}; });

  // Pre-populate hours from existing shifts
  existingShifts.forEach(s => {
    if (workerHours[s.workerId] !== undefined) {
      workerHours[s.workerId] += s.hours || 0;
      if (!workerDayShifts[s.workerId]) workerDayShifts[s.workerId] = {};
      if (!workerDayShifts[s.workerId][s.date]) workerDayShifts[s.workerId][s.date] = [];
      workerDayShifts[s.workerId][s.date].push({ startTime: s.startTime, endTime: s.endTime });
    }
  });

  // Process each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Get templates that apply on this day, sorted by start time
    const dayTemplates = templates
      .filter(t => getTemplateDays(t).includes(dayOfWeek))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    for (const tpl of dayTemplates) {
      const needed = getRequiredWorkers(tpl, dayOfWeek);
      const tplHours = calcHours(tpl.startTime, tpl.endTime);
      let filled = 0;

      // Score and rank eligible workers
      const ranked = activeWorkers
        .filter(w => isWorkerAvailable(w, dateStr, dayOfWeek, leaves))
        .map(w => ({ worker: w, score: scoreWorker(w, tpl, workerHours, dayOfWeek) }))
        .filter(({ score }) => score >= 0) // -1 means ineligible (would exceed max hours)
        .sort((a, b) => b.score - a.score);

      for (const { worker } of ranked) {
        if (filled >= needed) break;

        // Check: no overlapping shifts this day
        const dayAssigns = workerDayShifts[worker.id]?.[dateStr] || [];
        const overlaps = dayAssigns.some(a => timesOverlap(a.startTime, a.endTime, tpl.startTime, tpl.endTime));
        if (overlaps) continue;

        // Check: no night → morning back-to-back
        const last = workerLastShift[worker.id];
        if (last?.date === dateStr && isNightShift(last.startTime) && isMorningShift(tpl.startTime)) continue;

        // Check rules
        let violatesRule = false;
        for (const rule of tpl.rules || []) {
          if (rule.type === 'incompatible_workers') {
            const assignedForThisShift = assignments.filter(a => a.date === dateStr && a.templateId === tpl.id);
            const assignedWorkerIds = assignedForThisShift.map(a => a.workerId);
            if (rule.workers.includes(worker.id) && assignedWorkerIds.some(id => rule.workers.includes(id))) {
              violatesRule = true;
              break;
            }
          }
        }
        if (violatesRule) continue;

        // Check: salaried workers should not exceed their contracted weekly hours
        if (worker.payType === 'salaried' && worker.fixedHoursWeek) {
          const currentH = workerHours[worker.id] || 0;
          if (currentH + tplHours > worker.fixedHoursWeek) continue;
        }

        // Assign!
        assignments.push({
          workerId: worker.id,
          workerName: `${worker.firstName} ${worker.lastName}`,
          shopId: tpl.shopId,
          templateId: tpl.id,
          templateName: tpl.name,
          date: dateStr,
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek],
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          hours: tplHours,
          type: tpl.type || 'regular',
          autoScheduled: true,
        });

        workerHours[worker.id] = (workerHours[worker.id] || 0) + tplHours;
        if (!workerDayShifts[worker.id][dateStr]) workerDayShifts[worker.id][dateStr] = [];
        workerDayShifts[worker.id][dateStr].push({ startTime: tpl.startTime, endTime: tpl.endTime });
        workerLastShift[worker.id] = { date: dateStr, startTime: tpl.startTime };
        filled++;
      }

      if (filled < needed) {
        warnings.push({
          date: dateStr,
          day: DAY_LABELS[dayOfWeek],
          template: tpl.name,
          needed,
          filled,
          shortBy: needed - filled,
        });
      }
    }
  }

  // Check: workers under minimum hours
  activeWorkers.forEach(w => {
    const minH = w.minHoursWeek || 0;
    if (minH > 0 && (workerHours[w.id] || 0) < minH) {
      warnings.push({
        type: 'under_hours',
        worker: `${w.firstName} ${w.lastName}`,
        workerId: w.id,
        assigned: workerHours[w.id] || 0,
        minimum: minH,
      });
    }
  });

  // Stats
  const stats = {
    totalShifts: assignments.length,
    totalHours: Object.values(workerHours).reduce((a, b) => a + b, 0),
    workerHours: { ...workerHours },
    perDay: {},
    unfilled: warnings.filter(w => w.shortBy).length,
    underHours: warnings.filter(w => w.type === 'under_hours').length,
  };

  // Per-day breakdown
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const ds = date.toISOString().split('T')[0];
    const dayShifts = assignments.filter(a => a.date === ds);
    stats.perDay[ds] = {
      day: DAY_LABELS[date.getDay()],
      shifts: dayShifts.length,
      hours: dayShifts.reduce((s, a) => s + a.hours, 0),
      workers: [...new Set(dayShifts.map(a => a.workerId))].length,
    };
  }

  return { assignments, stats, warnings };
}

// ─── Cost Calculation ─────────────────────────────────

export function calculateWorkerCost(worker, hoursWorked) {
  if (worker.payType === 'salaried') {
    return {
      type: 'salaried',
      monthlySalary: worker.monthlySalary || 0,
      hours: hoursWorked,
      effectiveRate: worker.fixedHoursWeek > 0 ? (worker.monthlySalary / (worker.fixedHoursWeek * 4.33)) : 0,
    };
  }
  const cost = hoursWorked * (worker.costPerHour || 0);
  return {
    type: 'hourly',
    costPerHour: worker.costPerHour || 0,
    hours: hoursWorked,
    total: Math.round(cost * 100) / 100,
  };
}

export { getShiftPeriod, calcHours, DAY_NAMES, DAY_LABELS, DAY_LABELS_FULL };
