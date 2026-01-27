// Gong API - Import a specific call with transcript
// Docs: https://gong.app.gong.io/settings/api/documentation

import { topicMatches } from '../../../lib/mergeUtils';
import {
  apiError,
  apiSuccess,
  validateMethod,
  validateRequired,
  validateGongCredentials,
  createGongHeaders,
  logRequest,
} from '../../../lib/apiUtils';

const GONG_API_BASE = 'https://api.gong.io';

export default async function handler(req, res) {
  logRequest(req, 'gong/import-call');

  if (!validateMethod(req, res, 'POST')) return;
  if (!validateRequired(req, res, ['callId'])) return;

  const { callId } = req.body;

  const credentials = validateGongCredentials(res);
  if (!credentials) return;

  const { accessKey, secretKey } = credentials;
  const headers = createGongHeaders(accessKey, secretKey);

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
      return apiError(res, 500, 'Invalid response from Gong API (call details)', detailsText.substring(0, 200));
    }

    if (!detailsResponse.ok) {
      console.error('Call details API error:', detailsData);
      const errorMsg = detailsData.errors?.[0]?.message || detailsData.message || 'Failed to fetch call details';
      return apiError(res, detailsResponse.status, errorMsg, detailsData);
    }

    const callDetails = detailsData.calls?.[0];

    if (!callDetails) {
      return apiError(res, 404, 'Call not found in Gong');
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
      return apiError(res, 500, 'Invalid response from Gong API (transcript)', transcriptText.substring(0, 200));
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

    if (title.includes('intro') || title.includes('introduction')) {
      callType = 'intro';
    } else if (title.includes('discovery') || topicMatches(topics, 'discovery')) {
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
    return apiSuccess(res, { call: importedCall });
  } catch (error) {
    console.error('Error importing Gong call:', error);
    return apiError(res, 500, `Failed to import call: ${error.message}`);
  }
}
