import { NextResponse } from 'next/server';
import { getAccessToken, restGet } from '@/lib/firestore-rest';

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;

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

function parseDoc(doc) {
  if (!doc?.fields) return null;
  const obj = { id: doc.name?.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields)) obj[k] = fromFirestore(v);
  return obj;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const id = searchParams.get('id');

    if (!sessionId && !id) {
      return NextResponse.json({ error: 'sessionId or id required' }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

    if (id) {
      const doc = await restGet(`/publicChecklistAssignments/${id}`);
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ data: doc });
    }

    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'publicChecklistAssignments' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'sessionId' },
              op: 'EQUAL',
              value: { stringValue: sessionId }
            }
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 1,
        }
      })
    });

    const results = await res.json();
    const doc = results.find(r => r.document);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ data: parseDoc(doc.document) });
  } catch (err) {
    console.error('GET public checklist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, items, status, completedAt, updatedAt, note } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const updates = {};
    if (items !== undefined) {
      updates.items = { arrayValue: { values: items.map(i => ({
        mapValue: { fields: {
          id: { stringValue: String(i.id || '') },
          text: { stringValue: String(i.text || '') },
          required: { booleanValue: !!i.required },
          checked: { booleanValue: !!i.checked },
          checkedAt: { stringValue: i.checkedAt || '' },
          note: { stringValue: i.note || '' },
          checkedBy: { stringValue: i.checkedBy || '' },
        }}
      }))}};
    }
    if (status !== undefined) updates.status = { stringValue: status };
    if (completedAt !== undefined) updates.completedAt = { stringValue: completedAt || '' };
    if (updatedAt !== undefined) updates.updatedAt = { stringValue: updatedAt };
    if (note !== undefined) updates.note = { stringValue: note };

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publicChecklistAssignments/${id}?updateMask.fieldPaths=${Object.keys(updates).join('&updateMask.fieldPaths=')}`,
      {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: updates }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Update failed: ${text}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH public checklist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
