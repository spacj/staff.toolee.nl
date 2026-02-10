import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Sidebar
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Workers
  workers: [],
  workersLoading: true,
  setWorkers: (workers) => set({ workers, workersLoading: false }),

  // Projects
  projects: [],
  projectsLoading: true,
  setProjects: (projects) => set({ projects, projectsLoading: false }),
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  // Shifts
  shifts: [],
  shiftsLoading: true,
  setShifts: (shifts) => set({ shifts, shiftsLoading: false }),

  // Calendar
  calendarDate: new Date(),
  calendarView: 'month',
  setCalendarDate: (date) => set({ calendarDate: date }),
  setCalendarView: (view) => set({ calendarView: view }),

  // Modals
  activeModal: null,
  modalData: null,
  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Notifications
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),

  // Search
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Filters
  filters: { role: '', status: '', project: '' },
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: { role: '', status: '', project: '' } }),
}));

export default useStore;
