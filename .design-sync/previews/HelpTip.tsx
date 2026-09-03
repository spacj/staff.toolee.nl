import { HelpTip } from 'staff-manager';

// HelpTip renders an inline "?" trigger; the popover opens on click
// (interaction-only, not shown statically). These cards show the trigger
// in its two real placements — beside a field label and beside a heading.
export const BesideLabel = () => (
  <div className="flex items-center gap-1.5">
    <span className="label !mb-0">Annual leave allowance</span>
    <HelpTip text="Paid days off each worker gets per year." />
  </div>
);

export const BesideTitle = () => (
  <h3 className="section-title flex items-center gap-2">
    Cost breakdown
    <HelpTip text="Live labour cost from logged hours and each worker's pay rate." />
  </h3>
);
