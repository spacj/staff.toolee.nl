import { renderShot } from '../renderShot';

export const dynamic = 'force-static';

export function GET() {
  return renderShot({ width: 1920, height: 1080, wide: true });
}
