/**
 * Outbound Engine Constants
 * Data validation options and configurations
 */

export const VERTICALS = [
  {
    id: 'multifamily',
    name: 'Multifamily',
    subverticals: ['Owner', 'PMC (Property manager)', 'Affordable Housing', 'Small/Medium', 'Developer'],
    primaryMetrics: ['properties', 'units', 'annualSpend']
  },
  {
    id: 'iwl',
    name: 'I/W/L',
    subverticals: ['Cold Storage', 'Industrial Development', 'Logistics & Distribution', 'Self Storage', 'Telecom Infrastructure'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'retail',
    name: 'Retail',
    subverticals: ['Strip malls', 'Indoor malls', 'Outdoor malls', 'Single store sites'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'senior',
    name: 'Senior Living',
    subverticals: ['Owner', 'PMC'],
    primaryMetrics: ['properties', 'units', 'annualSpend']
  },
  {
    id: 'student',
    name: 'Student',
    subverticals: ['Owner', 'PMC'],
    primaryMetrics: ['properties', 'units', 'annualSpend']
  },
  {
    id: 'higher_ed',
    name: 'Higher Ed',
    subverticals: ['Owner', 'PMC'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'hospitality',
    name: 'Hospitality',
    subverticals: ['Operator', 'PMC', 'Small', 'Other'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'government',
    name: 'Government',
    subverticals: ['Federal', 'Local'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'corporate',
    name: 'Corporate',
    subverticals: ['Restaurants', 'Tech', 'Retail', 'Big Box', 'Other'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'office',
    name: 'Office',
    subverticals: ['Owner', 'PMC'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'mixed_use',
    name: 'Mixed Use',
    subverticals: ['Owner', 'PMC'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'healthcare',
    name: 'Healthcare / Medical',
    subverticals: ['Medical Office Buildings (MOB)', 'Hospital', 'Laboratory'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  },
  {
    id: 'builder',
    name: 'Builder/Developer',
    subverticals: ['Owner', 'PMC (Property manager)'],
    primaryMetrics: ['properties', 'sqft', 'annualSpend']
  }
];

export const OWN_MANAGE_OPTIONS = [
  'Own Only',
  'Own & Manage',
  'PMC'
];

export const STATUS_OPTIONS = [
  { id: 'customer', label: 'Customer', color: 'bg-green-100 text-green-700' },
  { id: 'open_deal', label: 'Open Deal', color: 'bg-blue-100 text-blue-700' },
  { id: 'previous_conversation', label: 'Previous Conversation', color: 'bg-purple-100 text-purple-700' },
  { id: 'dqd', label: "DQ'D", color: 'bg-red-100 text-red-700' },
  { id: 'cold', label: 'Cold', color: 'bg-gray-100 text-gray-700' }
];

export const PRIORITY_OPTIONS = [
  { id: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
  { id: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'low', label: 'Low', color: 'bg-blue-100 text-blue-700' }
];

export const PMS_OPTIONS = [
  'Yardi',
  'Entrata',
  'MRI',
  'RealPage Commercial',
  'AppFolio',
  'Other'
];

export const ACCOUNTING_OPTIONS = [
  'Yardi',
  'NetSuite',
  'Sage',
  'Oracle',
  'QuickBooks',
  'Other'
];

export const PROJECT_MGMT_OPTIONS = [
  'Yardi CM',
  'Ebuilder',
  'Procore',
  'Monday.com',
  'Asana',
  'Smartsheet',
  'Jira',
  'Kahua',
  'Nexus',
  'Other'
];

export const CONTACT_CLASSIFICATION = [
  { id: 'ATL', label: 'Above The Line (ATL)', color: 'bg-green-100 text-green-700' },
  { id: 'BTL', label: 'Below The Line (BTL)', color: 'bg-blue-100 text-blue-700' },
  { id: 'POTENTIAL_CHAMPION', label: 'Potential Champion', color: 'bg-purple-100 text-purple-700' }
];

export const CONTACT_DEPARTMENTS = [
  'Accounting/Finance',
  'Acquisitions',
  'Asset Management',
  'C-suite',
  'Construction',
  'Development'
];

export const CONTACT_STATUS = [
  { id: 'cold', label: 'Cold', color: 'bg-gray-100 text-gray-700' },
  { id: 'targeting', label: 'Targeting', color: 'bg-blue-100 text-blue-700' },
  { id: 'connected_no_interest', label: 'Connected - No Interest', color: 'bg-red-100 text-red-700' },
  { id: 'connected_follow_up', label: 'Connected - Follow Up', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'connected_re_engage', label: 'Connected - Re-engage', color: 'bg-orange-100 text-orange-700' },
  { id: 'dqd', label: "DQ'd", color: 'bg-red-100 text-red-700' }
];

export const NOTE_TYPES = [
  'Tool Discovery',
  'Pain Point',
  'Process',
  'Org Structure',
  'Decision Maker',
  'Budget',
  'Timeline',
  'Competitor',
  'General'
];
