export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', worker: 'Worker', webmaster: 'Webmaster' };

export function getInitials(first = '', last = '') {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function generateAvatarColor(name = '') {
  const colors = ['bg-brand-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
