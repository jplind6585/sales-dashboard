import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Building2,
  Users,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import UserMenu from '../../components/auth/UserMenu';
import CompanyDetailModal from '../../components/outbound/CompanyDetailModalV2';
import { getCompanies, calculatePercentProspected } from '../../lib/outboundStorage';
import { VERTICALS, STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../lib/outboundConstants';
import { seedSampleData } from '../../lib/seedOutboundData';

export default function OutboundEngine() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVertical, setFilterVertical] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // name, prospected, contacts, lastContacted
  const [showFilters, setShowFilters] = useState(false);

  // Load companies on mount
  useEffect(() => {
    seedSampleData(); // Seed sample data if empty
    loadCompanies();
  }, []);

  // Filter and sort companies when filters change
  useEffect(() => {
    let filtered = [...companies];

    // Search
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.state?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Vertical filter
    if (filterVertical !== 'all') {
      filtered = filtered.filter(c => c.vertical === filterVertical);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => c.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'prospected':
          return (b.percentProspected || 0) - (a.percentProspected || 0);
        case 'contacts':
          return (b.contacts?.length || 0) - (a.contacts?.length || 0);
        case 'lastContacted':
          if (!a.lastContacted) return 1;
          if (!b.lastContacted) return -1;
          return new Date(b.lastContacted) - new Date(a.lastContacted);
        case 'properties':
          return (b.properties || 0) - (a.properties || 0);
        case 'units':
          return (b.unitsOrSqft || 0) - (a.unitsOrSqft || 0);
        default:
          return 0;
      }
    });

    setFilteredCompanies(filtered);
  }, [companies, searchTerm, filterVertical, filterStatus, sortBy]);

  const loadCompanies = () => {
    const loaded = getCompanies();
    // Calculate percent prospected for each company
    const withScores = loaded.map(c => ({
      ...c,
      percentProspected: calculatePercentProspected(c)
    }));
    setCompanies(withScores);
  };

  const getStatusColor = (statusId) => {
    return STATUS_OPTIONS.find(s => s.id === statusId)?.color || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (statusId) => {
    return STATUS_OPTIONS.find(s => s.id === statusId)?.label || statusId;
  };

  const getVerticalName = (verticalId) => {
    return VERTICALS.find(v => v.id === verticalId)?.name || verticalId;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/modules')}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold">Outbound Engine</h1>
                <p className="text-sm text-gray-600">
                  {filteredCompanies.length} companies • {filteredCompanies.filter(c => c.percentProspected >= 70).length} ready for outreach
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {/* TODO: Open new company modal */}}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Company
              </button>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-6 py-4">
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow px-4 py-3 mb-4">
          <div className="flex gap-3 items-center flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Vertical Filter */}
            <select
              value={filterVertical}
              onChange={(e) => setFilterVertical(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Verticals</option>
              {VERTICALS.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Company Table */}
        {filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterVertical !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first prospect company'}
            </p>
            <button
              onClick={() => {/* TODO: Open new company modal */}}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Company
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => setSortBy('name')}>
                      Company {sortBy === 'name' && '↕'}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Location
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Vertical
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Status
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => setSortBy('properties')}>
                      Props {sortBy === 'properties' && '↕'}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => setSortBy('units')}>
                      Units/SQFT {sortBy === 'units' && '↕'}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => setSortBy('prospected')}>
                      % Prosp {sortBy === 'prospected' && '↕'}
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => setSortBy('contacts')}>
                      Contacts {sortBy === 'contacts' && '↕'}
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">
                      ATL
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">
                      BTL
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">
                      Calls
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">
                      Emails
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => setSortBy('lastContacted')}>
                      Last Contact {sortBy === 'lastContacted' && '↕'}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">
                      Tools
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company, idx) => {
                    const atlCount = company.contacts?.filter(c => c.classification === 'ATL').length || 0;
                    const btlCount = company.contacts?.filter(c => c.classification === 'BTL').length || 0;
                    const totalContacts = company.contacts?.length || 0;
                    const hasTools = Object.values(company.tools || {}).filter(t => t).length > 0;

                    return (
                      <tr
                        key={company.id}
                        onClick={() => setSelectedCompany(company)}
                        className={`border-b hover:bg-blue-50 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[200px]" title={company.name}>{company.name}</span>
                            {company.url && (
                              <a
                                href={company.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {company.city && company.state ? `${company.city}, ${company.state}` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {company.vertical ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {getVerticalName(company.vertical)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(company.status)}`}>
                            {getStatusLabel(company.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {company.properties ? company.properties.toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {company.unitsOrSqft ? company.unitsOrSqft.toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`font-semibold ${
                              company.percentProspected >= 70 ? 'text-green-600' :
                              company.percentProspected >= 40 ? 'text-yellow-600' :
                              'text-gray-600'
                            }`}>
                              {company.percentProspected || 0}%
                            </span>
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  company.percentProspected >= 70 ? 'bg-green-600' :
                                  company.percentProspected >= 40 ? 'bg-yellow-600' :
                                  'bg-blue-600'
                                }`}
                                style={{ width: `${company.percentProspected || 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-medium text-gray-900">
                          {totalContacts || 0}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={atlCount > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                            {atlCount}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={btlCount > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                            {btlCount}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">
                          {company.activity?.calls || 0}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-700">
                          {company.activity?.emails || 0}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">
                          {company.lastContacted ? new Date(company.lastContacted).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {hasTools ? (
                            <div className="flex gap-1">
                              {company.tools.pms && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs" title={`PMS: ${company.tools.pms}`}>
                                  P
                                </span>
                              )}
                              {company.tools.accounting && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs" title={`Accounting: ${company.tools.accounting}`}>
                                  A
                                </span>
                              )}
                              {company.tools.projectMgmt && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs" title={`PM: ${company.tools.projectMgmt}`}>
                                  PM
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onUpdate={() => {
            loadCompanies();
            // Reload the selected company with updated data
            const updated = getCompanies().find(c => c.id === selectedCompany.id);
            if (updated) {
              setSelectedCompany({
                ...updated,
                percentProspected: calculatePercentProspected(updated)
              });
            }
          }}
        />
      )}
    </div>
  );
}
