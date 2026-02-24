import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch,
  onSnapshot, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { getTier, calculateCost, FREE_WORKER_LIMIT } from './pricing';

const C = {
  USERS: 'users', ORGANIZATIONS: 'organizations', WORKERS: 'workers',
  SHOPS: 'shops', SHIFT_TEMPLATES: 'shiftTemplates', SHIFTS: 'shifts',
  SHIFT_PREFERENCES: 'shiftPreferences', ATTENDANCE: 'attendance',
  PERMITS: 'permits', PAYMENTS: 'payments', NOTIFICATIONS: 'notifications',
  ACTIVITY_LOG: 'activityLog', INVITES: 'invites', REFERRALS: 'referrals',
  CORRECTION_REQUESTS: 'correctionRequests', MESSAGES: 'messages',
  WEBMASTER_REFERRAL_CODES: 'webmasterReferralCodes', WEBMASTER_EARNINGS: 'webmasterEarnings',
};

// ─── Helpers ──────────────────────────────────────────
function ser(docSnap) {
  if (!docSnap.exists()) return null;
  const d = docSnap.data();
  return { id: docSnap.id, ...d,
    createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt,
  };
}
function serAll(snap) { return snap.docs.map(ser); }
const ts = () => serverTimestamp();

async function add(col, data) {
  const ref = await addDoc(collection(db, col), { ...data, createdAt: ts(), updatedAt: ts() });
  return ref.id;
}
async function upd(col, id, data) { await updateDoc(doc(db, col, id), { ...data, updatedAt: ts() }); }
async function del(col, id) { await deleteDoc(doc(db, col, id)); }
async function get1(col, id) { return ser(await getDoc(doc(db, col, id))); }
async function getAll(col, ...constraints) {
  return serAll(await getDocs(query(collection(db, col), ...constraints)));
}

// ─── Users ────────────────────────────────────────────
export const getUserByReferralCode = async (code) => {
  const snap = await getDocs(query(collection(db, C.USERS), where('referralCode', '==', code.toUpperCase())));
  return snap.empty ? null : ser(snap.docs[0]);
};
export const updateUserProfile = (uid, data) => upd(C.USERS, uid, data);

// ─── Organizations ────────────────────────────────────
export const getOrganization = (id) => get1(C.ORGANIZATIONS, id);
export const updateOrganization = (id, data) => upd(C.ORGANIZATIONS, id, data);

export async function syncOrgPlan(orgId) {
  const workers = await getAll(C.WORKERS, where('orgId', '==', orgId), where('status', '==', 'active'));
  const shops = await getAll(C.SHOPS, where('orgId', '==', orgId));
  const org = await get1(C.ORGANIZATIONS, orgId);
  const freeLimit = org?.freeWorkerLimit || FREE_WORKER_LIMIT;
  const newTier = getTier(workers.length, freeLimit);
  const cost = calculateCost(workers.length, shops.length, 'monthly', freeLimit);
  await upd(C.ORGANIZATIONS, orgId, { plan: newTier, activeWorkerCount: workers.length, shopCount: shops.length, monthlyCost: cost.total });

  // Sync PayPal subscription quantity (fire-and-forget)
  try {
    const subId = org?.subscriptionId;
    if (subId && org.subscriptionStatus === 'active') {
      if (newTier === 'free') {
        fetch('/api/paypal/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: subId, action: 'suspend' }) });
      } else if (newTier === 'standard') {
        const qty = Math.round(cost.total * 100); // cents for PayPal quantity
        if (qty !== (org.subscriptionQuantity || 0)) {
          fetch('/api/paypal/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: subId, action: 'update_quantity', quantity: qty }) });
          await upd(C.ORGANIZATIONS, orgId, { subscriptionQuantity: qty, previousMonthlyCost: org.monthlyCost || 0 });
        }
      }
    } else if (subId && org.subscriptionStatus === 'suspended' && newTier !== 'free') {
      fetch('/api/paypal/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriptionId: subId, action: 'activate' }) });
    }
  } catch {}
  return { plan: newTier, activeWorkerCount: workers.length, shopCount: shops.length };
}

// ─── Overtime Rules (org-level defaults) ──────────────
export async function getOvertimeRules(orgId) {
  const org = await get1(C.ORGANIZATIONS, orgId);
  return org?.overtimeRules || {
    dailyThreshold: 0,       // hours/day before overtime kicks in (0 = disabled)
    dailyMultiplier: 1.5,    // pay multiplier for daily overtime
    dailyMultiplier2: 2.0,   // second tier daily OT multiplier (e.g. double time)
    dailyThreshold2: 12,     // hours for second tier (0 = disabled)
    weeklyThreshold: 0,      // hours/week before overtime (0 = disabled)
    weeklyMultiplier: 1.5,   // pay multiplier for weekly overtime
    monthlyThreshold: 0,     // hours/month before overtime (0 = disabled)
    monthlyMultiplier: 1.5,  // pay multiplier for monthly overtime
    weekendMultiplier: 1.25, // weekend premium multiplier (applied to all hours on Sat/Sun)
    nightStart: '',          // night premium start time (HH:MM)
    nightEnd: '',            // night premium end time
    nightMultiplier: 1.25,   // night premium multiplier
    earlyStart: '',          // early morning premium start time
    earlyEnd: '',            // early morning premium end time
    earlyMultiplier: 1.1,    // early morning premium multiplier
    holidayMultiplier: 2.0,  // pay multiplier on public holidays
    enabled: false,
  };
}
export async function saveOvertimeRules(orgId, rules) {
  await upd(C.ORGANIZATIONS, orgId, { overtimeRules: rules });
}

// ─── Public Holidays (org-level) ──────────────────────
export async function getPublicHolidays(orgId) {
  const org = await get1(C.ORGANIZATIONS, orgId);
  return org?.publicHolidays || [];
  // Each: { date: 'YYYY-MM-DD', name: 'King\'s Day', multiplier?: 2.0 }
}
export async function savePublicHolidays(orgId, holidays) {
  await upd(C.ORGANIZATIONS, orgId, { publicHolidays: holidays });
}

// ─── Invites ──────────────────────────────────────────
function genCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
export async function createInvite(data) { const code = genCode(); const ref = await addDoc(collection(db, C.INVITES), { ...data, code, used: false, createdAt: ts() }); return { id: ref.id, code }; }
export async function getInviteByCode(code) { const snap = await getDocs(query(collection(db, C.INVITES), where('code', '==', code.toUpperCase()), where('used', '==', false))); return snap.empty ? null : ser(snap.docs[0]); }
export async function markInviteUsed(id, userId) { await upd(C.INVITES, id, { used: true, usedBy: userId, usedAt: ts() }); }
export const getInvites = (orgId) => getAll(C.INVITES, where('orgId', '==', orgId), orderBy('createdAt', 'desc'));

// ─── Referrals ──────────────────────────────────────────
export async function createReferral(data) { return add(C.REFERRALS, data); }
export async function getReferrals(filters = {}) {
  const c = [];
  if (filters.referrerId) c.push(where('referrerId', '==', filters.referrerId));
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  c.push(orderBy('createdAt', 'desc'));
  return getAll(C.REFERRALS, ...c);
}
export const getReferral = (id) => get1(C.REFERRALS, id);

// ─── Workers ──────────────────────────────────────────
export async function getWorkers(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  if (filters.shopId) c.push(where('shopId', '==', filters.shopId));
  if (filters.status) c.push(where('status', '==', filters.status));
  c.push(orderBy('lastName', 'asc'));
  return getAll(C.WORKERS, ...c);
}
export const getWorker = (id) => get1(C.WORKERS, id);
export const createWorker = (data) => add(C.WORKERS, { ...data, status: data.status || 'active' });
export const updateWorker = (id, data) => upd(C.WORKERS, id, data);
export const deleteWorker = (id) => del(C.WORKERS, id);

// ─── Shops ────────────────────────────────────────────
export const getShops = (orgId) => getAll(C.SHOPS, where('orgId', '==', orgId), orderBy('name', 'asc'));
export const getShop = (id) => get1(C.SHOPS, id);
export const createShop = (data) => add(C.SHOPS, { ...data, workerCount: 0 });
export const updateShop = (id, data) => upd(C.SHOPS, id, data);
export const deleteShop = (id) => del(C.SHOPS, id);

// ─── Shift Templates ─────────────────────────────────
export async function getShiftTemplates(orgId, shopId) {
  const c = [where('orgId', '==', orgId)];
  if (shopId) c.push(where('shopId', '==', shopId));
  c.push(orderBy('startTime', 'asc'));
  return getAll(C.SHIFT_TEMPLATES, ...c);
}
export const getShiftTemplate = (id) => get1(C.SHIFT_TEMPLATES, id);
export const createShiftTemplate = (data) => add(C.SHIFT_TEMPLATES, data);
export const updateShiftTemplate = (id, data) => upd(C.SHIFT_TEMPLATES, id, data);
export const deleteShiftTemplate = (id) => del(C.SHIFT_TEMPLATES, id);

// ─── Shifts (assigned) ───────────────────────────────
export async function getShifts(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  if (filters.workerId) c.push(where('workerId', '==', filters.workerId));
  if (filters.shopId) c.push(where('shopId', '==', filters.shopId));
  if (filters.startDate) c.push(where('date', '>=', filters.startDate));
  if (filters.endDate) c.push(where('date', '<=', filters.endDate));
  c.push(orderBy('date', 'asc'));
  return getAll(C.SHIFTS, ...c);
}
export const createShift = (data) => add(C.SHIFTS, data);
export const updateShift = (id, data) => upd(C.SHIFTS, id, data);
export const deleteShift = (id) => del(C.SHIFTS, id);
export async function bulkCreateShifts(shifts) {
  const batch = writeBatch(db);
  shifts.forEach(s => { const ref = doc(collection(db, C.SHIFTS)); batch.set(ref, { ...s, createdAt: ts(), updatedAt: ts() }); });
  await batch.commit();
}

// ─── Shift Preferences ───────────────────────────────
export const getShiftPreferences = (workerId) => getAll(C.SHIFT_PREFERENCES, where('workerId', '==', workerId));
export async function setShiftPreference(data) {
  const snap = await getDocs(query(collection(db, C.SHIFT_PREFERENCES), where('workerId', '==', data.workerId), where('dayOfWeek', '==', data.dayOfWeek)));
  if (snap.empty) await add(C.SHIFT_PREFERENCES, data);
  else await upd(C.SHIFT_PREFERENCES, snap.docs[0].id, data);
}

// ─── Attendance (multi-entry per day, with approval) ──
export async function getAttendance(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  if (filters.workerId) c.push(where('workerId', '==', filters.workerId));
  if (filters.shopId) c.push(where('shopId', '==', filters.shopId));
  if (filters.startDate) c.push(where('date', '>=', filters.startDate));
  if (filters.endDate) c.push(where('date', '<=', filters.endDate));
  if (filters.approvalStatus) c.push(where('approvalStatus', '==', filters.approvalStatus));
  c.push(orderBy('date', 'desc'));
  if (filters.limit) c.push(limit(filters.limit));
  return getAll(C.ATTENDANCE, ...c);
}
export const updateAttendance = (id, data) => upd(C.ATTENDANCE, id, data);
export const deleteAttendance = (id) => del(C.ATTENDANCE, id);

// Create attendance manually (admin/manager) — for adding records for any date
export async function createAttendance(data) {
  const entries = (data.entries || []).map(e => ({
    clockIn: e.clockIn,
    clockOut: e.clockOut || null,
  }));
  const totalHours = entries.reduce((sum, e) => {
    if (!e.clockIn || !e.clockOut) return sum;
    return sum + Math.max(0, (new Date(e.clockOut) - new Date(e.clockIn)) / 3600000);
  }, 0);
  const allClosed = entries.length > 0 && entries.every(e => e.clockOut);
  return add(C.ATTENDANCE, {
    workerId: data.workerId,
    workerName: data.workerName || '',
    orgId: data.orgId,
    shopId: data.shopId || '',
    date: data.date,
    entries,
    totalHours: Math.round(totalHours * 100) / 100,
    status: allClosed ? 'completed' : (entries.length > 0 ? 'clocked-in' : 'completed'),
    approvalStatus: data.approvalStatus || 'approved',
    approvedBy: data.approvedBy || null,
    approvedAt: data.approvedAt || new Date().toISOString(),
    adminNotes: data.adminNotes || 'Manually created by management',
  });
}

// Clock in: creates a new attendance doc with one entry, or adds entry to existing doc for same day
export async function clockIn(data) {
  const { workerId, date } = data;
  // Check if there's already a doc for this worker+date
  const existing = await getDocs(query(
    collection(db, C.ATTENDANCE),
    where('workerId', '==', workerId),
    where('date', '==', date)
  ));
  const now = new Date().toISOString();
  if (!existing.empty) {
    // Add a new time entry to the existing day record
    const existingDoc = existing.docs[0];
    const existingData = existingDoc.data();
    const entries = existingData.entries || [];
    // Check no open entry
    const openEntry = entries.find(e => !e.clockOut);
    if (openEntry) throw new Error('Already clocked in. Clock out first.');
    entries.push({ clockIn: now, clockOut: null });
    await upd(C.ATTENDANCE, existingDoc.id, { entries, status: 'clocked-in', approvalStatus: 'pending' });
    return existingDoc.id;
  } else {
    // Create new attendance doc for this day
    return add(C.ATTENDANCE, {
      ...data,
      entries: [{ clockIn: now, clockOut: null }],
      status: 'clocked-in',
      approvalStatus: 'pending',
      totalHours: 0,
      approvedBy: null, approvedAt: null,
    });
  }
}

// Clock out: closes the open entry in today's attendance doc
export async function clockOut(attendanceId) {
  const rec = await get1(C.ATTENDANCE, attendanceId);
  if (!rec) throw new Error('Attendance record not found.');
  const entries = rec.entries || [];
  const openIdx = entries.findIndex(e => !e.clockOut);
  if (openIdx === -1) throw new Error('No open clock-in entry.');
  const now = new Date().toISOString();
  entries[openIdx].clockOut = now;
  // Calculate total hours across all entries
  const totalHours = entries.reduce((sum, e) => {
    if (!e.clockIn || !e.clockOut) return sum;
    return sum + Math.max(0, (new Date(e.clockOut) - new Date(e.clockIn)) / 3600000);
  }, 0);
  const allClosed = entries.every(e => e.clockOut);
  await upd(C.ATTENDANCE, attendanceId, {
    entries,
    totalHours: Math.round(totalHours * 100) / 100,
    status: allClosed ? 'completed' : 'clocked-in',
  });
}

// Get active clock in for today
export async function getActiveClockIn(workerId, date) {
  try {
    const snap = await getDocs(query(
      collection(db, C.ATTENDANCE),
      where('workerId', '==', workerId),
      where('date', '==', date),
      where('status', '==', 'clocked-in')
    ));
    return snap.empty ? null : ser(snap.docs[0]);
  } catch (e) {
    const snap = await getDocs(query(
      collection(db, C.ATTENDANCE),
      where('workerId', '==', workerId),
      where('status', '==', 'clocked-in')
    ));
    const match = snap.docs.find(d => d.data().date === date);
    return match ? ser(match) : null;
  }
}

// Approve/reject attendance hours
export async function approveAttendance(attendanceId, approvedBy, approved, notes) {
  await upd(C.ATTENDANCE, attendanceId, {
    approvalStatus: approved ? 'approved' : 'rejected',
    approvedBy,
    approvedAt: new Date().toISOString(),
    adminNotes: notes || '',
  });
}

// ─── Permits ──────────────────────────────────────────
export async function getPermits(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  if (filters.workerId) c.push(where('workerId', '==', filters.workerId));
  if (filters.status) c.push(where('status', '==', filters.status));
  c.push(orderBy('createdAt', 'desc'));
  if (filters.limit) c.push(limit(filters.limit));
  return getAll(C.PERMITS, ...c);
}
export const createPermit = (data) => add(C.PERMITS, { ...data, status: 'pending' });
export const updatePermit = (id, data) => upd(C.PERMITS, id, data);
export const deletePermit = (id) => del(C.PERMITS, id);

// ─── Payments ─────────────────────────────────────────
export async function getPayments(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  c.push(orderBy('createdAt', 'desc'));
  if (filters.limit) c.push(limit(filters.limit));
  return getAll(C.PAYMENTS, ...c);
}
export const createPayment = (data) => add(C.PAYMENTS, data);

// ─── Notifications ────────────────────────────────────
export async function getNotifications(uid, lim = 20) {
  return getAll(C.NOTIFICATIONS, where('recipientId', '==', uid), orderBy('createdAt', 'desc'), limit(lim));
}
export const markNotificationRead = (id) => upd(C.NOTIFICATIONS, id, { read: true });
export async function markAllNotificationsRead(uid) {
  const unread = await getDocs(query(collection(db, C.NOTIFICATIONS), where('recipientId', '==', uid), where('read', '==', false)));
  const batch = writeBatch(db);
  unread.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}
export const createNotification = (data) => add(C.NOTIFICATIONS, { ...data, read: false });

// Send notification to all managers in org
export async function notifyManagers(orgId, data) {
  const users = await getDocs(query(collection(db, C.USERS), where('orgId', '==', orgId)));
  const managers = users.docs.filter(d => ['admin', 'manager'].includes(d.data().role));
  for (const m of managers) {
    await createNotification({ ...data, recipientId: m.id, orgId });
  }
}

// Send notification to a specific worker
export async function notifyWorker(workerId, orgId, data) {
  // Find user by workerId link
  const users = await getDocs(query(collection(db, C.USERS), where('orgId', '==', orgId), where('workerId', '==', workerId)));
  for (const u of users.docs) {
    await createNotification({ ...data, recipientId: u.id, orgId });
  }
}

// Real-time listener for notifications
export function onNotifications(uid, callback) {
  return onSnapshot(
    query(collection(db, C.NOTIFICATIONS), where('recipientId', '==', uid), orderBy('createdAt', 'desc'), limit(20)),
    (snap) => callback(serAll(snap)),
    (err) => console.warn('Notification listener error:', err)
  );
}

// ─── Activity Log ─────────────────────────────────────
export async function logActivity(data) { await add(C.ACTIVITY_LOG, data); }
export async function getActivityLog(lim = 20) { return getAll(C.ACTIVITY_LOG, orderBy('createdAt', 'desc'), limit(lim)); }

// ─── Correction Requests ──────────────────────────────
// Workers submit these when they forgot to clock in/out or have wrong hours
// Schema: { orgId, workerId, workerName, date, type: 'missed_clockin'|'missed_clockout'|'wrong_hours'|'other',
//           requestedClockIn, requestedClockOut, message, status: 'pending'|'approved'|'rejected',
//           attendanceId?, reviewedBy, reviewedAt, adminNotes }
export async function getCorrectionRequests(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  let results = await getAll(C.CORRECTION_REQUESTS, ...c);
  // Client-side filtering and sorting to avoid composite index requirement
  if (filters.workerId) results = results.filter(r => r.workerId === filters.workerId);
  if (filters.status) results = results.filter(r => r.status === filters.status);
  results.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}
export const createCorrectionRequest = (data) => add(C.CORRECTION_REQUESTS, { ...data, status: 'pending' });
export async function reviewCorrectionRequest(id, approved, reviewedBy, adminNotes = '') {
  await upd(C.CORRECTION_REQUESTS, id, {
    status: approved ? 'approved' : 'rejected',
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    adminNotes,
  });
}

// ─── Messages (Worker ↔ Management) ──────────────────
// Schema: { orgId, senderId, senderName, senderRole: 'worker'|'manager'|'admin',
//           recipientId?, recipientName?, recipientRole?,
//           conversationId?, subject, body, read: false, parentId? (for replies) }
export async function getMessages(filters = {}) {
  const c = [];
  if (filters.orgId) c.push(where('orgId', '==', filters.orgId));
  let results = await getAll(C.MESSAGES, ...c);
  // Client-side filtering and sorting to avoid composite index requirement
  if (filters.recipientType) results = results.filter(r => r.recipientType === filters.recipientType);
  if (filters.recipientId) results = results.filter(r => r.recipientId === filters.recipientId);
  if (filters.senderId) results = results.filter(r => r.senderId === filters.senderId);
  if (filters.conversationId) results = results.filter(r => r.conversationId === filters.conversationId);
  results.sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function getConversations(userId, orgId, userRole, workers = []) {
  const all = await getMessages({ orgId, limit: 200 });
  const convMap = new Map();
  
  for (const m of all) {
    // Determine conversation partner
    let partnerId, partnerName, partnerRole;
    
    // Check if message is from management (for workers) or to management (for managers)
    const isToManagement = m.recipientType === 'management';
    const isFromManagement = m.senderRole === 'manager' || m.senderRole === 'admin';
    
    if (m.senderId === userId) {
      // Message sent by current user
      partnerId = m.recipientId;
      partnerName = m.recipientName;
      partnerRole = m.recipientRole;
    } else if (m.recipientId === userId) {
      // Message directly sent to current user
      partnerId = m.senderId;
      partnerName = m.senderName;
      partnerRole = m.senderRole;
    } else if (isToManagement && (userRole === 'manager' || userRole === 'admin')) {
      // Worker message to management - show as conversation with that worker
      partnerId = m.senderId;
      partnerName = m.senderName;
      partnerRole = m.senderRole;
    } else if (isFromManagement && m.recipientType === 'management') {
      // Management message to workers - show as conversation with management
      partnerId = m.senderId;
      partnerName = m.senderName;
      partnerRole = m.senderRole;
    } else {
      continue;
    }
    
    if (!partnerId) continue;
    
    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        partnerId,
        partnerName: partnerName || (workers.find(w => w.id === partnerId) ? `${workers.find(w => w.id === partnerId).firstName} ${workers.find(w => w.id === partnerId).lastName}` : 'Unknown'),
        partnerRole: partnerRole || (workers.find(w => w.id === partnerId)?.role || 'worker'),
        lastMessage: m,
        unreadCount: 0,
      });
    }
    // Count unread
    if (m.recipientId === userId && !m.read) {
      const conv = convMap.get(partnerId);
      conv.unreadCount++;
    }
  }
  
  return Array.from(convMap.values()).sort((a, b) => (b.lastMessage.createdAt || '') > (a.lastMessage.createdAt || '') ? 1 : -1);
}

export const createMessage = (data) => add(C.MESSAGES, { ...data, read: false });
export const markMessageRead = (id) => upd(C.MESSAGES, id, { read: true });
export async function getMessageThread(parentId) {
  const replies = await getAll(C.MESSAGES, where('parentId', '==', parentId));
  replies.sort((a, b) => (a.createdAt || '') > (b.createdAt || '') ? 1 : -1);
  const parent = await get1(C.MESSAGES, parentId);
  return parent ? [parent, ...replies] : replies;
}

// ─── Webmaster: Organizations (cross-org read) ───────
export async function getAllOrganizations() {
  return getAll(C.ORGANIZATIONS, orderBy('createdAt', 'desc'));
}

// ─── Webmaster: All Users (for enriching company owner info) ─
export async function getAllUsers() {
  return getAll(C.USERS);
}

// ─── Webmaster: All Referrals (cross-org) ─────────────
export async function getAllReferrals() {
  return getAll(C.REFERRALS, orderBy('createdAt', 'desc'));
}

// ─── Webmaster: All Payments (cross-org) ──────────────
export async function getAllPayments() {
  return getAll(C.PAYMENTS, orderBy('createdAt', 'desc'));
}

// ─── Webmaster Referral Codes ─────────────────────────
// Schema: { code, description, commissionPercent, commissionFlat, isActive, usageCount, createdBy, createdAt }
export async function getWebmasterReferralCodes(webmasterUid) {
  return getAll(C.WEBMASTER_REFERRAL_CODES, where('createdBy', '==', webmasterUid), orderBy('createdAt', 'desc'));
}
export async function createWebmasterReferralCode(data) {
  return add(C.WEBMASTER_REFERRAL_CODES, { ...data, usageCount: 0, isActive: true });
}
export async function updateWebmasterReferralCode(id, data) {
  return upd(C.WEBMASTER_REFERRAL_CODES, id, data);
}
export async function deleteWebmasterReferralCode(id) {
  return del(C.WEBMASTER_REFERRAL_CODES, id);
}
export async function getWebmasterReferralCodeByCode(code) {
  const snap = await getDocs(query(collection(db, C.WEBMASTER_REFERRAL_CODES), where('code', '==', code.toUpperCase()), where('isActive', '==', true)));
  return snap.empty ? null : ser(snap.docs[0]);
}

// ─── Webmaster Earnings ───────────────────────────────
// Schema: { webmasterUid, orgId, orgName, referralCodeId, referralCode, amount, type: 'commission'|'bonus', status: 'pending'|'paid', paidAt?, createdAt }
export async function getWebmasterEarnings(webmasterUid) {
  return getAll(C.WEBMASTER_EARNINGS, where('webmasterUid', '==', webmasterUid), orderBy('createdAt', 'desc'));
}
export async function createWebmasterEarning(data) {
  return add(C.WEBMASTER_EARNINGS, data);
}
export async function updateWebmasterEarning(id, data) {
  return upd(C.WEBMASTER_EARNINGS, id, data);
}

// ─── Webmaster: All Workers count (cross-org) ─────────
export async function getAllWorkersCount() {
  const snap = await getDocs(query(collection(db, C.WORKERS), where('status', '==', 'active')));
  return snap.size;
}

export { C as COLLECTIONS };
