'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllOrganizations, getAllUsers, getAllReferrals, getAllPayments,
  getWebmasterReferralCodes, createWebmasterReferralCode,
  updateWebmasterReferralCode, deleteWebmasterReferralCode,
  getWebmasterEarnings, createWebmasterEarning, updateWebmasterEarning,
} from '@/lib/firestore';
import { formatCurrency } from '@/lib/pricing';
import { cn, formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';
import {
  Building2, Users, DollarSign, TrendingUp, Gift, Eye, EyeOff,
  Plus, Edit3, Trash2, Copy, Check, Search, Filter, ChevronDown,
  ChevronUp, ArrowUpRight, BarChart3, Activity, Tag, Hash,
  Calendar, Clock, CreditCard, Shield, AlertCircle, RefreshCw,
  X, ToggleLeft, ToggleRight, Download, ExternalLink,
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'earnings', label: 'Earnings', icon: DollarSign },
  { id: 'referrals', label: 'Referral Codes', icon: Tag },
];

export default function WebmasterDashboard() {
  const { user, userProfile, isWebmaster } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Data
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [referralCodes, setReferralCodes] = useState([]);
  const [earnings, setEarnings] = useState([]);

  // Search & filters
  const [companySearch, setCompanySearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all'); // all, free, standard, enterprise
  const [companySortBy, setCompanySortBy] = useState('created'); // created, name, workers, plan

  // Modals
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [showCompanyDetail, setShowCompanyDetail] = useState(null);

  // Referral code form
  const [codeForm, setCodeForm] = useState({
    code: '', description: '', commissionPercent: 10, commissionFlat: 0, freeWorkerBonus: 0,
  });

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [orgs, allUsers, refs, pays, codes, earns] = await Promise.all([
        getAllOrganizations().catch(() => []),
        getAllUsers().catch(() => []),
        getAllReferrals().catch(() => []),
        getAllPayments().catch(() => []),
        getWebmasterReferralCodes(user.uid).catch(() => []),
        getWebmasterEarnings(user.uid).catch(() => []),
      ]);
      setOrganizations(orgs);
      setUsers(allUsers);
      setReferrals(refs);
      setPayments(pays);
      setReferralCodes(codes);
      setEarnings(earns);
    } catch (err) {
      console.error('Failed to load webmaster data:', err);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Computed stats
  const stats = useMemo(() => {
    const totalCompanies = organizations.length;
    const activeCompanies = organizations.filter(o => o.plan !== 'free' || (o.activeWorkerCount || 0) > 0).length;
    const paidCompanies = organizations.filter(o => o.plan !== 'free').length;
    const totalWorkers = organizations.reduce((sum, o) => sum + (o.activeWorkerCount || 0), 0);
    const totalRevenue = organizations.reduce((sum, o) => sum + (o.monthlyCost || 0), 0);
    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.amount || 0), 0);
    const paidEarnings = earnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalReferrals = referrals.length;
    const activeReferralCodes = referralCodes.filter(c => c.isActive).length;

    // Plan distribution
    const planCounts = { free: 0, standard: 0, enterprise: 0 };
    organizations.forEach(o => { planCounts[o.plan || 'free']++; });

    // Monthly trend (last 6 months)
    const monthlySignups = {};
    organizations.forEach(o => {
      if (o.createdAt) {
        const month = new Date(o.createdAt).toISOString().slice(0, 7);
        monthlySignups[month] = (monthlySignups[month] || 0) + 1;
      }
    });

    return {
      totalCompanies, activeCompanies, paidCompanies, totalWorkers, totalRevenue,
      totalEarnings, pendingEarnings, paidEarnings, totalReferrals, activeReferralCodes,
      planCounts, monthlySignups,
    };
  }, [organizations, earnings, referrals, referralCodes]);

  // Filtered & sorted companies
  const filteredCompanies = useMemo(() => {
    let list = [...organizations];

    // Search
    if (companySearch) {
      const q = companySearch.toLowerCase();
      list = list.filter(o =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.ownerId || '').toLowerCase().includes(q)
      );
    }

    // Filter by plan
    if (companyFilter !== 'all') {
      list = list.filter(o => (o.plan || 'free') === companyFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (companySortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (companySortBy === 'workers') return (b.activeWorkerCount || 0) - (a.activeWorkerCount || 0);
      if (companySortBy === 'plan') {
        const order = { enterprise: 0, standard: 1, free: 2 };
        return (order[a.plan] || 2) - (order[b.plan] || 2);
      }
      // Default: created (most recent first)
      return (b.createdAt || '') > (a.createdAt || '') ? 1 : -1;
    });

    return list;
  }, [organizations, companySearch, companyFilter, companySortBy]);

  // Get owner info for a company
  const getOwner = (ownerId) => users.find(u => u.uid === ownerId || u.id === ownerId);

  // Referral code helpers
  const genCode = () => {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = 'WM-';
    for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  };

  const handleCreateCode = async () => {
    if (!codeForm.code.trim()) { toast.error('Code is required'); return; }
    try {
      await createWebmasterReferralCode({
        ...codeForm,
        code: codeForm.code.toUpperCase().trim(),
        createdBy: user.uid,
      });
      toast.success('Referral code created');
      setShowCreateCode(false);
      setCodeForm({ code: '', description: '', commissionPercent: 10, commissionFlat: 0, freeWorkerBonus: 0 });
      loadData();
    } catch (err) {
      toast.error('Failed to create code');
    }
  };

  const handleUpdateCode = async () => {
    if (!editingCode) return;
    try {
      await updateWebmasterReferralCode(editingCode.id, {
        description: codeForm.description,
        commissionPercent: codeForm.commissionPercent,
        commissionFlat: codeForm.commissionFlat,
        freeWorkerBonus: codeForm.freeWorkerBonus,
        isActive: editingCode.isActive,
      });
      toast.success('Referral code updated');
      setEditingCode(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update code');
    }
  };

  const handleToggleCode = async (code) => {
    try {
      await updateWebmasterReferralCode(code.id, { isActive: !code.isActive });
      toast.success(code.isActive ? 'Code deactivated' : 'Code activated');
      loadData();
    } catch (err) {
      toast.error('Failed to toggle code');
    }
  };

  const handleDeleteCode = async (code) => {
    if (!confirm(`Delete referral code "${code.code}"? This cannot be undone.`)) return;
    try {
      await deleteWebmasterReferralCode(code.id);
      toast.success('Referral code deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete code');
    }
  };

  const [copiedCode, setCopiedCode] = useState(null);
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Access guard
  if (!isWebmaster) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Shield className="w-16 h-16 text-surface-300" />
          <h1 className="text-2xl font-display font-bold text-surface-800">Access Restricted</h1>
          <p className="text-surface-500">This page is only available to webmaster accounts.</p>
        </div>
      </Layout>
    );
  }

  const planBadge = (plan) => {
    const styles = {
      free: 'bg-surface-100 text-surface-600',
      standard: 'bg-brand-100 text-brand-700',
      enterprise: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize', styles[plan] || styles.free)}>
        {plan || 'free'}
      </span>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-surface-900">Webmaster Dashboard</h1>
            <p className="text-surface-500 mt-1">Platform insights, companies, and referral management</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-surface-100 rounded-xl overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-white text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-surface-500">Loading webmaster data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Overview Tab ────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-stagger">
                {/* Top Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Companies', value: stats.totalCompanies, sub: `${stats.paidCompanies} paying`, icon: Building2, bg: 'bg-gradient-to-br from-brand-500 to-brand-700' },
                    { label: 'Total Workers', value: stats.totalWorkers, sub: 'across all orgs', icon: Users, bg: 'bg-gradient-to-br from-purple-500 to-purple-700' },
                    { label: 'Monthly Revenue', value: formatCurrency(stats.totalRevenue), sub: `from ${stats.paidCompanies} subscriptions`, icon: TrendingUp, bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
                    { label: 'Your Earnings', value: formatCurrency(stats.totalEarnings), sub: `${formatCurrency(stats.pendingEarnings)} pending`, icon: DollarSign, bg: 'bg-gradient-to-br from-amber-500 to-amber-700' },
                  ].map((s) => (
                    <div key={s.label} className={cn('rounded-2xl p-4 sm:p-5 flex flex-col gap-1.5 shadow-lg', s.bg)}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs sm:text-sm font-medium text-white/60">{s.label}</p>
                        <s.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white/80" />
                      </div>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-white truncate">{s.value}</p>
                      <p className="text-[10px] sm:text-xs text-white/60">{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Plan Distribution + Referral Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Plan Distribution */}
                  <div className="card">
                    <div className="px-5 py-4 border-b border-surface-100">
                      <h3 className="section-title">Plan Distribution</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      {[
                        { plan: 'free', count: stats.planCounts.free, color: 'bg-surface-400', barColor: 'bg-surface-200' },
                        { plan: 'standard', count: stats.planCounts.standard, color: 'bg-brand-500', barColor: 'bg-brand-100' },
                        { plan: 'enterprise', count: stats.planCounts.enterprise, color: 'bg-purple-500', barColor: 'bg-purple-100' },
                      ].map((p) => {
                        const pct = stats.totalCompanies > 0 ? (p.count / stats.totalCompanies) * 100 : 0;
                        return (
                          <div key={p.plan} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-surface-700 capitalize">{p.plan}</span>
                              <span className="text-sm font-semibold text-surface-800">{p.count} <span className="text-surface-400 font-normal">({Math.round(pct)}%)</span></span>
                            </div>
                            <div className={cn('w-full h-2.5 rounded-full', p.barColor)}>
                              <div className={cn('h-full rounded-full transition-all duration-500', p.color)} style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Referral Overview */}
                  <div className="card">
                    <div className="px-5 py-4 border-b border-surface-100">
                      <h3 className="section-title">Referral Overview</h3>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-brand-50 rounded-xl">
                        <p className="text-2xl font-bold text-brand-700">{stats.totalReferrals}</p>
                        <p className="text-sm text-brand-600">Total Referrals</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-xl">
                        <p className="text-2xl font-bold text-emerald-700">{stats.activeReferralCodes}</p>
                        <p className="text-sm text-emerald-600">Active Codes</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-xl">
                        <p className="text-2xl font-bold text-amber-700">{formatCurrency(stats.pendingEarnings)}</p>
                        <p className="text-sm text-amber-600">Pending Payout</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-xl">
                        <p className="text-2xl font-bold text-purple-700">{formatCurrency(stats.paidEarnings)}</p>
                        <p className="text-sm text-purple-600">Total Paid Out</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Signups */}
                <div className="card">
                  <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                    <h3 className="section-title">Recent Signups</h3>
                    <button onClick={() => setActiveTab('companies')} className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1">
                      View all <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {organizations.slice(0, 8).map((org) => {
                      const owner = getOwner(org.ownerId);
                      return (
                        <div key={org.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {(org.name || 'O')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-surface-800 truncate">{org.name || 'Unnamed'}</p>
                              <p className="text-xs text-surface-400">{owner?.email || owner?.displayName || '—'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-surface-400 hidden sm:inline">{org.activeWorkerCount || 0} workers</span>
                            {planBadge(org.plan)}
                            <span className="text-xs text-surface-400">{formatDate(org.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {organizations.length === 0 && (
                      <p className="p-5 text-sm text-surface-400 text-center">No companies registered yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Companies Tab ───────────────────────── */}
            {activeTab === 'companies' && (
              <div className="space-y-4">
                {/* Search & Filters */}
                <div className="card p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Search companies..."
                        className="input-field !pl-10"
                      />
                    </div>
                    <select
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                      className="select-field !w-auto"
                    >
                      <option value="all">All Plans</option>
                      <option value="free">Free</option>
                      <option value="standard">Standard</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <select
                      value={companySortBy}
                      onChange={(e) => setCompanySortBy(e.target.value)}
                      className="select-field !w-auto"
                    >
                      <option value="created">Newest First</option>
                      <option value="name">Name A-Z</option>
                      <option value="workers">Most Workers</option>
                      <option value="plan">Plan Tier</option>
                    </select>
                  </div>
                </div>

                {/* Count */}
                <p className="text-sm text-surface-500 px-1">
                  Showing {filteredCompanies.length} of {organizations.length} companies
                </p>

                {/* Companies List */}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-100 bg-surface-50/50">
                          <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Company</th>
                          <th className="text-left text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Owner</th>
                          <th className="text-center text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Plan</th>
                          <th className="text-center text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Workers</th>
                          <th className="text-center text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Shops</th>
                          <th className="text-right text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Monthly Cost</th>
                          <th className="text-center text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3">Created</th>
                          <th className="text-center text-xs font-semibold text-surface-500 uppercase tracking-wide px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {filteredCompanies.map((org) => {
                          const owner = getOwner(org.ownerId);
                          return (
                            <tr key={org.id} className="hover:bg-surface-50 transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {(org.name || 'O')[0].toUpperCase()}
                                  </div>
                                  <span className="text-sm font-medium text-surface-800 truncate max-w-[200px]">{org.name || 'Unnamed'}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <div>
                                  <p className="text-sm text-surface-700 truncate max-w-[160px]">{owner?.displayName || '—'}</p>
                                  <p className="text-xs text-surface-400 truncate max-w-[160px]">{owner?.email || '—'}</p>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-center">{planBadge(org.plan)}</td>
                              <td className="px-5 py-3 text-center text-sm font-medium text-surface-700">{org.activeWorkerCount || 0}</td>
                              <td className="px-5 py-3 text-center text-sm text-surface-600">{org.shopCount || 0}</td>
                              <td className="px-5 py-3 text-right text-sm font-semibold text-surface-800">
                                {org.monthlyCost > 0 ? formatCurrency(org.monthlyCost) : <span className="text-surface-400">Free</span>}
                              </td>
                              <td className="px-5 py-3 text-center text-xs text-surface-400">{formatDate(org.createdAt)}</td>
                              <td className="px-5 py-3 text-center">
                                <button
                                  onClick={() => setShowCompanyDetail(org)}
                                  className="btn-icon !w-8 !h-8"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredCompanies.length === 0 && (
                      <p className="p-8 text-sm text-surface-400 text-center">No companies match your search.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Earnings Tab ────────────────────────── */}
            {activeTab === 'earnings' && (
              <div className="space-y-6">
                {/* Earnings Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-surface-500">Total Earnings</p>
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-display font-bold text-surface-900">{formatCurrency(stats.totalEarnings)}</p>
                  </div>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-surface-500">Pending</p>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-display font-bold text-amber-600">{formatCurrency(stats.pendingEarnings)}</p>
                  </div>
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-surface-500">Paid Out</p>
                      <Check className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-display font-bold text-emerald-600">{formatCurrency(stats.paidEarnings)}</p>
                  </div>
                </div>

                {/* Earnings History */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-100">
                    <h3 className="section-title">Earnings History</h3>
                  </div>
                  <div className="divide-y divide-surface-100">
                    {earnings.length === 0 ? (
                      <div className="p-8 text-center">
                        <DollarSign className="w-12 h-12 text-surface-200 mx-auto mb-3" />
                        <p className="text-sm text-surface-500">No earnings yet.</p>
                        <p className="text-xs text-surface-400 mt-1">Earnings are generated when companies sign up using your referral codes.</p>
                      </div>
                    ) : (
                      earnings.map((e) => (
                        <div key={e.id} className="px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center',
                              e.status === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'
                            )}>
                              {e.status === 'paid' ? (
                                <Check className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Clock className="w-5 h-5 text-amber-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-surface-800">{e.orgName || 'Organization'}</p>
                              <p className="text-xs text-surface-400">
                                {e.type === 'commission' ? 'Commission' : 'Bonus'} · Code: {e.referralCode || '—'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-sm font-semibold', e.status === 'paid' ? 'text-emerald-600' : 'text-amber-600')}>
                              +{formatCurrency(e.amount || 0)}
                            </p>
                            <p className="text-xs text-surface-400">{formatDate(e.createdAt)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Referral Codes Tab ──────────────────── */}
            {activeTab === 'referrals' && (
              <div className="space-y-4">
                {/* Actions */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-surface-500">{referralCodes.length} referral code{referralCodes.length !== 1 ? 's' : ''}</p>
                  <button
                    onClick={() => {
                      setCodeForm({ code: genCode(), description: '', commissionPercent: 10, commissionFlat: 0, freeWorkerBonus: 0 });
                      setShowCreateCode(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Create Code
                  </button>
                </div>

                {/* Codes List */}
                {referralCodes.length === 0 ? (
                  <div className="card p-8 text-center">
                    <Tag className="w-12 h-12 text-surface-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-surface-600">No referral codes yet</p>
                    <p className="text-xs text-surface-400 mt-1">Create your first referral code to start earning commissions.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {referralCodes.map((code) => (
                      <div key={code.id} className={cn('card overflow-hidden transition-all', !code.isActive && 'opacity-60')}>
                        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-mono font-bold text-surface-900">{code.code}</span>
                            <button
                              onClick={() => copyToClipboard(code.code)}
                              className="btn-icon !w-7 !h-7"
                              title="Copy code"
                            >
                              {copiedCode === code.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-semibold',
                            code.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500'
                          )}>
                            {code.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="p-5 space-y-3">
                          {code.description && (
                            <p className="text-sm text-surface-600">{code.description}</p>
                          )}
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="p-2 bg-surface-50 rounded-lg">
                              <p className="text-lg font-bold text-brand-600">{code.commissionPercent || 0}%</p>
                              <p className="text-[10px] text-surface-400 uppercase">Commission</p>
                            </div>
                            <div className="p-2 bg-surface-50 rounded-lg">
                              <p className="text-lg font-bold text-emerald-600">{formatCurrency(code.commissionFlat || 0)}</p>
                              <p className="text-[10px] text-surface-400 uppercase">Flat Bonus</p>
                            </div>
                            <div className="p-2 bg-surface-50 rounded-lg">
                              <p className="text-lg font-bold text-purple-600">{code.usageCount || 0}</p>
                              <p className="text-[10px] text-surface-400 uppercase">Uses</p>
                            </div>
                          </div>
                          {code.freeWorkerBonus > 0 && (
                            <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                              <Gift className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="text-xs text-amber-700">+{code.freeWorkerBonus} bonus free workers for referred company</span>
                            </div>
                          )}
                        </div>
                        <div className="px-5 py-3 border-t border-surface-100 flex items-center justify-between">
                          <p className="text-xs text-surface-400">Created {formatDate(code.createdAt)}</p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleCode(code)}
                              className="btn-icon !w-8 !h-8"
                              title={code.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {code.isActive ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-surface-400" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingCode(code);
                                setCodeForm({
                                  code: code.code,
                                  description: code.description || '',
                                  commissionPercent: code.commissionPercent || 0,
                                  commissionFlat: code.commissionFlat || 0,
                                  freeWorkerBonus: code.freeWorkerBonus || 0,
                                });
                              }}
                              className="btn-icon !w-8 !h-8"
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCode(code)}
                              className="btn-icon !w-8 !h-8 hover:!text-red-600 hover:!bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── Create / Edit Referral Code Modal ──── */}
        {(showCreateCode || editingCode) && (
          <Modal open={true} onClose={() => { setShowCreateCode(false); setEditingCode(null); }}>
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-display font-semibold text-surface-900">
                  {editingCode ? 'Edit Referral Code' : 'Create Referral Code'}
                </h2>
                <p className="text-sm text-surface-500 mt-0.5">
                  {editingCode ? 'Update the referral code settings.' : 'Generate a new referral code to share with potential customers.'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Code</label>
                  <div className="flex gap-2">
                    <input
                      value={codeForm.code}
                      onChange={(e) => setCodeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      className={cn('input-field font-mono', editingCode && 'bg-surface-50 text-surface-400')}
                      placeholder="WM-XXXXXX"
                      disabled={!!editingCode}
                    />
                    {!editingCode && (
                      <button
                        onClick={() => setCodeForm(f => ({ ...f, code: genCode() }))}
                        className="btn-secondary !px-3 flex-shrink-0"
                        title="Generate random code"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">Description</label>
                  <input
                    value={codeForm.description}
                    onChange={(e) => setCodeForm(f => ({ ...f, description: e.target.value }))}
                    className="input-field"
                    placeholder="e.g. Summer 2026 campaign"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Commission %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={codeForm.commissionPercent}
                      onChange={(e) => setCodeForm(f => ({ ...f, commissionPercent: Number(e.target.value) }))}
                      className="input-field"
                    />
                    <p className="text-[10px] text-surface-400 mt-1">% of monthly subscription fee</p>
                  </div>
                  <div>
                    <label className="label">Flat Bonus</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={codeForm.commissionFlat}
                      onChange={(e) => setCodeForm(f => ({ ...f, commissionFlat: Number(e.target.value) }))}
                      className="input-field"
                    />
                    <p className="text-[10px] text-surface-400 mt-1">One-time bonus per signup</p>
                  </div>
                </div>

                <div>
                  <label className="label">Free Worker Bonus for Referred Company</label>
                  <input
                    type="number"
                    min="0"
                    value={codeForm.freeWorkerBonus}
                    onChange={(e) => setCodeForm(f => ({ ...f, freeWorkerBonus: Number(e.target.value) }))}
                    className="input-field"
                  />
                  <p className="text-[10px] text-surface-400 mt-1">Extra free workers the referred company gets (added to their free limit)</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateCode(false); setEditingCode(null); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={editingCode ? handleUpdateCode : handleCreateCode}
                  className="btn-primary flex items-center gap-2"
                >
                  {editingCode ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingCode ? 'Save Changes' : 'Create Code'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* ─── Company Detail Modal ──────────────── */}
        {showCompanyDetail && (
          <Modal open={true} onClose={() => setShowCompanyDetail(null)}>
            <div className="p-6 space-y-5">
              {(() => {
                const org = showCompanyDetail;
                const owner = getOwner(org.ownerId);
                const orgReferrals = referrals.filter(r => r.orgId === org.id);
                const orgPayments = payments.filter(p => p.orgId === org.id);
                return (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                        {(org.name || 'O')[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-lg font-display font-semibold text-surface-900">{org.name || 'Unnamed'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          {planBadge(org.plan)}
                          <span className="text-xs text-surface-400">Created {formatDate(org.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-surface-50 rounded-xl text-center">
                        <p className="text-xl font-bold text-surface-800">{org.activeWorkerCount || 0}</p>
                        <p className="text-[10px] text-surface-500 uppercase">Workers</p>
                      </div>
                      <div className="p-3 bg-surface-50 rounded-xl text-center">
                        <p className="text-xl font-bold text-surface-800">{org.shopCount || 0}</p>
                        <p className="text-[10px] text-surface-500 uppercase">Shops</p>
                      </div>
                      <div className="p-3 bg-surface-50 rounded-xl text-center">
                        <p className="text-xl font-bold text-surface-800">{org.monthlyCost > 0 ? formatCurrency(org.monthlyCost) : 'Free'}</p>
                        <p className="text-[10px] text-surface-500 uppercase">Monthly Cost</p>
                      </div>
                      <div className="p-3 bg-surface-50 rounded-xl text-center">
                        <p className="text-xl font-bold text-surface-800">{orgPayments.length}</p>
                        <p className="text-[10px] text-surface-500 uppercase">Payments</p>
                      </div>
                    </div>

                    {/* Owner Info */}
                    <div className="p-4 bg-surface-50 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Owner</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-surface-400">Name</p>
                          <p className="text-sm text-surface-700">{owner?.displayName || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">Email</p>
                          <p className="text-sm text-surface-700 truncate">{owner?.email || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">Phone</p>
                          <p className="text-sm text-surface-700">{owner?.phone || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">Referral Code</p>
                          <p className="text-sm font-mono text-surface-700">{owner?.referralCode || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Subscription */}
                    <div className="p-4 bg-surface-50 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Subscription</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-surface-400">Status</p>
                          <p className={cn('text-sm font-medium', org.subscriptionStatus === 'active' ? 'text-emerald-600' : 'text-surface-600')}>
                            {org.subscriptionStatus || 'None'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">Paid Through</p>
                          <p className="text-sm text-surface-700">{org.paidThrough ? formatDate(org.paidThrough) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">Promo Code</p>
                          <p className="text-sm font-mono text-surface-700">{org.promoCode || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-surface-400">Free Worker Limit</p>
                          <p className="text-sm text-surface-700">{org.freeWorkerLimit || 4}</p>
                        </div>
                      </div>
                    </div>

                    {/* Referrals from this org */}
                    {orgReferrals.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Referrals ({orgReferrals.length})</p>
                        <div className="space-y-2">
                          {orgReferrals.slice(0, 5).map((r) => (
                            <div key={r.id} className="flex items-center justify-between p-2 bg-surface-50 rounded-lg">
                              <span className="text-xs font-mono text-surface-600">{r.referralCode}</span>
                              <span className="text-xs text-surface-400">{formatDate(r.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
