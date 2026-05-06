import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'cron/weekly-brief');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  if (!process.env.CRON_SECRET || req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError(res, 401, 'Unauthorized');
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const r = await fetch(`${baseUrl}/api/manager/weekly-brief?send=slack`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const d = await r.json();
    if (!r.ok) return apiError(res, 500, d.error || 'weekly-brief failed');
    return apiSuccess(res, { sent: true, generatedAt: d.generatedAt });
  } catch (e) {
    return apiError(res, 500, e.message);
  }
}
