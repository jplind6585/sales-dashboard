import { useState } from 'react';
import {
  X,
  Building2,
  MapPin,
  ExternalLink,
  Users,
  Phone,
  Mail,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  FileText,
  TrendingUp
} from 'lucide-react';
import {
  updateCompany,
  addContact,
  updateContact,
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
  OWN_MANAGE_OPTIONS
} from '../../lib/outboundConstants';

export default function CompanyDetailModal({ company, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    linkedin: '',
    classification: 'BTL',
    status: 'not_contacted',
    notes: ''
  });

  // Note form state
  const [noteForm, setNoteForm] = useState({
    type: 'General',
    content: ''
  });

  const handleAddContact = () => {
    const newContact = addContact(company.id, contactForm);
    if (newContact) {
      // Recalculate percent prospected
      const updatedCompany = {
        ...company,
        contacts: [...(company.contacts || []), newContact],
        percentProspected: calculatePercentProspected({
          ...company,
          contacts: [...(company.contacts || []), newContact]
        })
      };
      updateCompany(company.id, { percentProspected: updatedCompany.percentProspected });
      onUpdate();
      setShowAddContact(false);
      setContactForm({
        name: '',
        title: '',
        email: '',
        phone: '',
        linkedin: '',
        classification: 'BTL',
        status: 'not_contacted',
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
      // Recalculate percent prospected
      const updatedCompany = {
        ...company,
        notes: [...(company.notes || []), newNote],
        percentProspected: calculatePercentProspected({
          ...company,
          notes: [...(company.notes || []), newNote]
        })
      };
      updateCompany(company.id, { percentProspected: updatedCompany.percentProspected });
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

  const handleUpdateTools = (field, value) => {
    const updated = updateCompany(company.id, {
      tools: {
        ...company.tools,
        [field]: value
      },
      percentProspected: calculatePercentProspected({
        ...company,
        tools: {
          ...company.tools,
          [field]: value
        }
      })
    });
    if (updated) onUpdate();
  };

  const atlContacts = company.contacts?.filter(c => c.classification === 'ATL') || [];
  const btlContacts = company.contacts?.filter(c => c.classification === 'BTL') || [];

  const getVerticalName = (id) => VERTICALS.find(v => v.id === id)?.name || id;
  const getStatusLabel = (id) => STATUS_OPTIONS.find(s => s.id === id)?.label || id;
  const getStatusColor = (id) => STATUS_OPTIONS.find(s => s.id === id)?.color || 'bg-gray-100 text-gray-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
            {['overview', 'contacts', 'notes', 'activity'].map(tab => (
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
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
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
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="text-gray-600 text-xs">PMS:</label>
                      <select
                        value={company.tools?.pms || ''}
                        onChange={(e) => handleUpdateTools('pms', e.target.value)}
                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                      >
                        <option value="">Not Set</option>
                        {PMS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs">Accounting:</label>
                      <select
                        value={company.tools?.accounting || ''}
                        onChange={(e) => handleUpdateTools('accounting', e.target.value)}
                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                      >
                        <option value="">Not Set</option>
                        {ACCOUNTING_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs">Project Management:</label>
                      <select
                        value={company.tools?.projectMgmt || ''}
                        onChange={(e) => handleUpdateTools('projectMgmt', e.target.value)}
                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                      >
                        <option value="">Not Set</option>
                        {PROJECT_MGMT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Contacts ({company.contacts?.length || 0})</h3>
                <button
                  onClick={() => setShowAddContact(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              </div>

              {/* ATL Contacts */}
              {atlContacts.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Above The Line ({atlContacts.length})</h4>
                  <div className="space-y-2">
                    {atlContacts.map(contact => (
                      <div key={contact.id} className="p-3 border rounded bg-green-50 border-green-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{contact.name}</div>
                            <div className="text-sm text-gray-600">{contact.title || 'No title'}</div>
                            <div className="flex gap-3 mt-1 text-xs text-gray-600">
                              {contact.email && <span>{contact.email}</span>}
                              {contact.phone && <span>{contact.phone}</span>}
                            </div>
                            {contact.notes && (
                              <div className="text-xs text-gray-600 mt-1">{contact.notes}</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BTL Contacts */}
              {btlContacts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Below The Line ({btlContacts.length})</h4>
                  <div className="space-y-2">
                    {btlContacts.map(contact => (
                      <div key={contact.id} className="p-3 border rounded bg-blue-50 border-blue-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{contact.name}</div>
                            <div className="text-sm text-gray-600">{contact.title || 'No title'}</div>
                            <div className="flex gap-3 mt-1 text-xs text-gray-600">
                              {contact.email && <span>{contact.email}</span>}
                              {contact.phone && <span>{contact.phone}</span>}
                            </div>
                            {contact.notes && (
                              <div className="text-xs text-gray-600 mt-1">{contact.notes}</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {company.contacts?.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No contacts yet. Add your first contact to get started.</p>
                </div>
              )}

              {/* Add Contact Form */}
              {showAddContact && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full">
                    <h3 className="font-semibold text-lg mb-4">Add Contact</h3>
                    <div className="space-y-3">
                      <div>
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
                        <label className="text-sm font-medium">Classification</label>
                        <select
                          value={contactForm.classification}
                          onChange={(e) => setContactForm({...contactForm, classification: e.target.value})}
                          className="w-full mt-1 px-3 py-2 border rounded"
                        >
                          <option value="ATL">Above The Line (ATL)</option>
                          <option value="BTL">Below The Line (BTL)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Email</label>
                        <input
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                          className="w-full mt-1 px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Phone</label>
                        <input
                          type="tel"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({...contactForm, phone: e.target.value})}
                          className="w-full mt-1 px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
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
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div>
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

              {/* Add Note Form */}
              {showAddNote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
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
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
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
    </div>
  );
}
