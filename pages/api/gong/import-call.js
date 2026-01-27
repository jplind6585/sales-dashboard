// Gong API - Import a specific call with transcript
// Docs: https://gong.app.gong.io/settings/api/documentation

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
    console.log(`Fetching call details for: ${callId}`);
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

    const detailsText = await detailsResponse.text();
    let detailsData;

    try {
      detailsData = JSON.parse(detailsText);
    } catch (parseErr) {
      console.error('Failed to parse call details response:', detailsText);
      return res.status(500).json({
        error: 'Invalid response from Gong API (call details)',
        details: detailsText.substring(0, 200)
      });
    }

    if (!detailsResponse.ok) {
      console.error('Call details API error:', detailsData);
      return res.status(detailsResponse.status).json({
        error: detailsData.errors?.[0]?.message || detailsData.message || 'Failed to fetch call details',
        gongError: detailsData
      });
    }

    const callDetails = detailsData.calls?.[0];

    if (!callDetails) {
      return res.status(404).json({ error: 'Call not found in Gong' });
    }

    // 2. Get transcript
    console.log(`Fetching transcript for: ${callId}`);
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

    const transcriptText = await transcriptResponse.text();
    let transcriptData;

    try {
      transcriptData = JSON.parse(transcriptText);
    } catch (parseErr) {
      console.error('Failed to parse transcript response:', transcriptText);
      return res.status(500).json({
        error: 'Invalid response from Gong API (transcript)',
        details: transcriptText.substring(0, 200)
      });
    }

    if (!transcriptResponse.ok) {
      console.error('Transcript API error:', transcriptData);
      // Continue without transcript - some calls may not have transcripts
      console.log('Continuing without transcript...');
      transcriptData = { callTranscripts: [] };
    }

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

    if (callTranscript?.transcript && Array.isArray(callTranscript.transcript)) {
      callTranscript.transcript.forEach(segment => {
        const speaker = speakerMap[segment.speakerId] || { name: `Speaker ${segment.speakerId}` };
        attendees.add(speaker.name);

        if (segment.sentences && Array.isArray(segment.sentences)) {
          segment.sentences.forEach(sentence => {
            formattedTranscript += `${speaker.name}: ${sentence.text}\n\n`;
          });
        } else if (segment.text) {
          // Alternative format where segment has text directly
          formattedTranscript += `${speaker.name}: ${segment.text}\n\n`;
        }
      });
    }

    // If no transcript content, provide a placeholder
    if (!formattedTranscript.trim()) {
      formattedTranscript = '[No transcript available for this call]';
      // Add parties to attendees anyway
      (callDetails.parties || []).forEach(party => {
        if (party.name || party.emailAddress) {
          attendees.add(party.name || party.emailAddress);
        }
      });
    }

    // Determine call type based on topics or title
    let callType = 'other';
    const title = String(callDetails.title || '').toLowerCase();
    const topics = callDetails.content?.topics || [];

    // Helper to safely check if a topic matches
    const topicMatches = (keyword) => topics.some(t => {
      const topicStr = typeof t === 'string' ? t : (t?.name || t?.label || '');
      return String(topicStr).toLowerCase().includes(keyword);
    });

    if (title.includes('intro') || title.includes('introduction')) {
      callType = 'intro';
    } else if (title.includes('discovery') || topicMatches('discovery')) {
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

    console.log(`Successfully imported call: ${callDetails.title}`);
    return res.status(200).json({
      success: true,
      call: importedCall
    });
  } catch (error) {
    console.error('Error importing Gong call:', error);
    return res.status(500).json({
      error: `Failed to import call: ${error.message}`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
