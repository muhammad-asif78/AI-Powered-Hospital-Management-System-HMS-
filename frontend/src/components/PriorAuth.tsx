// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Search, 
  ShieldCheck, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Cpu, 
  Sparkles,
  Lock,
  Bookmark
} from 'lucide-react';

export default function PriorAuthPage() {
  const [auths, setAuths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown lists
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [insurances, setInsurances] = useState([]);

  // Form state
  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: '',
    insurance_provider_id: '',
    procedure_code: '',
    procedure_description: '',
    diagnosis_code: '',
    clinical_justification: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getPriorAuths(),
      api.getPatients(),
      api.getDoctors(),
      api.getInsuranceProviders()
    ]).then(([authsData, patientsData, doctorsData, insurancesData]) => {
      setAuths(authsData || []);
      setPatients(patientsData || []);
      setDoctors(doctorsData || []);
      setInsurances(insurancesData || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.patient_id || !form.doctor_id || !form.insurance_provider_id) {
      alert("Please select a patient, doctor, and insurance provider.");
      return;
    }
    try {
      await api.createPriorAuth({
        ...form,
        patient_id: parseInt(form.patient_id),
        doctor_id: parseInt(form.doctor_id),
        insurance_provider_id: parseInt(form.insurance_provider_id),
      });
      setShowModal(false);
      setForm({
        patient_id: '', doctor_id: '', insurance_provider_id: '',
        procedure_code: '', procedure_description: '', diagnosis_code: '',
        clinical_justification: '',
      });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleClassify = async (id) => {
    try { await api.classifyPriorAuth(id); load(); } catch (err) { alert(err.message); }
  };

  const handleSubmit = async (id) => {
    try { await api.submitPriorAuth(id); load(); } catch (err) { alert(err.message); }
  };

  // Filter prior auths
  const filteredAuths = auths.filter(pa => 
    (pa.procedure_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pa.procedure_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pa.diagnosis_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pa.status || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pa.ai_predicted_status || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const config = {
      approved: { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle size={12} /> },
      submitted: { bg: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock size={12} /> },
      draft: { bg: 'bg-gray-100 text-gray-600 border-gray-200', icon: <Clock size={12} /> },
      denied: { bg: 'bg-rose-100 text-rose-700 border-rose-200', icon: <AlertCircle size={12} /> }
    };
    const s = config[status?.toLowerCase()] || { bg: 'bg-gray-100 text-gray-500 border-gray-200', icon: null };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${s.bg}`}>
        {s.icon} {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in p-8">
      {/* Head */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
            <ShieldCheck className="text-emerald-500" size={32} /> Prior Authorization
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage and automate clinical pre-approvals using neural coverage classifiers</p>
        </div>
        <button 
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-lg shadow-emerald-600/10 self-start md:self-auto"
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} /> New Prior Auth
        </button>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-wider text-gray-500 pl-2">
          <Bookmark size={14} className="text-emerald-500" /> Pre-auth Worklist ({filteredAuths.length})
        </div>

        {/* Real-time search bar */}
        <div className="relative w-full md:max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-emerald-500 transition-colors">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search procedure, CPT, ICD-10 or AI prediction..."
            className="w-full bg-white border border-gray-300 rounded-2xl pl-12 pr-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Retrieving clinical database...</p>
          </div>
        ) : filteredAuths.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
              <Lock size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">No Prior Authorizations</h3>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">No active pre-authorization records match your query. Click "New Prior Auth" to start a request.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Procedure / Target</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">CPT Code</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Diagnosis (ICD-10)</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider">AI Approval Forecast</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAuths.map((pa) => (
                  <tr key={pa.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 max-w-xs truncate" title={pa.procedure_description}>
                            {pa.procedure_description}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">ID: PA-REQ-{pa.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <code className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-bold">
                        {pa.procedure_code}
                      </code>
                    </td>
                    <td className="px-6 py-5">
                      <code className="px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200 text-[11px] font-bold">
                        {pa.diagnosis_code}
                      </code>
                    </td>
                    <td className="px-6 py-5">{getStatusBadge(pa.status)}</td>
                    <td className="px-6 py-5">
                      {pa.ai_predicted_status ? (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                          pa.ai_predicted_status.toLowerCase().includes('approved')
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : pa.ai_predicted_status.toLowerCase().includes('denied')
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          <Cpu size={10} /> {pa.ai_predicted_status}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all"
                          onClick={() => handleClassify(pa.id)}
                          title="AI Classify Coverage"
                        >
                          <Sparkles size={14} className="text-emerald-500" /> Forecast
                        </button>
                        {pa.status === 'draft' && (
                          <button 
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/10"
                            onClick={() => handleSubmit(pa.id)}
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ──────────────── Modal Popup ──────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setShowModal(false)}>
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">New Prior Authorization</h2>
                <p className="text-gray-500 text-xs mt-1">Initiate a pre-authorization case file with the insurance carrier</p>
              </div>
              <button 
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 flex items-center justify-center text-lg font-bold transition-all"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Patient</label>
                  <select 
                    required 
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all"
                    value={form.patient_id}
                    onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                  >
                    <option value="">Select Patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name} (MRN: {p.medical_record_number})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Attending Doctor</label>
                  <select 
                    required 
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all"
                    value={form.doctor_id}
                    onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
                  >
                    <option value="">Select Doctor</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} ({d.specialty})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Insurance Provider & Plan</label>
                <select 
                  required 
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all"
                  value={form.insurance_provider_id}
                  onChange={(e) => setForm({ ...form, insurance_provider_id: e.target.value })}
                >
                  <option value="">Select Plan</option>
                  {insurances.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.plan_type})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Procedure CPT Code</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-400"
                    placeholder="e.g. 27447"
                    value={form.procedure_code}
                    onChange={(e) => setForm({ ...form, procedure_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Diagnosis ICD-10 Code</label>
                  <input 
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-400"
                    placeholder="e.g. M17.11"
                    value={form.diagnosis_code}
                    onChange={(e) => setForm({ ...form, diagnosis_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Procedure Description</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-400"
                  placeholder="e.g. Total knee replacement"
                  value={form.procedure_description}
                  onChange={(e) => setForm({ ...form, procedure_description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-wider">Clinical Justification</label>
                <textarea 
                  rows={3}
                  className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-400"
                  placeholder="Summarize diagnostics, failed conservative treatments, and medical necessity..."
                  value={form.clinical_justification}
                  onChange={(e) => setForm({ ...form, clinical_justification: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  className="flex-1 px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-black uppercase tracking-wider transition-all"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all"
                >
                  Create Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
