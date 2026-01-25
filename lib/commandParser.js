/**
 * Command parsing logic for manual notes
 */

/**
 * Parse user input and return actions to execute
 * @param {string} input - User input string
 * @returns {Array} Array of action objects
 */
export const parseCommand = (input) => {
  const lowerInput = input.toLowerCase().trim();
  const actions = [];

  // Stakeholder role updates - these should NOT create notes
  if (lowerInput.includes('is the champion') || lowerInput.includes('is a champion') || lowerInput.includes('is champion')) {
    const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|a\s+)?champion/i);
    if (nameMatch) {
      actions.push({
        type: 'update_stakeholder_role',
        name: nameMatch[1].trim(),
        role: 'Champion',
        message: `Updated ${nameMatch[1].trim()} to Champion`
      });
      return actions;
    }
  }

  if (lowerInput.includes('is the executive sponsor') || lowerInput.includes('is an executive sponsor') || lowerInput.includes('is executive sponsor')) {
    const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|an?\s+)?executive sponsor/i);
    if (nameMatch) {
      actions.push({
        type: 'update_stakeholder_role',
        name: nameMatch[1].trim(),
        role: 'Executive Sponsor',
        message: `Updated ${nameMatch[1].trim()} to Executive Sponsor`
      });
      return actions;
    }
  }

  if (lowerInput.includes('is a blocker') || lowerInput.includes('is the blocker') || lowerInput.includes('is blocker')) {
    const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|a\s+)?blocker/i);
    if (nameMatch) {
      actions.push({
        type: 'update_stakeholder_role',
        name: nameMatch[1].trim(),
        role: 'Blocker',
        message: `Updated ${nameMatch[1].trim()} to Blocker`
      });
      return actions;
    }
  }

  if (lowerInput.includes('is an influencer') || lowerInput.includes('is the influencer') || lowerInput.includes('is influencer')) {
    const nameMatch = input.match(/^(.+?)\s+is\s+(?:the\s+|an?\s+)?influencer/i);
    if (nameMatch) {
      actions.push({
        type: 'update_stakeholder_role',
        name: nameMatch[1].trim(),
        role: 'Influencer',
        message: `Updated ${nameMatch[1].trim()} to Influencer`
      });
      return actions;
    }
  }

  // Budget mentions
  if (lowerInput.includes('budget')) {
    const budgetMatch = input.match(/budget\s+(?:is\s+)?(\$[\d,]+(?:\.\d{2})?|\d+k?)/i);
    if (budgetMatch) {
      actions.push({
        type: 'note',
        category: 'Budget',
        content: input,
        message: `Added budget note: ${budgetMatch[1]}`
      });
      return actions;
    }
  }

  // CM fees or other fees
  if (lowerInput.includes('cm fee') || lowerInput.includes('cm fees') || lowerInput.includes('construction management')) {
    actions.push({
      type: 'note',
      category: 'Fees',
      content: input,
      message: 'Added note about fees'
    });
    return actions;
  }

  // Timeline mentions
  if (lowerInput.includes('timeline') || lowerInput.includes('go live') || lowerInput.includes('launch date')) {
    actions.push({
      type: 'note',
      category: 'Timeline',
      content: input,
      message: 'Added timeline note'
    });
    return actions;
  }

  // General note for everything else
  actions.push({
    type: 'note',
    category: 'General',
    content: input,
    message: 'Added general note'
  });

  return actions;
};

/**
 * Execute parsed actions on an account
 * @param {Array} actions - Array of action objects from parseCommand
 * @param {Object} account - The account to update
 * @param {Function} generateId - Function to generate unique IDs
 * @returns {Object} Updated account and messages
 */
export const executeActions = (actions, account, generateId) => {
  if (!account) return { account: null, messages: [] };

  const updatedAccount = { ...account };
  const messages = [];

  actions.forEach(action => {
    if (action.type === 'update_stakeholder_role') {
      const stakeholderIndex = updatedAccount.stakeholders?.findIndex(
        s => s.name.toLowerCase().trim() === action.name.toLowerCase().trim()
      );
      if (stakeholderIndex !== -1 && stakeholderIndex !== undefined) {
        updatedAccount.stakeholders = [...updatedAccount.stakeholders];
        updatedAccount.stakeholders[stakeholderIndex] = {
          ...updatedAccount.stakeholders[stakeholderIndex],
          role: action.role
        };
        messages.push({
          type: 'success',
          text: `✓ Updated ${updatedAccount.stakeholders[stakeholderIndex].name} to ${action.role}`
        });
      } else {
        messages.push({
          type: 'warning',
          text: `⚠ Stakeholder "${action.name}" not found. Please add them first or check the spelling.`
        });
      }
    } else if (action.type === 'note') {
      if (!updatedAccount.notes) {
        updatedAccount.notes = [];
      }
      updatedAccount.notes = [
        ...updatedAccount.notes,
        {
          id: generateId(),
          category: action.category,
          content: action.content,
          timestamp: new Date().toISOString()
        }
      ];
      messages.push({
        type: 'success',
        text: action.message
      });
    }
  });

  return { account: updatedAccount, messages };
};
