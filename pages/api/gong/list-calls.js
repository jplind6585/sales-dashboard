// Gong API - List recent calls with search and filters
// Docs: https://gong.app.gong.io/settings/api/documentation

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

  // Get query params
  const { days = 90, search = '', userId = '', fromDate: fromDateParam = '', toDate: toDateParam = '' } = req.query;

  // Calculate date range
  let fromDate, toDate;
  if (fromDateParam) {
    fromDate = new Date(fromDateParam);
    fromDate.setHours(0, 0, 0, 0);
  } else {
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - parseInt(days));
  }

  if (toDateParam) {
    toDate = new Date(toDateParam);
    toDate.setHours(23, 59, 59, 999);
  } else {
    toDate = new Date();
  }

  try {
    const auth = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    // Fetch calls list with pagination support
    let allCalls = [];
    let cursor = null;
    const maxPages = search ? 10 : 1; // Paginate more when searching to find results
    let pageCount = 0;

    do {
      let url = `${GONG_API_BASE}/v2/calls?fromDateTime=${fromDate.toISOString()}&toDateTime=${toDate.toISOString()}`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        console.error('Gong list-calls error:', errorData);
        return res.status(response.status).json({
          error: errorData.errors?.[0]?.message || errorData.message || `Gong API error: ${response.status}`
        });
      }

      const data = await response.json();
      allCalls = allCalls.concat(data.calls || []);
      cursor = data.records?.cursor || null;
      pageCount++;

      // Stop if we've found enough results or hit max pages
      if (!cursor || pageCount >= maxPages) break;
    } while (true);

    const data = { calls: allCalls };

    // Format calls for the frontend
    let calls = (data.calls || []).map(call => ({
      id: call.id,
      title: call.title || 'Untitled Call',
      date: call.started,
      duration: call.duration,
      url: call.url,
      parties: call.parties || [],
      direction: call.direction,
      // Extract searchable fields
      primaryUser: call.primaryUserId,
      // Try to get account/company info from call context
      accountName: call.context?.find(c => c.system === 'Salesforce')?.objects?.find(o => o.objectType === 'Account')?.objectId,
      isImported: false
    }));

    // If we have calls, fetch user info to get names
    if (calls.length > 0) {
      try {
        // Get unique user IDs from calls
        const userIds = [...new Set(calls.map(c => c.primaryUser).filter(Boolean))];

        if (userIds.length > 0) {
          // Fetch users
          const usersResponse = await fetch(
            `${GONG_API_BASE}/v2/users`,
            {
              method: 'GET',
              headers
            }
          );

          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const userMap = {};
            (usersData.users || []).forEach(user => {
              userMap[user.id] = {
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                email: user.emailAddress
              };
            });

            // Attach user info to calls
            calls = calls.map(call => ({
              ...call,
              user: userMap[call.primaryUser] || null
            }));
          }
        }
      } catch (userError) {
        console.error('Error fetching user info:', userError);
        // Continue without user info
      }
    }

    // Apply user filter
    if (userId) {
      calls = calls.filter(call => call.primaryUser === userId);
    }

    // Apply search filter (client-side for now)
    const searchLower = search.toLowerCase().trim();
    if (searchLower) {
      calls = calls.filter(call => {
        const titleMatch = (call.title || '').toLowerCase().includes(searchLower);
        const userNameMatch = (call.user?.name || '').toLowerCase().includes(searchLower);
        const userEmailMatch = (call.user?.email || '').toLowerCase().includes(searchLower);
        // Check parties for external participants (potential accounts)
        const partyMatch = (call.parties || []).some(party =>
          (party.name || '').toLowerCase().includes(searchLower) ||
          (party.emailAddress || '').toLowerCase().includes(searchLower) ||
          (party.company || '').toLowerCase().includes(searchLower)
        );
        return titleMatch || userNameMatch || userEmailMatch || partyMatch;
      });
    }

    // Sort by date descending (most recent first)
    calls.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build users list for filter dropdown
    const usersForFilter = [];
    const seenUserIds = new Set();
    calls.forEach(call => {
      if (call.primaryUser && call.user && !seenUserIds.has(call.primaryUser)) {
        seenUserIds.add(call.primaryUser);
        usersForFilter.push({
          id: call.primaryUser,
          name: call.user.name,
          email: call.user.email
        });
      }
    });
    usersForFilter.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      calls,
      users: usersForFilter,
      totalCalls: calls.length,
      searchApplied: !!searchLower,
      filters: {
        userId: userId || null,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching Gong calls:', error);
    return res.status(500).json({
      error: `Failed to fetch calls: ${error.message}`
    });
  }
}
