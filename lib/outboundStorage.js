/**
 * Outbound Engine Storage Utilities
 * Manages prospect companies, contacts, and notes
 */

const STORAGE_KEY = 'outbound_companies';

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all prospect companies
 */
export function getCompanies() {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save companies to storage
 */
export function saveCompanies(companies) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}

/**
 * Create a new prospect company
 */
export function createCompany(data) {
  const companies = getCompanies();

  const newCompany = {
    id: generateId(),
    name: data.name,
    url: data.url || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || 'USA',
    ownManage: data.ownManage || '',
    vertical: data.vertical || '',
    subvertical: data.subvertical || '',
    properties: data.properties || null,
    unitsOrSqft: data.unitsOrSqft || null,
    annualSpend: data.annualSpend || null,
    priority: data.priority || 'medium',
    status: data.status || 'cold',
    percentProspected: 0,
    contacts: [],
    notes: [],
    tools: {
      pms: data.pms || null,
      accounting: data.accounting || null,
      projectMgmt: data.projectMgmt || null,
      other: data.otherTools || null
    },
    activity: {
      calls: 0,
      emails: 0,
      sequences: 0,
      heyReach: 0
    },
    assignedTo: data.assignedTo || null,
    lastContacted: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  companies.push(newCompany);
  saveCompanies(companies);
  return newCompany;
}

/**
 * Update a company
 */
export function updateCompany(companyId, updates) {
  const companies = getCompanies();
  const index = companies.findIndex(c => c.id === companyId);

  if (index === -1) return null;

  companies[index] = {
    ...companies[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  saveCompanies(companies);
  return companies[index];
}

/**
 * Delete a company
 */
export function deleteCompany(companyId) {
  const companies = getCompanies();
  const filtered = companies.filter(c => c.id !== companyId);
  saveCompanies(filtered);
  return true;
}

/**
 * Add a contact to a company
 */
export function addContact(companyId, contactData) {
  const companies = getCompanies();
  const company = companies.find(c => c.id === companyId);

  if (!company) return null;

  const newContact = {
    id: generateId(),
    name: contactData.name,
    title: contactData.title || '',
    department: contactData.department || '',
    email: contactData.email || '',
    companyLine: contactData.companyLine || '',
    directLine: contactData.directLine || '',
    mobileLine: contactData.mobileLine || '',
    linkedin: contactData.linkedin || '',
    classification: contactData.classification || 'BTL', // ATL, BTL, POTENTIAL_CHAMPION
    status: contactData.status || 'cold',
    timesCalled: contactData.timesCalled || 0,
    timesEmailed: contactData.timesEmailed || 0,
    lastCall: contactData.lastCall || null,
    lastEmail: contactData.lastEmail || null,
    notes: contactData.notes || '',
    createdAt: new Date().toISOString()
  };

  company.contacts.push(newContact);
  company.updatedAt = new Date().toISOString();

  // Update last contacted date for company
  if (contactData.lastContacted) {
    company.lastContacted = contactData.lastContacted;
  }

  saveCompanies(companies);
  return newContact;
}

/**
 * Update a contact
 */
export function updateContact(companyId, contactId, updates) {
  const companies = getCompanies();
  const company = companies.find(c => c.id === companyId);

  if (!company) return null;

  const contactIndex = company.contacts.findIndex(c => c.id === contactId);
  if (contactIndex === -1) return null;

  company.contacts[contactIndex] = {
    ...company.contacts[contactIndex],
    ...updates
  };

  company.updatedAt = new Date().toISOString();
  saveCompanies(companies);
  return company.contacts[contactIndex];
}

/**
 * Delete a contact
 */
export function deleteContact(companyId, contactId) {
  const companies = getCompanies();
  const company = companies.find(c => c.id === companyId);

  if (!company) return false;

  company.contacts = company.contacts.filter(c => c.id !== contactId);
  company.updatedAt = new Date().toISOString();
  saveCompanies(companies);
  return true;
}

/**
 * Add a note to a company
 */
export function addNote(companyId, noteData) {
  const companies = getCompanies();
  const company = companies.find(c => c.id === companyId);

  if (!company) return null;

  const newNote = {
    id: generateId(),
    type: noteData.type || 'General',
    contact: noteData.contact || null, // Contact ID this note is about
    content: noteData.content,
    createdAt: new Date().toISOString(),
    createdBy: noteData.createdBy || 'current_user'
  };

  company.notes.push(newNote);
  company.updatedAt = new Date().toISOString();
  saveCompanies(companies);
  return newNote;
}

/**
 * Delete a note
 */
export function deleteNote(companyId, noteId) {
  const companies = getCompanies();
  const company = companies.find(c => c.id === companyId);

  if (!company) return false;

  company.notes = company.notes.filter(n => n.id !== noteId);
  company.updatedAt = new Date().toISOString();
  saveCompanies(companies);
  return true;
}

/**
 * Calculate percent prospected based on data collected
 */
export function calculatePercentProspected(company) {
  let score = 0;
  let maxScore = 100;

  // Has contacts (20 points)
  if (company.contacts?.length > 0) score += 20;

  // Has ATL contacts (20 points)
  const atlContacts = company.contacts?.filter(c => c.classification === 'ATL');
  if (atlContacts?.length > 0) score += 20;

  // Has tools identified (15 points)
  const toolsCount = Object.values(company.tools || {}).filter(t => t).length;
  if (toolsCount > 0) score += 15;

  // Has notes/insights (25 points)
  if (company.notes?.length > 0) {
    score += Math.min(25, company.notes.length * 5);
  }

  // Has activity (20 points)
  const activityCount = Object.values(company.activity || {}).reduce((sum, val) => sum + val, 0);
  if (activityCount > 0) score += Math.min(20, activityCount * 2);

  return Math.min(100, Math.round(score));
}

/**
 * Bulk import companies from CSV data
 */
export function bulkImportCompanies(csvData) {
  const companies = getCompanies();
  const imported = [];

  // Assuming csvData is array of objects with matching field names
  csvData.forEach(row => {
    const newCompany = createCompany(row);
    imported.push(newCompany);
  });

  return imported;
}
