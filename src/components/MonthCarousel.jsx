'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/utils/helpers';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function getMonthRange(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function addMonths(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export default function MonthCarousel({ onChange, maxFutureMonths = 3, className }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [touchStart, setTouchStart] = useState(null);
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef(null);

  const isCurrentMonth = year === currentYear && month === currentMonth;
  const isPast = year < currentYear || (year === currentYear && month < currentMonth);
  const isFuture = year > currentYear || (year === currentYear && month > currentMonth);

  // Limit: don't go further than maxFutureMonths ahead
  const maxDate = addMonths(currentYear, currentMonth, maxFutureMonths);
  const canGoForward = year < maxDate.year || (year === maxDate.year && month < maxDate.month);
  // Limit: don't go further than 24 months back
  const minDate = addMonths(currentYear, currentMonth, -24);
  const canGoBack = year > minDate.year || (year === minDate.year && month > minDate.month);

  const navigate = useCallback((delta) => {
    const next = addMonths(year, month, delta);
    if (delta > 0 && !canGoForward) return;
    if (delta < 0 && !canGoBack) return;
    setYear(next.year);
    setMonth(next.month);
  }, [year, month, canGoForward, canGoBack]);

  // Notify parent of changes
  useEffect(() => {
    const range = getMonthRange(year, month);
    const type = isPast ? 'report' : isCurrentMonth ? 'current' : 'prevision';
    onChange?.({
      year,
      month,
      monthName: MONTH_NAMES[month],
      monthNameShort: MONTH_NAMES_SHORT[month],
      startDate: range.start,
      endDate: range.end,
      type,
      isCurrentMonth,
      isPast,
      isFuture,
    });
  }, [year, month]);

  // Touch swipe handling
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
    setSwiping(true);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e) => {
    if (touchStart === null) return;
    const diff = e.touches[0].clientX - touchStart;
    setSwipeOffset(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeOffset) > 50) {
      if (swipeOffset > 0) navigate(-1); // swipe right = go back
      else navigate(1); // swipe left = go forward
    }
    setTouchStart(null);
    setSwiping(false);
    setSwipeOffset(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  };

  const goToToday = () => {
    setYear(currentYear);
    setMonth(currentMonth);
  };

  return (
    <div
      ref={containerRef}
      className={cn('select-none', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="navigation"
      aria-label="Month navigation"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Back arrow */}
        <button
          onClick={() => navigate(-1)}
          disabled={!canGoBack}
          className={cn(
            'flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all',
            canGoBack
              ? 'bg-surface-100 hover:bg-surface-200 text-surface-700 active:scale-95'
              : 'bg-surface-50 text-surface-300 cursor-not-allowed'
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Center: Month display */}
        <div
          className="flex-1 text-center cursor-pointer"
          onClick={!isCurrentMonth ? goToToday : undefined}
          style={{
            transform: swiping ? `translateX(${swipeOffset * 0.3}px)` : 'none',
            transition: swiping ? 'none' : 'transform 0.2s ease',
          }}
        >
          {/* Type badge */}
          <div className="flex items-center justify-center gap-1.5 mb-1">
            {isPast && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-blue-100 text-blue-700">
                Report
              </span>
            )}
            {isCurrentMonth && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700">
                Current
              </span>
            )}
            {isFuture && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-amber-100 text-amber-700">
                Prevision
              </span>
            )}
          </div>

          {/* Month name */}
          <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-900">
            {MONTH_NAMES[month]}
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">
            {year}
            {!isCurrentMonth && (
              <span className="ml-2 text-brand-500 hover:text-brand-600 cursor-pointer text-[11px]">
                ← Back to today
              </span>
            )}
          </p>
        </div>

        {/* Forward arrow */}
        <button
          onClick={() => navigate(1)}
          disabled={!canGoForward}
          className={cn(
            'flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all',
            canGoForward
              ? 'bg-surface-100 hover:bg-surface-200 text-surface-700 active:scale-95'
              : 'bg-surface-50 text-surface-300 cursor-not-allowed'
          )}
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Month dots indicator */}
      <div className="flex items-center justify-center gap-1 mt-3">
        {[-2, -1, 0, 1, 2].map((offset) => {
          const target = addMonths(year, month, offset);
          const isActive = offset === 0;
          const isCurrent = target.year === currentYear && target.month === currentMonth;
          return (
            <button
              key={offset}
              onClick={() => {
                setYear(target.year);
                setMonth(target.month);
              }}
              className={cn(
                'rounded-full transition-all',
                isActive
                  ? 'w-6 h-2 bg-brand-500'
                  : isCurrent
                    ? 'w-2 h-2 bg-emerald-400 hover:bg-emerald-500'
                    : 'w-2 h-2 bg-surface-200 hover:bg-surface-300'
              )}
              aria-label={`${MONTH_NAMES_SHORT[target.month]} ${target.year}`}
              title={`${MONTH_NAMES_SHORT[target.month]} ${target.year}`}
            />
          );
        })}
      </div>
    </div>
  );
}
