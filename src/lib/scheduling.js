/**
 * Shift Scheduling Algorithm
 *
 * Priority:
 * 1. Salaried workers whose shiftPreference matches the template type
 * 2. Salaried workers with "any" preference
 * 3. Hourly workers whose shiftPreference matches
 * 4. Workers with fewest assigned hours (fairness)
 *
 * Template type mapping:
 *   morning:   startTime 05:00–11:59
 *   afternoon: startTime 12:00–16:59
 *   evening:   startTime 17:00–23:59
 *   night:     startTime 00:00–04:59
 *
 * Safety: no night→morning back-to-back (within same day)
 */

function getShiftPeriod(startTime) {
  const h = parseInt(startTime);
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17) return 'evening';
  return 'night';
}

export function generateWeeklySchedule(workers, preferences, templates, startDate) {
  const assignments = [];
  const workerHours = {};
  const workerLastShift = {};
  const activeWorkers = workers.filter(w => w.status === 'active');
  activeWorkers.forEach(w => { workerHours[w.id] = 0; });

  // Score a worker for a template (higher = better fit)
  function scoreWorker(worker, tpl) {
    const period = getShiftPeriod(tpl.startTime);
    const pref = worker.shiftPreference || 'any';
    let score = 0;

    // Preference match: +20 if exact match, +5 for 'any', 0 for mismatch
    if (pref === period) score += 20;
    else if (pref === 'any') score += 5;
    // If pref is a specific period that doesn't match, score stays 0

    // Salaried bonus: +10
    if (worker.payType === 'salaried') score += 10;

    // Fairness: fewer hours = higher score (max +8)
    const maxHours = 60;
    score += Math.max(0, 8 - Math.floor((workerHours[worker.id] || 0) / maxHours * 8));

    return score;
  }

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];

    for (const tpl of templates) {
      const needed = tpl.requiredWorkers || 1;
      const tplHours = calcHours(tpl.startTime, tpl.endTime);
      let filled = 0;

      // Sort workers by score for this template
      const ranked = [...activeWorkers]
        .map(w => ({ ...w, score: scoreWorker(w, tpl) }))
        .filter(w => w.score > 0) // Only workers who have some preference match or are flexible
        .sort((a, b) => b.score - a.score);

      for (const worker of ranked) {
        if (filled >= needed) break;

        // Safety: no night→morning back-to-back
        const last = workerLastShift[worker.id];
        if (last?.date === dateStr && isNightShift(last) && isMorningShift(tpl)) continue;

        // Salaried: check weekly hour cap
        if (worker.payType === 'salaried' && worker.fixedHoursWeek) {
          if ((workerHours[worker.id] || 0) >= worker.fixedHoursWeek) continue;
        }

        // Already assigned to overlapping shift this day?
        const dayAssignments = assignments.filter(a => a.workerId === worker.id && a.date === dateStr);
        const overlaps = dayAssignments.some(a => timesOverlap(a.startTime, a.endTime, tpl.startTime, tpl.endTime));
        if (overlaps) continue;

        assignments.push({
          workerId: worker.id,
          workerName: `${worker.firstName} ${worker.lastName}`,
          shopId: tpl.shopId,
          templateId: tpl.id,
          templateName: tpl.name,
          date: dateStr,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          hours: tplHours,
          type: tpl.type || 'regular',
        });
        workerHours[worker.id] = (workerHours[worker.id] || 0) + tplHours;
        workerLastShift[worker.id] = { date: dateStr, ...tpl };
        filled++;
      }
    }
  }

  return assignments;
}

function calcHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h <= 0) h += 24;
  return Math.round(h * 10) / 10;
}

function timesOverlap(s1, e1, s2, e2) {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const a1 = toMin(s1), b1 = toMin(e1), a2 = toMin(s2), b2 = toMin(e2);
  return a1 < b2 && a2 < b1;
}

function isNightShift(s) { const h = parseInt(s.startTime); return h >= 20 || h < 4; }
function isMorningShift(s) { const h = parseInt(s.startTime); return h >= 5 && h < 10; }

export function calculateWorkerCost(worker, hoursWorked) {
  if (worker.payType === 'salaried') {
    return { type: 'salaried', monthlySalary: worker.monthlySalary || 0, hours: hoursWorked, effectiveRate: worker.fixedHoursWeek > 0 ? (worker.monthlySalary / (worker.fixedHoursWeek * 4.33)) : 0 };
  }
  const cost = hoursWorked * (worker.costPerHour || 0);
  return { type: 'hourly', costPerHour: worker.costPerHour || 0, hours: hoursWorked, total: Math.round(cost * 100) / 100 };
}

export { getShiftPeriod };
