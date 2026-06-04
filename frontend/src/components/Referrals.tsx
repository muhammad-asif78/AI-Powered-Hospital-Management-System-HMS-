// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Search, 
  FileSymlink, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Layers, 
  User, 
  Sparkles, 
  Building,
  UserCheck
} from 'lucide-react';

export default function ReferralsPage() {
  const [tab, setTab] = useState('inbound');
  const [inbound, setInbound] = useState([]);
  const [outbound, setOutbound] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showOutboundModal, setShowOutboundModal] = useState(false);

  // Form states
  const [inboundForm, setInboundForm] = useState({
    referring_provider_name: '',
    referral_date: new Date().toISOString().split('T')[0],
    reason: '',
    clinical_notes: '',
    raw_document_text: '',
  });

  const [outboundForm, setOutboundForm] = useState({
    patient_id: '',
    referring_doctor_id: '',
    referred_to_provider: '',
    referred_to_facility: '',
    referred_to_specialty: '',
    referral_date: new Date().toISOString().split('T')[0],
    reason: '',
    clinical_summary: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getInboundReferrals(), 
      api.getOutboundReferrals(),
      api.getPatients(),
      api.getDoctors()
    ])
      .then(([ib, ob, pts, docs]) => { 
        setInbound(ib || []); 
        setOutbound(ob || []); 
        setPatients(pts || []);
        setDoctors(docs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreateInbound = async (e) => {
    e.preventDefault();
    try {
      await api.createInboundReferral(inboundForm);
      setShowInboundModal(false);
      setInboundForm({ 
        referring_provider_name: '', 
        referral_date: new Date().toISOString().split('T')[0], 
        reason: '', 
        clinical_notes: '', 
        raw_document_text: '' 
      });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleCreateOutbound = async (e) => {
    e.preventDefault();
    if (!outboundForm.patient_id || !outboundForm.referring_doctor_id) {
      alert("Please select both a patient and a referring doctor.");
      return;
    }
    try {
      await api.createOutboundReferral({
        ...outboundForm,
        patient_id: parseInt(outboundForm.patient_id),
        referring_doctor_id: parseInt(outboundForm.referring_doctor_id),
      });
      setShowOutboundModal(false);
      setOutboundForm({
        patient_id: '',
        referring_doctor_id: '',
        referred_to_provider: '',
        referred_to_facility: '',
        referred_to_specialty: '',
        referral_date: new Date().toISOString().split('T')[0],
        reason: '',
        clinical_summary: '',
      });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleParse = async (id) => {
    try {
      await api.parseInboundReferral(id);
      load();
    } catch (err) { alert(err.message); }
  };

  const handleVerify = async (id) => {
    try {
      await api.verifyOutboundReferral(id);
      load();
    } catch (err) { alert(err.message); }
  };

  // Filter logic
  const filteredInbound = inbound.filter(r => 
    (r.referring_provider_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.status || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOutbound = outbound.filter(r => 
    (r.referred_to_provider || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.referred_to_facility || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.referred_to_specialty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.reason || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: <Clock size={12} /> },
      approved: { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: <CheckCircle size={12} /> },
      verified: { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: <CheckCircle size={12} /> },
      denied: { bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: <AlertCircle size={12} /> },
      draft: { bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: <Clock size={12} /> }
    };
    const s = config[status?.toLowerCase()] || { bg: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: null };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${s.bg}`}>
        {s.icon} {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in p-8">
      {/* Head */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 flex items-center gap-3">
            <FileSymlink className="text-blue-500" size={32} /> Clinical Referrals
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage, verify, and parse inbound and outbound clinical transfers</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-lg shadow-blue-600/10"
            onClick={() => setShowInboundModal(true)}>
            <Plus size={16} /> Register Inbound
          </button>
          <button className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-lg shadow-violet-600/10"
            onClick={() => setShowOutboundModal(true)}>
            <Plus size={16} /> Register Outbound
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-3xl shadow-sm">
        <div className="flex items-center gap-2 p-[3px] bg-gray-100 rounded-2xl border border-gray-200 w-fit">
          <button 
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${tab === 'inbound' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setTab('inbound'); setSearchQuery(''); }}
          >
            📨 Inbound ({inbound.length})
          </button>
          <button 
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${tab === 'outbound' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setTab('outbound'); setSearchQuery(''); }}
          >
            📤 Outbound ({outbound.length})
          </button>
        </div>

        {/* Local Search bar */}
        <div className="relative w-full lg:max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder={`Filter ${tab === 'inbound' ? 'inbound provider or reason' : 'outbound provider, specialty, or reason'}...`}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-xs text-gray-800 focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Retrieving clinical database...</p>
          </div>
        ) : tab === 'inbound' ? (
          filteredInbound.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                <FileSymlink size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">No Inbound Referrals</h3>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">There are no incoming patients matching your query. Click "Register Inbound" to log a new clinical transfer.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Referring Provider</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Referral Date</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Reason / Justification</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">AI Extraction</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInbound.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600">
                            <Building size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900">{r.referring_provider_name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">ID: REF-IN-{r.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-xs text-gray-600 font-bold">{r.referral_date}</td>
                      <td className="px-6 py-5">
                        <p className="text-xs text-gray-700 font-medium max-w-sm truncate" title={r.reason}>{r.reason}</p>
                      </td>
                      <td className="px-6 py-5">{getStatusBadge(r.status)}</td>
                      <td className="px-6 py-5">
                        {r.ai_extracted_data ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border border-emerald-200 bg-emerald-50 text-emerald-600 uppercase tracking-wider">
                            <Sparkles size={10} /> Parsed
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs font-bold">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {r.raw_document_text && !r.ai_extracted_data ? (
                          <button 
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all"
                            onClick={() => handleParse(r.id)}
                          >
                            <Sparkles size={14} /> AI Parse
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs font-bold">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredOutbound.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-500">
                <FileSymlink size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">No Outbound Referrals</h3>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">No outbound patient transfers match your query. Click "Register Outbound" to transfer a patient.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Referred Provider / Facility</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Specialty</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Referral Date</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Payer Coverage</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOutbound.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600">
                            <Building size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900">{r.referred_to_provider}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{r.referred_to_facility || 'Primary Facility'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-100 text-violet-700 border border-violet-200">
                          {r.referred_to_specialty}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs text-gray-600 font-bold">{r.referral_date}</td>
                      <td className="px-6 py-5">
                        {r.insurance_accepted === null ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            Pending check
                          </span>
                        ) : r.insurance_accepted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            ✓ In-Network
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            ✗ Out-of-Network
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">{getStatusBadge(r.status)}</td>
                      <td className="px-6 py-5 text-right">
                        {r.status === 'draft' ? (
                          <button 
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider transition-all"
                            onClick={() => handleVerify(r.id)}
                          >
                            <UserCheck size={14} /> Verify Coverage
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs font-bold">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ──────────────── Inbound Modal Popup ──────────────── */}
      {showInboundModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setShowInboundModal(false)}>
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Register Inbound Referral</h2>
                <p className="text-gray-500 text-xs mt-1">Log patients referred from external clinical clinics</p>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 flex items-center justify-center text-lg font-bold transition-all"
                onClick={() => setShowInboundModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateInbound} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referring Provider Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
                    placeholder="Dr. John Doe, Cardiology"
                    value={inboundForm.referring_provider_name}
                    onChange={(e) => setInboundForm({ ...inboundForm, referring_provider_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referral Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all"
                    value={inboundForm.referral_date}
                    onChange={(e) => setInboundForm({ ...inboundForm, referral_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Reason for Referral</label>
                <textarea 
                  required
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
                  placeholder="Clinical symptoms, diagnosis codes, or transfer reason..."
                  value={inboundForm.reason}
                  onChange={(e) => setInboundForm({ ...inboundForm, reason: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Clinical Notes</label>
                <textarea 
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
                  placeholder="Extra clinical observations or secondary notes..."
                  value={inboundForm.clinical_notes}
                  onChange={(e) => setInboundForm({ ...inboundForm, clinical_notes: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" /> Raw Document Text (Optional for AI Parsing)
                </label>
                <textarea 
                  rows={3}
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
                  placeholder="Paste raw referral fax or clinical document text. Groq LLM will automatically parse patients details and insurance information..."
                  value={inboundForm.raw_document_text}
                  onChange={(e) => setInboundForm({ ...inboundForm, raw_document_text: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  className="flex-1 px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider transition-all"
                  onClick={() => setShowInboundModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Create Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── Outbound Modal Popup ──────────────── */}
      {showOutboundModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setShowOutboundModal(false)}>
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Register Outbound Referral</h2>
                <p className="text-gray-500 text-xs mt-1">Submit outbound transfers to external specialty partners</p>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 flex items-center justify-center text-lg font-bold transition-all"
                onClick={() => setShowOutboundModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateOutbound} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Patient Selection</label>
                  <select 
                    required 
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all"
                    value={outboundForm.patient_id}
                    onChange={(e) => setOutboundForm({ ...outboundForm, patient_id: e.target.value })}
                  >
                    <option value="">Select Patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (MRN: {p.medical_record_number})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referring Internist / Doctor</label>
                  <select 
                    required 
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all"
                    value={outboundForm.referring_doctor_id}
                    onChange={(e) => setOutboundForm({ ...outboundForm, referring_doctor_id: e.target.value })}
                  >
                    <option value="">Select Referring Doctor</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} ({d.specialty})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referred-To Provider Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all placeholder:text-gray-400"
                    placeholder="Dr. Sarah Jenkins"
                    value={outboundForm.referred_to_provider}
                    onChange={(e) => setOutboundForm({ ...outboundForm, referred_to_provider: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referred-To Specialty</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all placeholder:text-gray-400"
                    placeholder="Orthopedic Surgery"
                    value={outboundForm.referred_to_specialty}
                    onChange={(e) => setOutboundForm({ ...outboundForm, referred_to_specialty: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referred-To Facility</label>
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all placeholder:text-gray-400"
                    placeholder="Mercy General Hospital"
                    value={outboundForm.referred_to_facility}
                    onChange={(e) => setOutboundForm({ ...outboundForm, referred_to_facility: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Referral Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all"
                    value={outboundForm.referral_date}
                    onChange={(e) => setOutboundForm({ ...outboundForm, referral_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Reason for Referral</label>
                <textarea 
                  required
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all placeholder:text-gray-400"
                  placeholder="Describe medical reasons, patient request details, or symptoms..."
                  value={outboundForm.reason}
                  onChange={(e) => setOutboundForm({ ...outboundForm, reason: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Clinical Summary</label>
                <textarea 
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-violet-500 transition-all placeholder:text-gray-400"
                  placeholder="Summary of diagnostics, past interventions, or patient charts..."
                  value={outboundForm.clinical_summary}
                  onChange={(e) => setOutboundForm({ ...outboundForm, clinical_summary: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  className="flex-1 px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider transition-all"
                  onClick={() => setShowOutboundModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Create Outbound Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
