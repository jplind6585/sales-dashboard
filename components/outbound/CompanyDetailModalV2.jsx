import { useState, useMemo } from 'react';
import {
  X,
  MapPin,
  ExternalLink,
  Users,
  Phone,
  Mail,
  Plus,
  Trash2,
  Calendar,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import {
  updateCompany,
  addContact,
  deleteContact,
  addNote,
  deleteNote,
  calculatePercentProspected
} from '../../lib/outboundStorage';
import {
  VERTICALS,
  STATUS_OPTIONS,
  PMS_OPTIONS,
  ACCOUNTING_OPTIONS,
  PROJECT_MGMT_OPTIONS,
  NOTE_TYPES,
  CONTACT_CLASSIFICATION,
  CONTACT_DEPARTMENTS,
  CONTACT_STATUS
} from '../../lib/outboundConstants';

export default function CompanyDetailModal({ company, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('contacts');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Contact filters and sorting
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilterClassification, setContactFilterClassification] = useState('all');
  const [contactFilterDepartment, setContactFilterDepartment] = useState('all');
  const [contactFilterStatus, setContactFilterStatus] = useState('all');
  const [contactSortBy, setContactSortBy] = useState('name');

  // Tools state (multiple select)
  const [selectedPMS, setSelectedPMS] = useState(company.tools?.pms ? [company.tools.pms] : []);
  const [selectedAccounting, setSelectedAccounting] = useState(company.tools?.accounting ? [company.tools.accounting] : []);
  const [selectedPM, setSelectedPM] = useState(company.tools?.projectMgmt ? [company.tools.projectMgmt] : []);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    title: '',
    department: '',
    email: '',
    companyLine: '',
    directLine: '',
    mobileLine: '',
    linkedin: '',
    classification: 'BTL',
    status: 'cold',
    notes: ''
  });

  // Note form state
  const [noteForm, setNoteForm] = useState({
    type: 'General',
    content: ''
  });

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let filtered = [...(company.contacts || [])];

    // Search
    if (contactSearch) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.title?.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(contactSearch.toLowerCase())
      );
    }

    // Classification filter
    if (contactFilterClassification !== 'all') {
      filtered = filtered.filter(c => c.classification === contactFilterClassification);
    }

    // Department filter
    if (contactFilterDepartment !== 'all') {
      filtered = filtered.filter(c => c.department === contactFilterDepartment);
    }

    // Status filter
    if (contactFilterStatus !== 'all') {
      filtered = filtered.filter(c => c.status === contactFilterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (contactSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'timesCalled':
          return (b.timesCalled || 0) - (a.timesCalled || 0);
        case 'timesEmailed':
          return (b.timesEmailed || 0) - (a.timesEmailed || 0);
        case 'lastCall':
          if (!a.lastCall) return 1;
          if (!b.lastCall) return -1;
          return new Date(b.lastCall) - new Date(a.lastCall);
        case 'lastEmail':
          if (!a.lastEmail) return 1;
          if (!b.lastEmail) return -1;
          return new Date(b.lastEmail) - new Date(a.lastEmail);
        default:
          return 0;
      }
    });

    return filtered;
  }, [company.contacts, contactSearch, contactFilterClassification, contactFilterDepartment, contactFilterStatus, contactSortBy]);

  const handleAddContact = () => {
    const newContact = addContact(company.id, contactForm);
    if (newContact) {
      onUpdate();
      setShowAddContact(false);
      setContactForm({
        name: '',
        title: '',
        department: '',
        email: '',
        companyLine: '',
        directLine: '',
        mobileLine: '',
        linkedin: '',
        classification: 'BTL',
        status: 'cold',
        notes: ''
      });
    }
  };

  const handleDeleteContact = (contactId) => {
    if (confirm('Delete this contact?')) {
      deleteContact(company.id, contactId);
      onUpdate();
    }
  };

  const handleAddNote = () => {
    const newNote = addNote(company.id, noteForm);
    if (newNote) {
      onUpdate();
      setShowAddNote(false);
      setNoteForm({ type: 'General', content: '' });
    }
  };

  const handleDeleteNote = (noteId) => {
    if (confirm('Delete this note?')) {
      deleteNote(company.id, noteId);
      onUpdate();
    }
  };

  const handleUpdateActivity = (field, value) => {
    const updated = updateCompany(company.id, {
      activity: {
        ...company.activity,
        [field]: value
      }
    });
    if (updated) onUpdate();
  };

  const handleUpdateTools = () => {
    const updated = updateCompany(company.id, {
      tools: {
        pms: selectedPMS.join(', ') || null,
        accounting: selectedAccounting.join(', ') || null,
        projectMgmt: selectedPM.join(', ') || null
      }
    });
    if (updated) onUpdate();
  };

  const getClassificationColor = (id) => {
    return CONTACT_CLASSIFICATION.find(c => c.id === id)?.color || 'bg-gray-100 text-gray-700';
  };

  const getClassificationLabel = (id) => {
    return CONTACT_CLASSIFICATION.find(c => c.id === id)?.label || id;
  };

  const getContactStatusColor = (id) => {
    return CONTACT_STATUS.find(s => s.id === id)?.color || 'bg-gray-100 text-gray-700';
  };

  const getContactStatusLabel = (id) => {
    return CONTACT_STATUS.find(s => s.id === id)?.label || id;
  };

  const getVerticalName = (id) => VERTICALS.find(v => v.id === id)?.name || id;
  const getStatusLabel = (id) => STATUS_OPTIONS.find(s => s.id === id)?.label || id;
  const getStatusColor = (id) => STATUS_OPTIONS.find(s => s.id === id)?.color || 'bg-gray-100 text-gray-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-start bg-gray-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold">{company.name}</h2>
              <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(company.status)}`}>
                {getStatusLabel(company.status)}
              </span>
              {company.vertical && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                  {getVerticalName(company.vertical)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {company.city && company.state && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {company.city}, {company.state}
                </span>
              )}
              {company.url && (
                <a
                  href={company.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit Website
                </a>
              )}
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{company.percentProspected || 0}%</div>
              <div className="text-xs text-gray-500">Prospected</div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b bg-white">
          <div className="flex gap-6 px-6">
            {['contacts', 'notes', 'overview', 'activity'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-2 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
                {tab === 'contacts' && ` (${company.contacts?.length || 0})`}
                {tab === 'notes' && ` (${company.notes?.length || 0})`}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Contacts ({filteredContacts.length} shown)</h3>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              </div>

              {/* Filters */}
              <div className="mb-4 flex gap-3 items-center flex-wrap bg-gray-50 p-3 rounded">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border rounded"
                    />
                  </div>
                </div>
                <select
                  value={contactFilterClassification}
                  onChange={(e) => setContactFilterClassification(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded"
                >
                  <option value="all">All Classifications</option>
                  {CONTACT_CLASSIFICATION.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <select
                  value={contactFilterDepartment}
                  onChange={(e) => setContactFilterDepartment(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded"
                >
                  <option value="all">All Departments</option>
                  {CONTACT_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={contactFilterStatus}
                  onChange={(e) => setContactFilterStatus(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded"
                >
                  <option value="all">All Status</option>
                  {CONTACT_STATUS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={contactSortBy}
                  onChange={(e) => setContactSortBy(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded"
                >
                  <option value="name">Name</option>
                  <option value="timesCalled">Times Called</option>
                  <option value="timesEmailed">Times Emailed</option>
                  <option value="lastCall">Last Call</option>
                  <option value="lastEmail">Last Email</option>
                </select>
              </div>

              {/* Contacts Table */}
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No contacts match your filters.</p>
                </div>
              ) : (
                <div className="border rounded overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Title</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Department</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Classification</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Phone</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">Calls</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">Emails</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Last Call</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Last Email</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts.map((contact, idx) => (
                          <tr key={contact.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 font-medium">
                              <div>
                                {contact.name}
                                {contact.linkedin && (
                                  <a
                                    href={contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-blue-600 text-xs"
                                  >
                                    in
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{contact.title || '-'}</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{contact.department || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getClassificationColor(contact.classification)}`}>
                                {contact.classification}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getContactStatusColor(contact.status)}`}>
                                {getContactStatusLabel(contact.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">{contact.email || '-'}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              <div className="space-y-0.5">
                                {contact.companyLine && <div title="Company">{contact.companyLine}</div>}
                                {contact.directLine && <div title="Direct" className="text-green-600">{contact.directLine}</div>}
                                {contact.mobileLine && <div title="Mobile" className="text-blue-600">{contact.mobileLine}</div>}
                                {!contact.companyLine && !contact.directLine && !contact.mobileLine && '-'}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700">{contact.timesCalled || 0}</td>
                            <td className="px-3 py-2 text-center text-gray-700">{contact.timesEmailed || 0}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {contact.lastCall ? new Date(contact.lastCall).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {contact.lastEmail ? new Date(contact.lastEmail).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleDeleteContact(contact.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Add Contact Modal - Rendered at end of file for space */}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Notes ({company.notes?.length || 0})</h3>
                <button
                  onClick={() => setShowAddNote(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </div>

              <div className="space-y-3">
                {company.notes?.map(note => (
                  <div key={note.id} className="p-4 border rounded bg-yellow-50 border-yellow-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs font-medium">
                          {note.type}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>

              {company.notes?.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No notes yet. Add notes to track insights and conversations.</p>
                </div>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Company Info</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Properties:</dt>
                      <dd className="font-medium">{company.properties?.toLocaleString() || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Units/SQFT:</dt>
                      <dd className="font-medium">{company.unitsOrSqft?.toLocaleString() || '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Annual Spend:</dt>
                      <dd className="font-medium">{company.annualSpend ? `$${company.annualSpend.toLocaleString()}` : '-'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Own/Manage:</dt>
                      <dd className="font-medium">{company.ownManage || '-'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Tools Used</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="text-gray-600 text-xs font-medium">PMS (multiple):</label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {PMS_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            onClick={() => {
                              if (selectedPMS.includes(opt)) {
                                setSelectedPMS(selectedPMS.filter(p => p !== opt));
                              } else {
                                setSelectedPMS([...selectedPMS, opt]);
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded border ${
                              selectedPMS.includes(opt)
                                ? 'bg-purple-100 text-purple-700 border-purple-300'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-medium">Accounting (multiple):</label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ACCOUNTING_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            onClick={() => {
                              if (selectedAccounting.includes(opt)) {
                                setSelectedAccounting(selectedAccounting.filter(a => a !== opt));
                              } else {
                                setSelectedAccounting([...selectedAccounting, opt]);
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded border ${
                              selectedAccounting.includes(opt)
                                ? 'bg-green-100 text-green-700 border-green-300'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs font-medium">Project Management (multiple):</label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {PROJECT_MGMT_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            onClick={() => {
                              if (selectedPM.includes(opt)) {
                                setSelectedPM(selectedPM.filter(p => p !== opt));
                              } else {
                                setSelectedPM([...selectedPM, opt]);
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded border ${
                              selectedPM.includes(opt)
                                ? 'bg-orange-100 text-orange-700 border-orange-300'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleUpdateTools}
                      className="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Save Tools
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="p-6">
              <h3 className="font-semibold mb-4">Activity Tracking</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                  <label className="text-sm font-medium text-gray-600">Calls Made</label>
                  <input
                    type="number"
                    value={company.activity?.calls || 0}
                    onChange={(e) => handleUpdateActivity('calls', parseInt(e.target.value) || 0)}
                    className="w-full mt-2 px-3 py-2 border rounded text-lg font-semibold"
                    min="0"
                  />
                </div>
                <div className="p-4 border rounded">
                  <label className="text-sm font-medium text-gray-600">Emails Sent</label>
                  <input
                    type="number"
                    value={company.activity?.emails || 0}
                    onChange={(e) => handleUpdateActivity('emails', parseInt(e.target.value) || 0)}
                    className="w-full mt-2 px-3 py-2 border rounded text-lg font-semibold"
                    min="0"
                  />
                </div>
                <div className="p-4 border rounded">
                  <label className="text-sm font-medium text-gray-600">Sequences</label>
                  <input
                    type="number"
                    value={company.activity?.sequences || 0}
                    onChange={(e) => handleUpdateActivity('sequences', parseInt(e.target.value) || 0)}
                    className="w-full mt-2 px-3 py-2 border rounded text-lg font-semibold"
                    min="0"
                  />
                </div>
                <div className="p-4 border rounded">
                  <label className="text-sm font-medium text-gray-600">HeyReach Touches</label>
                  <input
                    type="number"
                    value={company.activity?.heyReach || 0}
                    onChange={(e) => handleUpdateActivity('heyReach', parseInt(e.target.value) || 0)}
                    className="w-full mt-2 px-3 py-2 border rounded text-lg font-semibold"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">Add Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium">Name *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Title</label>
                <input
                  type="text"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({...contactForm, title: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <select
                  value={contactForm.department}
                  onChange={(e) => setContactForm({...contactForm, department: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                >
                  <option value="">Select Department</option>
                  {CONTACT_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Classification</label>
                <select
                  value={contactForm.classification}
                  onChange={(e) => setContactForm({...contactForm, classification: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                >
                  {CONTACT_CLASSIFICATION.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={contactForm.status}
                  onChange={(e) => setContactForm({...contactForm, status: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                >
                  {CONTACT_STATUS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Company Line</label>
                <input
                  type="tel"
                  value={contactForm.companyLine}
                  onChange={(e) => setContactForm({...contactForm, companyLine: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Direct Line</label>
                <input
                  type="tel"
                  value={contactForm.directLine}
                  onChange={(e) => setContactForm({...contactForm, directLine: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Mobile Line</label>
                <input
                  type="tel"
                  value={contactForm.mobileLine}
                  onChange={(e) => setContactForm({...contactForm, mobileLine: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">LinkedIn Profile</label>
                <input
                  type="text"
                  value={contactForm.linkedin}
                  onChange={(e) => setContactForm({...contactForm, linkedin: e.target.value})}
                  placeholder="linkedin.com/in/username"
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({...contactForm, notes: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddContact(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={!contactForm.name}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold text-lg mb-4">Add Note</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={noteForm.type}
                  onChange={(e) => setNoteForm({...noteForm, type: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                >
                  {NOTE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Content *</label>
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({...noteForm, content: e.target.value})}
                  className="w-full mt-1 px-3 py-2 border rounded"
                  rows={4}
                  placeholder="Enter your note..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddNote(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteForm.content}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
