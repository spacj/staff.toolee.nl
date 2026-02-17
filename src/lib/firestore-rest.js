/**
 * Firestore REST API helper for server-side routes (no firebase-admin needed).
 * Uses the service account credentials from env vars to get an access token,
 * then calls the Firestore REST API directly.
 */

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Create a JWT and exchange it for a Google access token
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Sign with the private key
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(PRIVATE_KEY, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Google auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// Convert JS value to Firestore Value format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  return { stringValue: String(val) };
}

/**
 * Query a collection by field value.
 * Returns array of { id, fields } objects.
 */
export async function queryCollection(collection, field, op, value) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: {
            fieldFilter: { field: { fieldPath: field }, op, value: toFirestoreValue(value) },
          },
        },
      }),
    }
  );
  const results = await res.json();
  if (!Array.isArray(results)) return [];
  return results
    .filter(r => r.document)
    .map(r => {
      const name = r.document.name;
      const id = name.split('/').pop();
      return { id, name, fields: r.document.fields || {} };
    });
}

/**
 * Update fields on a document.
 */
export async function updateDocument(collection, docId, data) {
  const token = await getAccessToken();
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  const fieldPaths = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(
    `${FIRESTORE_BASE}/${collection}/${docId}?${fieldPaths}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore update failed (${res.status}): ${text}`);
  }
  return true;
}

/**
 * Create a document in a collection (auto-ID).
 */
export async function createDocument(collection, data) {
  const token = await getAccessToken();
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  const res = await fetch(
    `${FIRESTORE_BASE}/${collection}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore create failed (${res.status}): ${text}`);
  }
  return true;
}
