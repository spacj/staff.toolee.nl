import { Modal } from 'staff-manager';

// Overlay component — rendered open inside a single fixed-size card
// (see cfg.overrides.Modal). The dialog uses the DS `.input-field`,
// `.label`, `.btn-*` classes so it reads as a real Staff2 dialog.
export const Open = () => (
  <Modal open onClose={() => {}} title="Invite a teammate">
    <label className="label" htmlFor="invite-email">Work email</label>
    <input id="invite-email" className="input-field" placeholder="alex@company.com" />
    <p className="text-xs text-surface-500 mt-2">They&apos;ll get an email to join your team.</p>
    <div className="flex justify-end gap-2 mt-5">
      <button className="btn-secondary">Cancel</button>
      <button className="btn-primary">Send invite</button>
    </div>
  </Modal>
);
