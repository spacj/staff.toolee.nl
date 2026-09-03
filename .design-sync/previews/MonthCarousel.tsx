import { MonthCarousel } from 'staff-manager';

// Renders fully static: current month with the "Current" badge, prev/next
// arrows, and the 5-dot month indicator. Swipe/keyboard nav is interactive.
export const Default = () => (
  <div className="card p-5" style={{ maxWidth: 360 }}>
    <MonthCarousel onChange={() => {}} />
  </div>
);
