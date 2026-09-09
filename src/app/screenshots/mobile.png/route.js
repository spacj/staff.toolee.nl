import { renderShot } from '../renderShot';

export const dynamic = 'force-static';

export function GET() {
  return renderShot({ width: 1080, height: 1920, wide: false });
}
