// Temporary diagnostic endpoint — checks what CRM context Gong attaches to calls
// Hit GET /api/gong/intel-debug-context to see raw context data for 5 recent calls

import {
  apiError,
  apiSuccess,
  validateMethod,
  validateGongCredentials,
  createGongHeaders,
} from '../../../lib/apiUtils';

const GONG_API_BASE = 'https://api.gong.io';

export default async function handler(req, res) {
  if (!validateMethod(req, res, 'GET')) return;

  const credentials = validateGongCredentials(res);
  if (!credentials) return;
  const { accessKey, secretKey } = credentials;
  const headers = createGongHeaders(accessKey, secretKey);

  try {
    // Grab last 30 days of calls and take first 5 that look like Intro/Demo
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const listRes = await fetch(
      `${GONG_API_BASE}/v2/calls?fromDateTime=${fromDate.toISOString()}&toDateTime=${new Date().toISOString()}`,
      { method: 'GET', headers }
    );
    const listData = await listRes.json();
    const sample = (listData.calls || [])
      .filter(c => {
        const t = (c.title || '').toLowerCase();
        return t.includes('intro') || t.includes('demo');
      })
      .slice(0, 5)
      .map(c => c.id);

    if (sample.length === 0) {
      return apiSuccess(res, { message: 'No Intro/Demo calls found in last 30 days', calls: [] });
    }

    // Fetch extensive data including context for those calls
    const extRes = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { callIds: sample },
        contentSelector: {
          exposedFields: {
            parties: true,
            context: ['*'],  // request all CRM context fields
          },
        },
      }),
    });
    const extData = await extRes.json();

    const calls = (extData.calls || []).map(call => ({
      id: call.id,
      title: call.metaData?.title || call.title,
      date: call.metaData?.started || call.started,
      // This is the key thing we're checking:
      context: call.context || [],
      parties: (call.parties || []).map(p => ({
        name: p.name,
        email: p.emailAddress,
        affiliation: p.affiliation,
      })),
    }));

    return apiSuccess(res, { calls, rawSample: extData.calls?.[0] || null });
  } catch (error) {
    return apiError(res, 500, error.message);
  }
}
