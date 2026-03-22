import { NextResponse } from 'next/server';
import { restGet } from '@/lib/firestore-rest';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const templateId = searchParams.get('templateId') || id;

    if (!templateId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const template = await restGet(`/checklistTemplates/${templateId}`);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.scope !== 'public') {
      return NextResponse.json({ error: 'Not a public checklist' }, { status: 403 });
    }

    if (template.active === false) {
      return NextResponse.json({ error: 'This checklist is currently paused' }, { status: 403 });
    }

    let shopName = template.shopName || '';
    if (template.shopId && !shopName) {
      const shop = await restGet(`/shops/${template.shopId}`);
      if (shop) shopName = shop.name || '';
    }

    return NextResponse.json({
      data: {
        id: templateId,
        title: template.title,
        description: template.description,
        scope: template.scope,
        active: template.active,
        shopName,
        shopId: template.shopId,
        items: (template.items || []).map(i => ({
          id: i.id,
          text: i.text,
          required: !!i.required,
        })),
      }
    });
  } catch (err) {
    console.error('GET public template error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
