'use client';
import { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import Modal from '@/components/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/helpers';
import {
  getKBCategories, createKBCategory, updateKBCategory, deleteKBCategory,
  getKBArticles, createKBArticle, updateKBArticle, deleteKBArticle,
} from '@/lib/firestore';
import {
  BookOpen, Plus, Search, Pin, PinOff, Edit3, Trash2, ChevronRight,
  FolderOpen, FileText, Tag, ArrowLeft, GripVertical, MoreVertical,
  Bookmark, Lightbulb, Shield, AlertCircle, HelpCircle, Megaphone,
  Wrench, Heart, Star, Zap, Coffee, Map, BookMarked, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// ─── Icon palette for categories ─────────────────────
const CATEGORY_ICONS = [
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Shield', icon: Shield },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'HelpCircle', icon: HelpCircle },
  { name: 'Megaphone', icon: Megaphone },
  { name: 'Wrench', icon: Wrench },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'Coffee', icon: Coffee },
  { name: 'Map', icon: Map },
  { name: 'BookMarked', icon: BookMarked },
  { name: 'FileText', icon: FileText },
  { name: 'FolderOpen', icon: FolderOpen },
];

const CATEGORY_COLORS = [
  { name: 'Blue', value: 'bg-brand-100 text-brand-700 border-brand-200' },
  { name: 'Purple', value: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: 'Green', value: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: 'Amber', value: 'bg-amber-100 text-amber-700 border-amber-200' },
  { name: 'Rose', value: 'bg-rose-100 text-rose-700 border-rose-200' },
  { name: 'Indigo', value: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { name: 'Teal', value: 'bg-teal-100 text-teal-700 border-teal-200' },
  { name: 'Orange', value: 'bg-orange-100 text-orange-700 border-orange-200' },
];

function getIconComponent(iconName) {
  const found = CATEGORY_ICONS.find(i => i.name === iconName);
  return found ? found.icon : BookOpen;
}

// ─── Main Page ───────────────────────────────────────
export default function KnowledgePage() {
  const { orgId, isManager, isAdmin, user, userProfile } = useAuth();
  const canEdit = isManager || isAdmin;

  // Data
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeCategory, setActiveCategory] = useState(null); // null = "All"
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // { type, id, name }

  // Dropdown
  const [openDropdown, setOpenDropdown] = useState(null);

  // Scroll ref for category bar
  const barRef = useRef(null);

  // ─── Load data ──────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    loadData();
  }, [orgId]);

  async function loadData() {
    setLoading(true);
    try {
      const [cats, arts] = await Promise.all([
        getKBCategories(orgId),
        getKBArticles({ orgId }),
      ]);
      setCategories(cats);
      setArticles(arts);
    } catch (err) {
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }

  // ─── Filtered articles ──────────────────────────────
  const filteredArticles = articles.filter(a => {
    const matchesCategory = !activeCategory || a.categoryId === activeCategory;
    const matchesSearch = !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.tags || []).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const activeCategoryData = categories.find(c => c.id === activeCategory);

  // ─── Category CRUD ──────────────────────────────────
  async function handleSaveCategory(data) {
    try {
      if (editingCategory) {
        await updateKBCategory(editingCategory.id, data);
        toast.success('Category updated');
      } else {
        await createKBCategory({ ...data, orgId, createdBy: user.uid, order: categories.length });
        toast.success('Category created');
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save category');
    }
  }

  async function handleDeleteCategory(id) {
    try {
      // Delete all articles in this category
      const catArticles = articles.filter(a => a.categoryId === id);
      for (const art of catArticles) {
        await deleteKBArticle(art.id);
      }
      await deleteKBCategory(id);
      if (activeCategory === id) setActiveCategory(null);
      toast.success('Category and its articles deleted');
      setShowDeleteConfirm(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete category');
    }
  }

  // ─── Article CRUD ──────────────────────────────────
  async function handleSaveArticle(data) {
    try {
      if (editingArticle) {
        await updateKBArticle(editingArticle.id, data);
        toast.success('Article updated');
      } else {
        const existingCount = articles.filter(a => a.categoryId === data.categoryId).length;
        await createKBArticle({
          ...data,
          orgId,
          createdBy: user.uid,
          createdByName: userProfile?.displayName || 'Unknown',
          pinned: false,
          order: existingCount,
        });
        toast.success('Article created');
      }
      setShowArticleModal(false);
      setEditingArticle(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save article');
    }
  }

  async function handleTogglePin(article) {
    try {
      await updateKBArticle(article.id, { pinned: !article.pinned });
      toast.success(article.pinned ? 'Unpinned' : 'Pinned');
      loadData();
    } catch (err) {
      toast.error('Failed to update article');
    }
  }

  async function handleDeleteArticle(id) {
    try {
      await deleteKBArticle(id);
      if (selectedArticle?.id === id) setSelectedArticle(null);
      toast.success('Article deleted');
      setShowDeleteConfirm(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete article');
    }
  }

  // ─── Render ──────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          {selectedArticle && (
            <button onClick={() => setSelectedArticle(null)}
              className="btn-icon -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="page-title">Knowledge Base</h1>
            <p className="text-sm text-surface-500 mt-0.5">
              {selectedArticle ? selectedArticle.title : 'Guides, tutorials & company resources'}
            </p>
          </div>
        </div>
        {canEdit && !selectedArticle && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
              className="btn-secondary text-xs sm:text-sm">
              <FolderOpen className="w-4 h-4" /> Category
            </button>
            <button onClick={() => {
              if (categories.length === 0) { toast.error('Create a category first'); return; }
              setEditingArticle(null);
              setShowArticleModal(true);
            }}
              className="btn-primary text-xs sm:text-sm">
              <Plus className="w-4 h-4" /> New Guide
            </button>
          </div>
        )}
      </div>

      {/* Search bar */}
      {!selectedArticle && (
        <div className="mb-4">
          <div className={cn(
            'relative transition-all duration-200',
            searchFocused ? 'ring-2 ring-brand-500/20 rounded-xl' : ''
          )}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search guides, tutorials, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="input-field pl-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Category Bar Menu ───────────────────────── */}
      {!selectedArticle && (
        <div className="mb-5">
          <div ref={barRef}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
            {/* All tab */}
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 border',
                !activeCategory
                  ? 'bg-surface-900 text-white border-surface-900 shadow-md'
                  : 'bg-white text-surface-600 border-surface-200 hover:bg-surface-50 hover:border-surface-300'
              )}>
              <BookOpen className="w-4 h-4" />
              All
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                !activeCategory ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
              )}>
                {articles.length}
              </span>
            </button>

            {/* Category tabs */}
            {categories.map((cat) => {
              const Icon = getIconComponent(cat.icon);
              const isActive = activeCategory === cat.id;
              const count = articles.filter(a => a.categoryId === cat.id).length;
              return (
                <div key={cat.id} className="relative flex-shrink-0">
                  <button
                    onClick={() => setActiveCategory(isActive ? null : cat.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border',
                      isActive
                        ? 'bg-surface-900 text-white border-surface-900 shadow-md'
                        : cn('bg-white border-surface-200 hover:border-surface-300', cat.color || 'text-surface-600')
                    )}>
                    <Icon className="w-4 h-4" />
                    {cat.name}
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
                    )}>
                      {count}
                    </span>
                  </button>

                  {/* Category actions (manager/admin) */}
                  {canEdit && (
                    <div className="absolute -top-1 -right-1 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === cat.id ? null : cat.id); }}
                        className="w-5 h-5 rounded-full bg-white border border-surface-200 shadow-sm flex items-center justify-center text-surface-400 hover:text-surface-600 hover:border-surface-300 transition-all">
                        <MoreVertical className="w-3 h-3" />
                      </button>
                      {openDropdown === cat.id && (
                        <>
                          <div className="fixed inset-0 z-[55]" onClick={() => setOpenDropdown(null)} />
                          <div className="absolute right-0 top-6 w-36 bg-white rounded-xl shadow-lg border border-surface-200 z-[60] py-1"
                            style={{ animation: 'slideUp 0.15s ease-out' }}>
                            <button
                              onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); setOpenDropdown(null); }}
                              className="dropdown-item">
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => { setShowDeleteConfirm({ type: 'category', id: cat.id, name: cat.name }); setOpenDropdown(null); }}
                              className="dropdown-item-danger">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Article Detail View ────────────────────── */}
      {selectedArticle ? (
        <ArticleDetail
          article={selectedArticle}
          category={categories.find(c => c.id === selectedArticle.categoryId)}
          canEdit={canEdit}
          onEdit={() => { setEditingArticle(selectedArticle); setShowArticleModal(true); }}
          onDelete={() => setShowDeleteConfirm({ type: 'article', id: selectedArticle.id, name: selectedArticle.title })}
          onTogglePin={() => handleTogglePin(selectedArticle)}
          onBack={() => setSelectedArticle(null)}
        />
      ) : (
        /* ─── Article Grid ────────────────────────────── */
        <>
          {filteredArticles.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-100 flex items-center justify-center">
                <FileText className="w-8 h-8 text-surface-400" />
              </div>
              <h3 className="text-lg font-display font-semibold text-surface-700 mb-1">
                {searchQuery ? 'No results found' : categories.length === 0 ? 'No categories yet' : 'No guides yet'}
              </h3>
              <p className="text-sm text-surface-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try a different search term or browse categories.'
                  : canEdit
                    ? categories.length === 0
                      ? 'Create your first category to start organizing guides and tutorials.'
                      : 'Create your first guide to share knowledge with your team.'
                    : 'No guides have been published yet. Check back later.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
              {filteredArticles.map((article) => {
                const cat = categories.find(c => c.id === article.categoryId);
                const Icon = cat ? getIconComponent(cat.icon) : FileText;
                return (
                  <motion.div
                    key={article.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="card-hover group cursor-pointer"
                    onClick={() => setSelectedArticle(article)}>
                    <div className="p-4 sm:p-5">
                      {/* Top row: category badge + pin */}
                      <div className="flex items-start justify-between mb-3">
                        <div className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border',
                          cat?.color || 'bg-surface-100 text-surface-600 border-surface-200'
                        )}>
                          <Icon className="w-3.5 h-3.5" />
                          {cat?.name || 'Uncategorized'}
                        </div>
                        {article.pinned && (
                          <Pin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-display font-semibold text-surface-800 mb-2 group-hover:text-brand-600 transition-colors line-clamp-2">
                        {article.title}
                      </h3>

                      {/* Preview */}
                      <p className="text-sm text-surface-500 line-clamp-2 mb-3">
                        {article.content.replace(/[#*_~`>-]/g, '').substring(0, 140)}
                      </p>

                      {/* Tags */}
                      {article.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {article.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-surface-100 text-surface-500 font-medium">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                          {article.tags.length > 3 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-100 text-surface-400">
                              +{article.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-surface-100">
                        <span className="text-[11px] text-surface-400">
                          by {article.createdByName || 'Unknown'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Category Modal ───────────────────────────── */}
      <CategoryModal
        open={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        onSave={handleSaveCategory}
        editing={editingCategory}
      />

      {/* ─── Article Modal ────────────────────────────── */}
      <ArticleModal
        open={showArticleModal}
        onClose={() => { setShowArticleModal(false); setEditingArticle(null); }}
        onSave={handleSaveArticle}
        editing={editingArticle}
        categories={categories}
        defaultCategoryId={activeCategory}
      />

      {/* ─── Delete Confirmation ──────────────────────── */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Confirm Delete" size="sm">
        {showDeleteConfirm && (
          <div>
            <p className="text-sm text-surface-600 mb-1">
              Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>?
            </p>
            {showDeleteConfirm.type === 'category' && (
              <p className="text-xs text-danger-600 mb-4">
                This will also delete all articles in this category.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => {
                if (showDeleteConfirm.type === 'category') handleDeleteCategory(showDeleteConfirm.id);
                else handleDeleteArticle(showDeleteConfirm.id);
              }} className="btn-danger">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}

// ─── Article Detail Component ──────────────────────────
function ArticleDetail({ article, category, canEdit, onEdit, onDelete, onTogglePin, onBack }) {
  const Icon = category ? getIconComponent(category.icon) : FileText;

  // Simple markdown-like rendering
  function renderContent(text) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="text-base font-display font-semibold text-surface-800 mt-5 mb-2">{line.slice(4)}</h3>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-display font-bold text-surface-900 mt-6 mb-2">{line.slice(3)}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-display font-bold text-surface-900 mt-6 mb-3">{line.slice(2)}</h1>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="text-sm text-surface-700 ml-4 mb-1 list-disc">{renderInline(line.slice(2))}</li>;
      if (line.match(/^\d+\.\s/)) return <li key={i} className="text-sm text-surface-700 ml-4 mb-1 list-decimal">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>;
      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-3 border-brand-300 pl-4 py-1 my-2 text-sm text-surface-600 italic bg-brand-50/50 rounded-r-lg">{renderInline(line.slice(2))}</blockquote>;
      if (line.startsWith('---')) return <hr key={i} className="my-4 border-surface-200" />;
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-surface-700 leading-relaxed mb-2">{renderInline(line)}</p>;
    });
  }

  function renderInline(text) {
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    text = text.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-surface-100 rounded text-xs font-mono text-brand-700">$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden">
      {/* Article header */}
      <div className="p-5 sm:p-6 border-b border-surface-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {category && (
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border',
                  category.color || 'bg-surface-100 text-surface-600 border-surface-200'
                )}>
                  <Icon className="w-3.5 h-3.5" />
                  {category.name}
                </span>
              )}
              {article.pinned && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Pin className="w-3.5 h-3.5" /> Pinned
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-900 mb-1">
              {article.title}
            </h2>
            <p className="text-xs text-surface-400">
              By {article.createdByName || 'Unknown'} &middot; {article.createdAt ? new Date(article.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              {article.updatedAt && article.updatedAt !== article.createdAt && (
                <> &middot; Updated {new Date(article.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
              )}
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={onTogglePin} className="btn-icon" title={article.pinned ? 'Unpin' : 'Pin'}>
                {article.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              <button onClick={onEdit} className="btn-icon" title="Edit">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={onDelete} className="btn-icon text-danger-500" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Article content */}
      <div className="p-5 sm:p-6">
        <div className="prose-custom max-w-none">
          {renderContent(article.content)}
        </div>
      </div>

      {/* Tags footer */}
      {article.tags?.length > 0 && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-100">
            {article.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-surface-100 text-surface-600 font-medium">
                <Tag className="w-3 h-3" />{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Category Modal ────────────────────────────────────
function CategoryModal({ open, onClose, onSave, editing }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('BookOpen');
  const [color, setColor] = useState(CATEGORY_COLORS[0].value);

  useEffect(() => {
    if (editing) {
      setName(editing.name || '');
      setIcon(editing.icon || 'BookOpen');
      setColor(editing.color || CATEGORY_COLORS[0].value);
    } else {
      setName('');
      setIcon('BookOpen');
      setColor(CATEGORY_COLORS[0].value);
    }
  }, [editing, open]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Category name is required'); return; }
    onSave({ name: name.trim(), icon, color });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Category' : 'New Category'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="input-field" placeholder="e.g. Getting Started, Policies..." autoFocus />
        </div>

        <div>
          <label className="label">Icon</label>
          <div className="grid grid-cols-8 gap-1.5">
            {CATEGORY_ICONS.map(({ name: iName, icon: IcoComp }) => (
              <button key={iName} type="button"
                onClick={() => setIcon(iName)}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                  icon === iName
                    ? 'bg-brand-100 text-brand-600 ring-2 ring-brand-500'
                    : 'bg-surface-50 text-surface-500 hover:bg-surface-100'
                )}>
                <IcoComp className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Color</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button key={c.name} type="button"
                onClick={() => setColor(c.value)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                  c.value,
                  color === c.value ? 'ring-2 ring-brand-500 ring-offset-1' : ''
                )}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Article Modal ─────────────────────────────────────
function ArticleModal({ open, onClose, onSave, editing, categories, defaultCategoryId }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (editing) {
      setTitle(editing.title || '');
      setContent(editing.content || '');
      setCategoryId(editing.categoryId || '');
      setTagsInput((editing.tags || []).join(', '));
    } else {
      setTitle('');
      setContent('');
      setCategoryId(defaultCategoryId || categories[0]?.id || '');
      setTagsInput('');
    }
  }, [editing, open, defaultCategoryId, categories]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!content.trim()) { toast.error('Content is required'); return; }
    if (!categoryId) { toast.error('Select a category'); return; }
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ title: title.trim(), content: content.trim(), categoryId, tags });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Guide' : 'New Guide'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="input-field" placeholder="e.g. How to request time off" autoFocus />
          </div>

          <div>
            <label className="label">Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="select-field">
              <option value="">Select category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Tags (comma separated)</label>
            <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)}
              className="input-field" placeholder="e.g. onboarding, hr, policy" />
          </div>
        </div>

        <div>
          <label className="label">Content</label>
          <p className="text-[11px] text-surface-400 mb-1.5">
            Supports basic formatting: # headings, **bold**, *italic*, `code`, - bullet lists, {'>'} quotes, --- dividers
          </p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="input-field min-h-[280px] font-mono text-[13px] leading-relaxed resize-y"
            placeholder={"# Getting Started\n\nWelcome to our team! Here's what you need to know.\n\n## Step 1: Set up your account\n\n- Go to Settings\n- Update your profile\n- Set your availability\n\n> Tip: You can change your preferences anytime.\n\n## Step 2: Check your schedule\n\nOpen the **Calendar** page to view your upcoming shifts."}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create Guide'}</button>
        </div>
      </form>
    </Modal>
  );
}
