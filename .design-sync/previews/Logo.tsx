import { Logo } from 'staff-manager';

export const Default = () => <Logo />;

export const OnDark = () => (
  <div style={{ background: '#0e1016', padding: 28, borderRadius: 16, display: 'inline-block' }}>
    <Logo theme="dark" />
  </div>
);

export const Large = () => <Logo size="lg" />;

export const MarkOnly = () => <Logo markOnly size="lg" />;

export const NoSubtitle = () => <Logo subtitle={null} size="md" />;
