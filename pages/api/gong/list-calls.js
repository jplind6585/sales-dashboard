// Gong API - List recent calls
// Docs: https://help.gong.io/docs/what-the-gong-api-provides

const GONG_API_BASE = 'https://api.gong.io';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessKey = process.env.GONG_ACCESS_KEY;
  const secretKey = process.env.GONG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return res.status(500).json({
      error: 'Gong API credentials not configured',
      setup: 'Add GONG_ACCESS_KEY and GONG_SECRET_KEY to environment variables'
    });
  }

  // Get calls from the last 30 days by default
  const { days = 30 } = req.query;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - parseInt(days));
  const toDate = new Date();

  try {
    const auth = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');

    const response = await fetch(
      `${GONG_API_BASE}/v2/calls?fromDateTime=${fromDate.toISOString()}&toDateTime=${toDate.toISOString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.message || `Gong API error: ${response.status}`
      });
    }

    const data = await response.json();

    // Format calls for the frontend
    const calls = (data.calls || []).map(call => ({
      id: call.id,
      title: call.title,
      date: call.started,
      duration: call.duration,
      url: call.url,
      parties: call.parties || [],
      direction: call.direction,
      isImported: false
    }));

    return res.status(200).json({
      success: true,
      calls,
      totalCalls: data.totalRecords || calls.length
    });
  } catch (error) {
    console.error('Error fetching Gong calls:', error);
    return res.status(500).json({
      error: 'Failed to fetch calls from Gong'
    });
  }
}
