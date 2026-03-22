import { NextResponse } from 'next/server';
import { getAccessToken, restGet } from '@/lib/firestore-rest';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const templateId = searchParams.get('templateId') || id;

    if (!templateId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const token = await getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/checklistTemplates/${templateId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 404) {
      console.error('[public-template] Template not found in Firestore:', templateId);
      return NextResponse.json({ error: 'Template not found', templateId }, { status: 404 });
    }

    if (!res.ok) {
      const text = await res.text();
      console.error('[public-template] Firestore error:', res.status, text);
      return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
    }

    const doc = await res.json();
    if (!doc.fields) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const template = {};
    function fromFirestore(val) {
      if (!val) return null;
      if (val.stringValue !== undefined) return val.stringValue;
      if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
      if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
      if (val.booleanValue !== undefined) return val.booleanValue;
      if (val.nullValue !== undefined) return null;
      if (val.arrayValue?.values) return val.arrayValue.values.map(fromFirestore);
      if (val.mapValue?.fields) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields)) obj[k] = fromFirestore(v);
        return obj;
      }
      return null;
    }
    for (const [k, v] of Object.entries(doc.fields)) template[k] = fromFirestore(v);

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
    console.error('[public-template] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
