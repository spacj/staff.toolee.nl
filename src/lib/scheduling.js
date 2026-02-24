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
  const tplHours = calcPaidHours(template); // use paid hours (after unpaid break)

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

/**
 * Calculate paid hours for a template, accounting for unpaid break rules.
 */
function calcPaidHours(template) {
  const totalHours = calcHours(template.startTime, template.endTime);
  const unpaidBreakRule = (template.rules || []).find(r => r.type === 'unpaid_break');
  if (unpaidBreakRule && unpaidBreakRule.minutes > 0) {
    return Math.max(0, totalHours - unpaidBreakRule.minutes / 60);
  }
  // Fall back to legacy breakMinutes field if no unpaid_break rule
  if (template.breakMinutes > 0) {
    return Math.max(0, totalHours - template.breakMinutes / 60);
  }
  return totalHours;
}

/**
 * Get the end time as a Date object for rest-hour calculations.
 */
function shiftEndDateTime(dateStr, endTime, startTime) {
  const d = new Date(dateStr);
  const [eh, em] = endTime.split(':').map(Number);
  const [sh] = startTime.split(':').map(Number);
  d.setHours(eh, em, 0, 0);
  // If end is before start, it's an overnight shift — end is next day
  if (eh < sh) d.setDate(d.getDate() + 1);
  return d;
}

function shiftStartDateTime(dateStr, startTime) {
  const d = new Date(dateStr);
  const [sh, sm] = startTime.split(':').map(Number);
  d.setHours(sh, sm, 0, 0);
  return d;
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
  const workerLastShift = {}; // workerId -> { date, startTime, endTime }

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

  // ─── Process each day of the week ────────────────────
  // Uses optimal matching: each worker can only work ONE shift per day.
  // For each day, we build all possible (worker, template) pairs with scores,
  // then greedily assign the best pair first, removing the worker from further
  // consideration and decrementing the template's remaining slots.

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    // Get templates that apply on this day
    const dayTemplates = templates
      .filter(t => getTemplateDays(t).includes(dayOfWeek));

    if (dayTemplates.length === 0) continue;

    // Track remaining slots per template and which workers are already assigned
    const tplSlots = {}; // templateId -> remaining slots needed
    const tplExistingWorkers = {}; // templateId -> Set of already-assigned worker IDs
    const workersAssignedToday = new Set(); // workers who already have a shift today

    // Account for existing shifts (from previous schedule runs)
    for (const tpl of dayTemplates) {
      const needed = getRequiredWorkers(tpl, dayOfWeek);
      const existing = existingShifts.filter(s => s.date === dateStr && s.templateId === tpl.id);
      tplSlots[tpl.id] = Math.max(0, needed - existing.length);
      tplExistingWorkers[tpl.id] = new Set(existing.map(s => s.workerId));
      // Mark workers from existing shifts as already assigned for the day
      existing.forEach(s => workersAssignedToday.add(s.workerId));
    }

    // Also mark workers who have existing shifts on this day (from ANY template)
    existingShifts.filter(s => s.date === dateStr).forEach(s => workersAssignedToday.add(s.workerId));

    // Build all eligible (worker, template) pairs with scores
    const candidates = [];
    const availableWorkers = activeWorkers.filter(w =>
      isWorkerAvailable(w, dateStr, dayOfWeek, leaves) && !workersAssignedToday.has(w.id)
    );

    for (const tpl of dayTemplates) {
      if (tplSlots[tpl.id] <= 0) continue; // template fully filled by existing shifts
      const tplPaidHours = calcPaidHours(tpl);

      for (const worker of availableWorkers) {
        // Skip if already assigned to this template from existing shifts
        if (tplExistingWorkers[tpl.id]?.has(worker.id)) continue;

        // Score check (returns -1 if would exceed max hours)
        const score = scoreWorker(worker, tpl, workerHours, dayOfWeek);
        if (score < 0) continue;

        // Salaried weekly hour cap
        if (worker.payType === 'salaried' && worker.fixedHoursWeek) {
          if ((workerHours[worker.id] || 0) + tplPaidHours > worker.fixedHoursWeek) continue;
        }

        // Check: no night → morning back-to-back from previous day
        const last = workerLastShift[worker.id];
        if (last && last.date !== dateStr && isNightShift(last.startTime) && isMorningShift(tpl.startTime)) {
          // Check it was actually yesterday
          const prevDate = new Date(weekStart);
          prevDate.setDate(prevDate.getDate() + dayOffset - 1);
          if (last.date === prevDate.toISOString().split('T')[0]) continue;
        }

        // Check template-specific rules
        let violatesRule = false;
        for (const rule of tpl.rules || []) {
          if (rule.type === 'min_rest_hours' && rule.hours > 0 && last) {
            const thisStart = shiftStartDateTime(dateStr, tpl.startTime);
            const lastEnd = shiftEndDateTime(last.date, last.endTime, last.startTime);
            const restHours = (thisStart.getTime() - lastEnd.getTime()) / (1000 * 60 * 60);
            if (restHours < rule.hours) { violatesRule = true; break; }
          }
          if (rule.type === 'max_consecutive_days' && rule.days > 0) {
            let consecutive = 0;
            for (let d = dayOffset - 1; d >= 0; d--) {
              const prevD = new Date(weekStart);
              prevD.setDate(prevD.getDate() + d);
              const prevDS = prevD.toISOString().split('T')[0];
              if (assignments.some(a => a.workerId === worker.id && a.templateId === tpl.id && a.date === prevDS)) consecutive++;
              else break;
            }
            if (consecutive >= rule.days) { violatesRule = true; break; }
          }
        }
        if (violatesRule) continue;

        candidates.push({ worker, tpl, score, tplPaidHours });
      }
    }

    // Sort all candidates by score (highest first) — greedy optimal matching
    candidates.sort((a, b) => b.score - a.score);

    // Greedy assignment: pick best pair, assign, remove worker from pool
    const assignedToday = new Set(); // worker IDs assigned in this round
    const tplFilled = {}; // templateId -> count of new assignments this round
    dayTemplates.forEach(t => { tplFilled[t.id] = 0; });

    for (const { worker, tpl, tplPaidHours } of candidates) {
      // Worker already assigned today?
      if (assignedToday.has(worker.id)) continue;
      // Template full?
      if (tplFilled[tpl.id] >= tplSlots[tpl.id]) continue;

      // Check incompatible workers rule against already-assigned workers for this template
      let incompatibleViolation = false;
      for (const rule of tpl.rules || []) {
        if (rule.type === 'incompatible_workers') {
          const incompatible = rule.workers || [rule.workerA, rule.workerB].filter(Boolean);
          if (incompatible.length >= 2 && incompatible.includes(worker.id)) {
            const assignedForTpl = assignments.filter(a => a.date === dateStr && a.templateId === tpl.id);
            if (assignedForTpl.some(a => incompatible.includes(a.workerId))) {
              incompatibleViolation = true;
              break;
            }
          }
        }
      }
      if (incompatibleViolation) continue;

      // Re-check salaried cap (hours may have changed from earlier assignments this day)
      if (worker.payType === 'salaried' && worker.fixedHoursWeek) {
        if ((workerHours[worker.id] || 0) + tplPaidHours > worker.fixedHoursWeek) continue;
      }

      // Assign!
      const tplTotalHours = calcHours(tpl.startTime, tpl.endTime);
      const unpaidBreak = (tpl.rules || []).find(r => r.type === 'unpaid_break');
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
        hours: tplPaidHours,
        totalHours: tplTotalHours,
        unpaidBreakMinutes: unpaidBreak?.minutes || 0,
        type: tpl.type || 'regular',
        autoScheduled: true,
      });

      workerHours[worker.id] = (workerHours[worker.id] || 0) + tplPaidHours;
      if (!workerDayShifts[worker.id][dateStr]) workerDayShifts[worker.id][dateStr] = [];
      workerDayShifts[worker.id][dateStr].push({ startTime: tpl.startTime, endTime: tpl.endTime });
      workerLastShift[worker.id] = { date: dateStr, startTime: tpl.startTime, endTime: tpl.endTime };
      assignedToday.add(worker.id);
      tplFilled[tpl.id]++;
    }

    // Generate warnings for unfilled templates
    for (const tpl of dayTemplates) {
      const needed = getRequiredWorkers(tpl, dayOfWeek);
      const existingCount = existingShifts.filter(s => s.date === dateStr && s.templateId === tpl.id).length;
      const totalFilled = existingCount + (tplFilled[tpl.id] || 0);
      if (totalFilled < needed) {
        warnings.push({
          date: dateStr,
          day: DAY_LABELS[dayOfWeek],
          template: tpl.name,
          needed,
          filled: totalFilled,
          shortBy: needed - totalFilled,
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

/**
 * Check if a date is a public holiday
 */
function isHoliday(dateStr, holidays) {
  if (!holidays) return false;
  return holidays.some(h => h.date === dateStr);
}

/**
 * Check if a time falls in night premium range
 */
function isNightTime(time, nightStart, nightEnd) {
  if (!nightStart || !nightEnd) return false;
  const t = toMinutes(time);
  const s = toMinutes(nightStart);
  const e = toMinutes(nightEnd);
  if (s < e) return t >= s && t <= e; // same day
  return t >= s || t <= e; // overnight
}

/**
 * Check if a time falls in early morning premium range
 */
function isEarlyTime(time, earlyStart, earlyEnd) {
  if (!earlyStart || !earlyEnd) return false;
  const t = toMinutes(time);
  const s = toMinutes(earlyStart);
  const e = toMinutes(earlyEnd);
  if (s < e) return t >= s && t <= e;
  return t >= s || t <= e;
}

/**
 * Calculate cost with overtime rules applied
 * @param {Object} worker - Worker object
 * @param {Array} shifts - Array of shifts for the worker in the period
 * @param {Object} overtimeRules - Overtime rules object
 * @param {Array} holidays - Public holidays array
 * @returns {Object} Cost breakdown including base, overtime, premiums
 */
export function calculateWorkerCostWithOvertime(worker, shifts, overtimeRules = {}, holidays = []) {
  if (worker.payType === 'salaried') {
    // For salaried workers, overtime doesn't apply (fixed salary)
    const totalHours = shifts.reduce((sum, s) => sum + (s.hours || 0), 0);
    return {
      type: 'salaried',
      monthlySalary: worker.monthlySalary || 0,
      hours: totalHours,
      effectiveRate: worker.fixedHoursWeek > 0 ? (worker.monthlySalary / (worker.fixedHoursWeek * 4.33)) : 0,
      baseCost: worker.monthlySalary || 0,
      overtimeCost: 0,
      premiumCost: 0,
      totalCost: worker.monthlySalary || 0,
      breakdown: [],
    };
  }

  const baseRate = worker.costPerHour || 0;
  let totalBaseCost = 0;
  let totalOvertimeCost = 0;
  let totalPremiumCost = 0;
  const breakdown = [];

  // Group shifts by date for daily calculations
  const shiftsByDate = {};
  shifts.forEach(s => {
    if (!shiftsByDate[s.date]) shiftsByDate[s.date] = [];
    shiftsByDate[s.date].push(s);
  });

  // Calculate daily hours and apply daily overtime
  const dailyThreshold = overtimeRules.dailyThreshold || 0;
  const dailyMultiplier = overtimeRules.dailyMultiplier || 1.5;
  const dailyThreshold2 = overtimeRules.dailyThreshold2 || 12;
  const dailyMultiplier2 = overtimeRules.dailyMultiplier2 || 2.0;

  for (const [date, dayShifts] of Object.entries(shiftsByDate)) {
    const dayHours = dayShifts.reduce((sum, s) => sum + (s.hours || 0), 0);
    const isHolidayDay = isHoliday(date, holidays);
    const holidayMultiplier = isHolidayDay ? (overtimeRules.holidayMultiplier || 2.0) : 1.0;

    let dayBaseHours = dayHours;
    let dayOvertimeHours = 0;

    if (dailyThreshold > 0 && dayHours > dailyThreshold) {
      dayOvertimeHours = dayHours - dailyThreshold;
      dayBaseHours = dailyThreshold;
    }

    // Apply time-of-day premiums
    let nightPremiumHours = 0;
    let earlyPremiumHours = 0;

    dayShifts.forEach(shift => {
      const startTime = shift.startTime;
      const shiftHours = shift.hours || 0;

      if (isNightTime(startTime, overtimeRules.nightStart, overtimeRules.nightEnd)) {
        nightPremiumHours += shiftHours;
      }
      if (isEarlyTime(startTime, overtimeRules.earlyStart, overtimeRules.earlyEnd)) {
        earlyPremiumHours += shiftHours;
      }
    });

    const nightPremiumCost = nightPremiumHours * baseRate * ((overtimeRules.nightMultiplier || 1.25) - 1) * weekendMultiplier;
    const earlyPremiumCost = earlyPremiumHours * baseRate * ((overtimeRules.earlyMultiplier || 1.1) - 1) * weekendMultiplier;
    const holidayPremiumCost = dayHours * baseRate * (holidayMultiplier - 1) * weekendMultiplier;

    totalBaseCost += baseCost;
    totalOvertimeCost += overtimeCost + overtime2Cost;
    totalPremiumCost += nightPremiumCost + earlyPremiumCost + holidayPremiumCost;

    breakdown.push({
      date,
      dayHours,
      baseHours: dayBaseHours,
      overtimeHours: dayOvertimeHours,
      overtime2Hours: dayOvertime2Hours,
      nightPremiumHours,
      earlyPremiumHours,
      isHoliday: isHolidayDay,
      isWeekend,
      baseCost,
      overtimeCost,
      overtime2Cost,
      nightPremiumCost,
      earlyPremiumCost,
      holidayPremiumCost,
    });
  }

  // Apply weekly and monthly overtime (simplified - assumes shifts are in order)
  // For now, skip weekly/monthly as it's complex without full period data
  // Would need all shifts for the worker in the week/month

  const totalHours = shifts.reduce((sum, s) => sum + (s.hours || 0), 0);
  const totalCost = totalBaseCost + totalOvertimeCost + totalPremiumCost;

  return {
    type: 'hourly',
    costPerHour: baseRate,
    hours: totalHours,
    baseCost: Math.round(totalBaseCost * 100) / 100,
    overtimeCost: Math.round(totalOvertimeCost * 100) / 100,
    premiumCost: Math.round(totalPremiumCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown,
  };
}

export { getShiftPeriod, calcHours, calcPaidHours, DAY_NAMES, DAY_LABELS, DAY_LABELS_FULL };
