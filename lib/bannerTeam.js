/**
 * Banner team configuration
 * Tracks Banner employees to auto-label them in stakeholder lists
 */

export const BANNER_TEAM = [
  {
    name: 'James Banner',
    title: 'CEO',
    department: 'Executive',
    variants: ['james', 'jim banner', 'james b']
  },
  // Add more team members here as needed
];

/**
 * Check if a name matches a Banner team member
 * Returns the full team member info if found, null otherwise
 */
export function identifyBannerTeamMember(name) {
  if (!name) return null;

  const nameLower = name.toLowerCase().trim();

  for (const member of BANNER_TEAM) {
    // Check exact name match
    if (member.name.toLowerCase() === nameLower) {
      return member;
    }

    // Check variants
    if (member.variants?.some(v => v.toLowerCase() === nameLower)) {
      return member;
    }

    // Check if it contains the last name (e.g., "Banner" matches "James Banner")
    const lastName = member.name.split(' ').pop().toLowerCase();
    if (nameLower.includes(lastName) && lastName.length > 3) {
      return member;
    }
  }

  return null;
}

/**
 * Process a stakeholder and label them as Banner if they match
 */
export function labelBannerTeamMember(stakeholder) {
  const bannerMember = identifyBannerTeamMember(stakeholder.name);

  if (bannerMember) {
    return {
      ...stakeholder,
      name: bannerMember.name, // Use canonical name
      title: bannerMember.title,
      department: 'Banner',
      isBannerTeam: true,
      notes: stakeholder.notes
        ? `Banner team member. ${stakeholder.notes}`
        : 'Banner team member'
    };
  }

  return stakeholder;
}

/**
 * Process all stakeholders in an analysis and label Banner team members
 */
export function labelBannerTeamInAnalysis(analysis) {
  if (!analysis?.stakeholders) return analysis;

  return {
    ...analysis,
    stakeholders: analysis.stakeholders.map(labelBannerTeamMember)
  };
}
