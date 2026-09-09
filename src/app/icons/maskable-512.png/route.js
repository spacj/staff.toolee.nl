import { renderIcon } from '../renderIcon';

export const dynamic = 'force-static';

export function GET() {
  return renderIcon({ size: 512, maskable: true });
}
