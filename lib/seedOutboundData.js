/**
 * Seed sample outbound companies from spreadsheet
 */

import { createCompany, addContact } from './outboundStorage';

export const SAMPLE_COMPANIES = [
  {
    name: 'University Partners',
    url: 'https://www.universitypartners.com/',
    city: 'Scottsdale',
    state: 'Arizona',
    country: 'USA',
    ownManage: 'Own & Manage',
    vertical: 'student',
    subvertical: '',
    properties: 25,
    unitsOrSqft: 25000,
    annualSpend: null,
    priority: 'high',
    status: 'cold'
  },
  {
    name: 'Provident Resources Group',
    url: 'http://provident.org',
    city: 'Atlanta',
    state: 'Georgia',
    country: 'USA',
    ownManage: 'Own & Manage',
    vertical: 'student',
    subvertical: '',
    properties: 40,
    unitsOrSqft: 22000,
    annualSpend: null,
    priority: 'high',
    status: 'cold'
  },
  {
    name: 'Hawthorn Senior Living',
    url: 'https://seniorlivinginstyle.com/',
    city: 'Vancouver',
    state: 'Washington',
    country: 'USA',
    ownManage: 'Own & Manage',
    vertical: 'senior',
    subvertical: '',
    properties: 78,
    unitsOrSqft: 10225,
    annualSpend: null,
    priority: 'high',
    status: 'cold'
  },
  {
    name: 'Legend Senior Living',
    url: 'https://legendseniorliving.com/',
    city: 'Wichita',
    state: 'Kansas',
    country: 'USA',
    ownManage: 'Own & Manage',
    vertical: 'senior',
    subvertical: '',
    properties: 65,
    unitsOrSqft: 4744,
    annualSpend: null,
    priority: 'high',
    status: 'cold'
  },
  {
    name: 'Healthpeak Properties, Inc.',
    url: 'https://healthpeak.com/',
    city: 'Denver',
    state: 'Colorado',
    country: 'USA',
    ownManage: 'Own Only',
    vertical: 'senior',
    subvertical: 'Life Science',
    properties: 600,
    unitsOrSqft: 27000,
    annualSpend: null,
    priority: 'high',
    status: 'cold'
  }
];

const SAMPLE_CONTACTS = {
  'University Partners': [
    {
      name: 'Sarah Chen',
      title: 'VP of Asset Management',
      department: 'Asset Management',
      email: 'schen@universitypartners.com',
      companyLine: '(480) 555-0100',
      directLine: '(480) 555-0101',
      mobileLine: '(602) 555-0101',
      linkedin: 'linkedin.com/in/sarahchen',
      classification: 'ATL',
      status: 'connected_follow_up',
      timesCalled: 3,
      timesEmailed: 5,
      lastCall: '2024-02-10',
      lastEmail: '2024-02-12'
    },
    {
      name: 'Mike Rodriguez',
      title: 'Director of Construction',
      department: 'Construction',
      email: 'mrodriguez@universitypartners.com',
      companyLine: '(480) 555-0100',
      directLine: '(480) 555-0102',
      classification: 'BTL',
      status: 'connected_no_interest',
      timesCalled: 2,
      timesEmailed: 3,
      lastCall: '2024-02-08',
      lastEmail: '2024-02-09'
    },
    {
      name: 'Jennifer Thompson',
      title: 'CFO',
      department: 'C-suite',
      email: 'jthompson@universitypartners.com',
      directLine: '(480) 555-0103',
      mobileLine: '(602) 555-0102',
      classification: 'ATL',
      status: 'targeting',
      timesCalled: 1,
      timesEmailed: 2,
      lastEmail: '2024-02-11'
    }
  ],
  'Provident Resources Group': [
    {
      name: 'David Park',
      title: 'SVP Asset Management',
      department: 'Asset Management',
      email: 'dpark@provident.org',
      companyLine: '(404) 555-0200',
      directLine: '(404) 555-0201',
      classification: 'POTENTIAL_CHAMPION',
      status: 'connected_follow_up',
      timesCalled: 4,
      timesEmailed: 6,
      lastCall: '2024-02-11',
      lastEmail: '2024-02-12'
    },
    {
      name: 'Lisa Martinez',
      title: 'Construction Manager',
      department: 'Construction',
      email: 'lmartinez@provident.org',
      companyLine: '(404) 555-0200',
      classification: 'BTL',
      status: 'cold',
      timesCalled: 0,
      timesEmailed: 1,
      lastEmail: '2024-02-05'
    }
  ],
  'Hawthorn Senior Living': [
    {
      name: 'Robert Johnson',
      title: 'CEO',
      department: 'C-suite',
      email: 'rjohnson@seniorlivinginstyle.com',
      companyLine: '(360) 555-0300',
      mobileLine: '(206) 555-0301',
      classification: 'ATL',
      status: 'targeting',
      timesCalled: 2,
      timesEmailed: 3,
      lastCall: '2024-02-09',
      lastEmail: '2024-02-10'
    },
    {
      name: 'Amanda White',
      title: 'VP of Development',
      department: 'Development',
      email: 'awhite@seniorlivinginstyle.com',
      directLine: '(360) 555-0302',
      classification: 'ATL',
      status: 'connected_re_engage',
      timesCalled: 5,
      timesEmailed: 8,
      lastCall: '2024-01-28',
      lastEmail: '2024-02-01'
    },
    {
      name: 'Tom Wilson',
      title: 'Accounting Director',
      department: 'Accounting/Finance',
      email: 'twilson@seniorlivinginstyle.com',
      companyLine: '(360) 555-0300',
      classification: 'BTL',
      status: 'connected_follow_up',
      timesCalled: 1,
      timesEmailed: 2,
      lastCall: '2024-02-07',
      lastEmail: '2024-02-08'
    }
  ],
  'Legend Senior Living': [
    {
      name: 'Karen Davis',
      title: 'VP of Acquisitions',
      department: 'Acquisitions',
      email: 'kdavis@legendseniorliving.com',
      directLine: '(316) 555-0401',
      mobileLine: '(316) 555-0402',
      classification: 'POTENTIAL_CHAMPION',
      status: 'connected_follow_up',
      timesCalled: 6,
      timesEmailed: 10,
      lastCall: '2024-02-12',
      lastEmail: '2024-02-13'
    }
  ],
  'Healthpeak Properties, Inc.': [
    {
      name: 'James Mitchell',
      title: 'SVP Asset Management',
      department: 'Asset Management',
      email: 'jmitchell@healthpeak.com',
      companyLine: '(303) 555-0500',
      directLine: '(303) 555-0501',
      classification: 'ATL',
      status: 'cold',
      timesCalled: 0,
      timesEmailed: 0
    },
    {
      name: 'Patricia Brown',
      title: 'CFO',
      department: 'C-suite',
      email: 'pbrown@healthpeak.com',
      directLine: '(303) 555-0502',
      mobileLine: '(720) 555-0501',
      classification: 'ATL',
      status: 'targeting',
      timesCalled: 1,
      timesEmailed: 1,
      lastEmail: '2024-02-06'
    },
    {
      name: 'Steven Garcia',
      title: 'Director of Construction',
      department: 'Construction',
      email: 'sgarcia@healthpeak.com',
      companyLine: '(303) 555-0500',
      classification: 'BTL',
      status: 'cold',
      timesCalled: 0,
      timesEmailed: 0
    }
  ]
};

/**
 * Seed the database with sample companies if empty
 */
export function seedSampleData() {
  if (typeof window === 'undefined') return;

  // Check if we already have data
  const existingData = localStorage.getItem('outbound_companies');
  if (existingData) {
    const companies = JSON.parse(existingData);
    if (companies.length > 0) {
      console.log('Sample data already exists, skipping seed');
      return;
    }
  }

  // Seed sample companies
  console.log('Seeding sample outbound companies...');
  SAMPLE_COMPANIES.forEach(companyData => {
    const company = createCompany(companyData);

    // Add sample contacts for this company
    const contacts = SAMPLE_CONTACTS[companyData.name] || [];
    contacts.forEach(contactData => {
      addContact(company.id, contactData);
    });
  });

  console.log(`Seeded ${SAMPLE_COMPANIES.length} sample companies with contacts`);
}
