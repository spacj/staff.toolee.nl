import { NextResponse } from 'next/server';
import { getAccessToken, toFirestoreValue } from '@/lib/firestore-rest';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;

function genSessionId() {
  return `PUB_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

export async function POST(req) {
  try {
    const body = await req.json();
    const { templateId, name, sessionId: existingSessionId } = body;

    if (!templateId || !name?.trim()) {
      return NextResponse.json({ error: 'templateId and name are required' }, { status: 400 });
    }

    const nameClean = name.trim();
    if (nameClean.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }

    const token = await getAccessToken();
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

    // Get template
    const tmplRes = await fetch(`${firestoreBase}/checklistTemplates/${templateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[public-checklist-assignment] Template fetch status:', tmplRes.status, 'for id:', templateId);
    if (tmplRes.status === 404) {
      return NextResponse.json({ error: 'Checklist not found', debug: templateId }, { status: 404 });
    }
    if (!tmplRes.ok) {
      const text = await tmplRes.text();
      console.error('[public-checklist-assignment] Template fetch error:', tmplRes.status, text);
      return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
    }
    const tmplDoc = await tmplRes.json();
    if (!tmplDoc.fields) {
      return NextResponse.json({ error: 'Checklist not found', debug: templateId }, { status: 404 });
    }
    const template = {};
    for (const [k, v] of Object.entries(tmplDoc.fields)) template[k] = fromFirestore(v);

    console.log('[public-checklist-assignment] Template fields:', JSON.stringify(Object.keys(template)), 'scope:', template.scope);

    if (template.scope !== 'public') {
      console.log('[public-checklist-assignment] Template scope is:', template.scope, 'not "public"');
      return NextResponse.json({ error: 'This checklist is not publicly accessible' }, { status: 403 });
    }
    if (template.active === false) {
      return NextResponse.json({ error: 'This checklist is currently inactive' }, { status: 403 });
    }

    // Get shop name if shopId present
    let shopName = '';
    if (template.shopId) {
      const shopRes = await fetch(`${firestoreBase}/shops/${template.shopId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (shopRes.ok) {
        const shopDoc = await shopRes.json();
        if (shopDoc.fields) {
          const shopData = {};
          for (const [k, v] of Object.entries(shopDoc.fields)) shopData[k] = fromFirestore(v);
          shopName = shopData.name || '';
        }
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const sessionId = existingSessionId || genSessionId();

    // Check for existing assignment for this session+template+date
    const base = `${firestoreBase}:runQuery`;
    const checkRes = await fetch(base, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'publicChecklistAssignments' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'templateId' }, op: 'EQUAL', value: { stringValue: templateId } } },
                { fieldFilter: { field: { fieldPath: 'sessionId' }, op: 'EQUAL', value: { stringValue: sessionId } } },
                { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: today } } },
              ]
            }
          },
          limit: 1,
        }
      })
    });
    console.log('[public-checklist-assignment] Check existing status:', checkRes.status);
    const checkData = await checkRes.json();
    console.log('[public-checklist-assignment] Check existing count:', checkData.length, 'has doc:', !!checkData.find(r => r.document));
    if (checkData.length > 0 && checkData[0].document) {
      const existingId = checkData[0].document.name.split('/').pop();
      return NextResponse.json({
        existing: true,
        id: existingId,
        message: 'You already started this checklist today',
      });
    }

    // Create the public assignment
    const items = (template.items || []).map(i => ({
      id: i.id || String(Math.random()),
      text: i.text || '',
      required: !!i.required,
      checked: false,
      checkedAt: null,
      note: '',
    }));

    const fields = {};
    for (const [k, v] of Object.entries({
      templateId,
      templateTitle: template.title || 'Checklist',
      orgId: template.orgId || '',
      shopId: template.shopId || '',
      shopName,
      publicName: nameClean,
      sessionId,
      date: today,
      dueDate: today,
      frequency: template.frequency || 'qr',
      items,
      status: 'pending',
      triggeredBy: 'qr_public',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) {
      fields[k] = toFirestoreValue(v);
    }

    const docRes = await fetch(`${firestoreBase}/publicChecklistAssignments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    const docBody = await docRes.text();
    console.log('[public-checklist-assignment] Create doc status:', docRes.status, 'body:', docBody.slice(0, 200));
    if (!docRes.ok) {
      console.error('[public-checklist-assignment] Create error:', docRes.status, docBody);
      return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }
    const doc = JSON.parse(docBody);
    const id = doc.name?.split('/').pop() || '';

    return NextResponse.json({
      success: true,
      id,
      sessionId,
      title: template.title,
      items: items.length,
    });
  } catch (err) {
    console.error('[public-checklist-assignment] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
