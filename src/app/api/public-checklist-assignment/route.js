import { NextResponse } from 'next/server';
import { getAccessToken, restAdd, restGet } from '@/lib/firestore-rest';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;

function genSessionId() {
  return `PUB_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

    // Get template
    const template = await restGet(`/checklistTemplates/${templateId}`);
    if (!template) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }
    if (template.scope !== 'public') {
      return NextResponse.json({ error: 'This checklist is not publicly accessible' }, { status: 403 });
    }
    if (template.active === false) {
      return NextResponse.json({ error: 'This checklist is currently inactive' }, { status: 403 });
    }

    // Get shop name if shopId present
    let shopName = '';
    if (template.shopId) {
      const shop = await restGet(`/shops/${template.shopId}`);
      if (shop) shopName = shop.name || '';
    }

    const today = new Date().toISOString().split('T')[0];
    const sessionId = existingSessionId || genSessionId();

    // Check for existing assignment for this session+template+date
    const accessToken = await getAccessToken();
    const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
    const checkRes = await fetch(base, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'publicChecklistAssignments' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'templateId' }, op: 'EQUAL', value: { stringValue: templateId } },
                fieldFilter: { field: { fieldPath: 'sessionId' }, op: 'EQUAL', value: { stringValue: sessionId } },
                fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: today } },
              ]
            }
          },
          limit: 1,
        }
      })
    });
    const checkData = await checkRes.json();
    if (checkData.length > 0 && checkData[0].document) {
      const existingId = checkData[0].document.name.split('/').pop();
      return NextResponse.json({
        existing: true,
        id: existingId,
        message: 'You already started this checklist today',
      });
    }

    // Create the public assignment
    const doc = await restAdd('/publicChecklistAssignments', {
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
      items: (template.items || []).map(i => ({
        id: i.id || String(Math.random()),
        text: i.text || '',
        required: !!i.required,
        checked: false,
        checkedAt: null,
        note: '',
      })),
      status: 'pending',
      triggeredBy: 'qr_public',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const id = doc.name?.split('/').pop() || '';

    return NextResponse.json({
      success: true,
      id,
      sessionId,
      title: template.title,
      items: doc.fields?.items?.arrayValue?.values?.length || template.items?.length || 0,
    });
  } catch (err) {
    console.error('Public checklist assignment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
