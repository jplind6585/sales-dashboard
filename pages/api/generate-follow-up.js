// Fetch learned patterns from user edits
const fetchLearnedPatterns = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/get-email-patterns`);
    if (response.ok) {
      const data = await response.json();
      return data.styleGuide || '';
    }
  } catch (err) {
    console.error('Error fetching learned patterns:', err);
  }
  return '';
};

// Auto-generate relevant content based on call context
const autoGenerateContent = async (account, transcript, callStage) => {
  const generatedDocs = [];

  try {
    // Determine which content to generate based on vertical and stage
    const vertical = account?.vertical;

    // For now, only generate 1-pager for intro/demo calls with multifamily accounts
    // This keeps it simple for initial testing
    if ((callStage === 'intro' || callStage === 'demo') && vertical === 'multifamily') {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: 'multifamily',
            account
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.document) {
            generatedDocs.push({
              name: data.document.name,
              url: data.document.url,
              pdfData: data.document.pdfData,
              pdfFilename: data.document.pdfFilename
            });
          }
        }
      } catch (err) {
        console.error('Error generating 1-pager:', err);
      }
    }

  } catch (error) {
    console.error('Error in autoGenerateContent:', error);
  }

  return generatedDocs;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, account, emailSignature } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Get learned patterns from previous edits
  const learnedPatterns = await fetchLearnedPatterns();

  // Extract data from transcript and account
  const attendees = transcript.attendees || [];
  const nextSteps = transcript.rawAnalysis?.nextSteps || [];
  const summary = transcript.summary || '';
  const callType = transcript.callType || 'sales';
  const callDate = transcript.date || 'recent';

  // Detect call stage from transcript content
  const detectCallStage = (summary, nextSteps, account) => {
    const lowerSummary = (summary || '').toLowerCase();
    const lowerSteps = (nextSteps || []).join(' ').toLowerCase();
    const combinedText = lowerSummary + ' ' + lowerSteps;

    // Check for proposal/contract stage
    if (combinedText.includes('proposal') || combinedText.includes('pricing') ||
        combinedText.includes('contract') || combinedText.includes('legal') ||
        combinedText.includes('msa') || combinedText.includes('terms')) {
      return 'proposal';
    }

    // Check for evaluation stage
    if (combinedText.includes('evaluation') || combinedText.includes('trial') ||
        combinedText.includes('security review') || combinedText.includes('decision criteria') ||
        combinedText.includes('business case') || combinedText.includes('champion')) {
      return 'evaluation';
    }

    // Check for technical/integration discussion
    if (combinedText.includes('integration') || combinedText.includes('api') ||
        combinedText.includes('technical') || combinedText.includes('implementation') ||
        combinedText.includes('data migration') || combinedText.includes('systems')) {
      return 'technical';
    }

    // Check for demo
    if (combinedText.includes('demo') || combinedText.includes('walkthrough') ||
        combinedText.includes('showed') || combinedText.includes('demonstrated') ||
        combinedText.includes('screen share')) {
      return 'demo';
    }

    // Default to intro for first calls
    return 'intro';
  };

  const callStage = detectCallStage(summary, nextSteps, account);

  // Get account context for richer emails
  const accountName = account?.name || 'the prospect';
  const stakeholders = account?.stakeholders || [];
  const businessAreas = account?.businessAreas || {};
  const meddicc = account?.meddicc || {};

  // Find key decision makers from stakeholders
  const keyStakeholders = stakeholders
    .filter(s => s.role === 'Champion' || s.role === 'Decision Maker' || s.role === 'Economic Buyer')
    .map(s => s.name)
    .slice(0, 3);

  // Get active pain points from business areas
  const painPoints = [];
  Object.entries(businessAreas).forEach(([area, data]) => {
    if (data?.painPoints) {
      painPoints.push(...data.painPoints.filter(p => p?.trim()));
    }
  });

  // Get MEDDICC context if available
  const metricsContext = meddicc.metrics || '';
  const decisionCriteria = meddicc.decisionCriteria || '';
  const economicBuyer = meddicc.economicBuyer || '';

  // Stage-specific guidance
  const stageGuidance = {
    intro: `This is an introductory/discovery call. Focus on:
- Building rapport and understanding their business
- Uncovering pain points and current processes
- Qualifying fit and identifying key stakeholders
- Setting up next conversation (usually a demo)
Keep tone exploratory and consultative.`,
    demo: `This is a product demo call. Focus on:
- Highlighting features that address their specific pain points
- Showing how Banner solves their problems
- Getting feedback on what resonated
- Moving toward evaluation or technical discussion
Keep tone educational but solution-focused.`,
    technical: `This is a technical/integration discussion. Focus on:
- Integration details (APIs, data flows, systems)
- Implementation timeline and requirements
- Technical questions and concerns
- Security, compliance, data migration
Keep tone detail-oriented and implementation-focused.`,
    evaluation: `This is an evaluation/decision stage call. Focus on:
- Business case and ROI justification
- Decision criteria and evaluation process
- Champion enablement and internal stakeholder alignment
- Timeline to decision
Keep tone strategic and decision-focused.`,
    proposal: `This is a proposal/commercial discussion. Focus on:
- Pricing, contract terms, and commercial details
- Legal/procurement process
- Timeline to close
- Final objections or concerns
Keep tone business-focused and closing-oriented.`
  };

  const systemPrompt = `You are a senior sales professional at Banner, a CapEx management software company for commercial real estate. You write extremely concise, action-oriented follow-up emails.

Banner's sales process stages:
1. Introduction call
2. Demo
3. Evaluation (business process review + Banner solution fit)
4. Proposal
5. Legal/Contract

CURRENT CALL STAGE: ${callStage.toUpperCase()}
${stageGuidance[callStage]}

YOUR STYLE:
- Ultra-concise - no fluff, no filler, get to the point
- Every sentence must add value or be deleted
- 2-3 short paragraphs maximum
- Crystal clear on next steps and what you need from them
- Professional but direct
- Adapt your tone and content to the current sales stage

FORMAT REQUIREMENTS:
- Subject line: "Banner Follow Up - [Date]" (use MM/DD format, start with "Subject: ")
- Greeting: If 3 or fewer attendees, use their first names ("Hi Sarah and Mike,"). If more than 3, use "Hi everybody,"
- Brief recap (2-3 bullets max) - only key points discussed
- Attachment section with simple list
- Next steps section - be VERY specific about what happens next and what you need from them
- Sign-off: Just "James" (no "Best regards" or other formalities)

BULLET POINT STYLE - CRITICAL:
Use bullet points (•) for ALL lists throughout the email. NO hyphens (-), NO numbers (1. 2. 3.).

Examples:
Key takeaways from our call:
• Point one
• Point two

Attaching:
• Document one
• Document two

Next steps - I need from you:
• Action one
• Action two

ATTACHMENTS SECTION:
Based on the call, include a simple list of what you're attaching. Use this format with bullet points (•):

Attaching:
• Item 1 name
• Item 2 name
• Item 3 name

Banner's actual sales collateral (reference these by name):
- "Banner 1-Page Overview" (we have versions for Multifamily, Commercial, Student, Senior, etc.)
- Integration overviews: "Yardi integration overview", "QuickBooks integration overview", "RealPage integration overview", etc.
- Case studies from customers like Livcor, Tourmaline, MAA, Olympus Property, etc.
- "Demo recording for team review" (if Gong link exists)
- Competitor comparisons: "Banner vs [competitor] comparison" (e.g., RealPage, Procore, Yardi CM)

Keep the list short (3-4 items max). Use simple bullet points, NOT checkboxes.

Match the collateral to what was discussed:
- If they mentioned a specific vertical → "Banner 1-Page Overview - [Vertical]"
- If they use specific systems → Include that integration overview
- If they mentioned competitors → Include comparison doc
- If it's a demo call → "Demo recording for team review"

IMPORTANT:
- The email should be ready to send as-is
- No meta-commentary, brackets (except checklist), or placeholders
- Focus heavily on next steps - what's happening next and what you need from them to get there
- Be specific about dates, times, who needs to be involved${learnedPatterns}`;

  // Format date for subject line (MM/DD)
  const formatDateForSubject = (dateStr) => {
    if (!dateStr) return new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  };
  const subjectDate = formatDateForSubject(callDate);

  // Determine greeting based on attendee count
  const attendeeNames = attendees.map(a => a.split(' ')[0].split('(')[0].trim());
  const externalAttendees = attendeeNames.filter(name => !name.includes('Banner') && name !== 'James');

  // Build context-aware user prompt
  let contextSection = '';
  if (keyStakeholders.length > 0) {
    contextSection += `\nKey Stakeholders: ${keyStakeholders.join(', ')}`;
  }
  if (painPoints.length > 0) {
    contextSection += `\n\nKnown Pain Points:\n${painPoints.slice(0, 3).map(p => `- ${p}`).join('\n')}`;
  }
  if (metricsContext) {
    contextSection += `\n\nSuccess Metrics: ${metricsContext}`;
  }
  if (decisionCriteria) {
    contextSection += `\nDecision Criteria: ${decisionCriteria}`;
  }

  const userPrompt = `Write a follow-up email for a ${callType} call with ${accountName}.

Call Date: ${callDate} (Use ${subjectDate} in subject line)
Attendees (${externalAttendees.length} external): ${attendees.length > 0 ? attendees.join(', ') : 'Not specified'}
${contextSection}

Call Summary:
${summary}

${nextSteps.length > 0 ? `Agreed Next Steps:\n${nextSteps.map(s => `- ${s}`).join('\n')}` : ''}

CRITICAL INSTRUCTIONS:
1. Use "Banner Follow Up - ${subjectDate}" as the subject line
2. Greeting: ${externalAttendees.length <= 3 ? `Use their first names: "Hi ${externalAttendees.slice(0, 3).join(' and ')},"` : 'Use "Hi everybody,"'}
3. Be ultra-concise - no fluff or filler
4. Use BULLET POINTS (•) for ALL lists - key takeaways, attachments, next steps
5. NO hyphens (-), NO numbers (1. 2. 3.), only bullets (•)
6. Make next steps crystal clear - what happens next and what you need from them
7. Sign-off: Just "James" (nothing else)

Write the follow-up email now.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        temperature: 0, // Deterministic output for consistency
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.status}`
      });
    }

    const data = await response.json();
    let content = data.content?.[0]?.text || '';

    // Auto-generate relevant content and prepare downloads
    const generatedContent = await autoGenerateContent(account, transcript, callStage);

    if (generatedContent.length > 0) {
      // Find "Attaching:" section and replace with file names (PDFs will auto-download)
      const attachingSectionMatch = content.match(/(Attaching:|Sending you:)\s*\n([\s\S]*?)(?=\n\n|Next steps|$)/);

      if (attachingSectionMatch) {
        // Build new attachment section with just file names
        let newAttachmentSection = `${attachingSectionMatch[1]}\n`;
        generatedContent.forEach(doc => {
          // Only include PDFs (not Gong links)
          if (doc.pdfFilename) {
            newAttachmentSection += `• ${doc.pdfFilename}\n`;
          }
        });

        // Replace the old attachment section
        content = content.replace(attachingSectionMatch[0], newAttachmentSection);
      } else {
        // No attachment section found, add one before signature/next steps
        const insertPoint = content.lastIndexOf('\n\nNext steps') !== -1
          ? content.lastIndexOf('\n\nNext steps')
          : content.lastIndexOf('\n\nJames');

        if (insertPoint !== -1) {
          let attachmentSection = '\n\nAttaching:\n';
          generatedContent.forEach(doc => {
            if (doc.pdfFilename) {
              attachmentSection += `• ${doc.pdfFilename}\n`;
            }
          });
          content = content.slice(0, insertPoint) + attachmentSection + content.slice(insertPoint);
        }
      }
    }

    // Append email signature if provided
    if (emailSignature && emailSignature.trim()) {
      // Add double line break before signature
      content = content.trim() + '\n\n' + emailSignature.trim();
    }

    return res.status(200).json({
      success: true,
      content,
      detectedStage: callStage,
      generatedContent: generatedContent.map(doc => ({
        name: doc.name,
        url: doc.url,
        pdfData: doc.pdfData,
        pdfFilename: doc.pdfFilename
      }))
    });
  } catch (error) {
    console.error('Error generating follow-up email:', error);
    return res.status(500).json({
      error: 'Failed to generate follow-up email'
    });
  }
}
