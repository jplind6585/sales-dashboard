// Gong API - Import a specific call with transcript
// Docs: https://help.gong.io/docs/what-the-gong-api-provides

const GONG_API_BASE = 'https://api.gong.io';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { callId } = req.body;

  if (!callId) {
    return res.status(400).json({ error: 'Call ID is required' });
  }

  const accessKey = process.env.GONG_ACCESS_KEY;
  const secretKey = process.env.GONG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return res.status(500).json({
      error: 'Gong API credentials not configured'
    });
  }

  const auth = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Get call details (extensive) for participant names
    const detailsResponse = await fetch(
      `${GONG_API_BASE}/v2/calls/extensive`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filter: { callIds: [callId] },
          contentSelector: {
            exposedFields: {
              parties: true,
              content: { topics: true }
            }
          }
        })
      }
    );

    if (!detailsResponse.ok) {
      const errorData = await detailsResponse.json().catch(() => ({}));
      return res.status(detailsResponse.status).json({
        error: errorData.message || 'Failed to fetch call details'
      });
    }

    const detailsData = await detailsResponse.json();
    const callDetails = detailsData.calls?.[0];

    if (!callDetails) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // 2. Get transcript
    const transcriptResponse = await fetch(
      `${GONG_API_BASE}/v2/calls/transcript`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filter: { callIds: [callId] }
        })
      }
    );

    if (!transcriptResponse.ok) {
      const errorData = await transcriptResponse.json().catch(() => ({}));
      return res.status(transcriptResponse.status).json({
        error: errorData.message || 'Failed to fetch transcript'
      });
    }

    const transcriptData = await transcriptResponse.json();
    const callTranscript = transcriptData.callTranscripts?.[0];

    // Build speaker map from parties
    const speakerMap = {};
    (callDetails.parties || []).forEach(party => {
      speakerMap[party.speakerId] = {
        name: party.name || party.emailAddress || `Speaker ${party.speakerId}`,
        email: party.emailAddress,
        title: party.title,
        affiliation: party.affiliation // 'internal' or 'external'
      };
    });

    // Format transcript with speaker names
    let formattedTranscript = '';
    const attendees = new Set();

    if (callTranscript?.transcript) {
      callTranscript.transcript.forEach(segment => {
        const speaker = speakerMap[segment.speakerId] || { name: `Speaker ${segment.speakerId}` };
        attendees.add(speaker.name);

        segment.sentences?.forEach(sentence => {
          formattedTranscript += `${speaker.name}: ${sentence.text}\n\n`;
        });
      });
    }

    // Determine call type based on topics or title
    let callType = 'other';
    const title = (callDetails.title || '').toLowerCase();
    const topics = callDetails.content?.topics || [];

    if (title.includes('intro') || title.includes('introduction')) {
      callType = 'intro';
    } else if (title.includes('discovery') || topics.some(t => t.toLowerCase().includes('discovery'))) {
      callType = 'discovery';
    } else if (title.includes('demo') || title.includes('demonstration')) {
      callType = 'demo';
    } else if (title.includes('pricing') || title.includes('proposal')) {
      callType = 'pricing';
    } else if (title.includes('negotiat')) {
      callType = 'negotiation';
    } else if (title.includes('follow')) {
      callType = 'follow_up';
    }

    // Build response
    const importedCall = {
      gongCallId: callId,
      gongUrl: callDetails.url,
      title: callDetails.title,
      date: callDetails.started ? new Date(callDetails.started).toISOString().split('T')[0] : null,
      duration: callDetails.duration,
      callType,
      attendees: Array.from(attendees),
      transcript: formattedTranscript.trim(),
      parties: callDetails.parties?.map(p => ({
        name: p.name,
        email: p.emailAddress,
        title: p.title,
        affiliation: p.affiliation
      })) || []
    };

    return res.status(200).json({
      success: true,
      call: importedCall
    });
  } catch (error) {
    console.error('Error importing Gong call:', error);
    return res.status(500).json({
      error: 'Failed to import call from Gong'
    });
  }
}
