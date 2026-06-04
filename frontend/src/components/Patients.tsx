import React, { useState } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  X, 
  UserPlus, 
  Activity, 
  FileText, 
  Bed, 
  Check, 
  AlertTriangle,
  UserCheck,
  Calendar,
  LogOut,
  Stethoscope
} from "lucide-react";
import { Patient, Doctor, Specialty, Ward, PatientStatus, BedStatus } from "../types";

interface PatientsProps {
  patients: Patient[];
  doctors: Doctor[];
  wards: Ward[];
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onAdmitPatient: (patientId: string, doctorId: string, bedId: string) => void;
  onDischargePatient: (patientId: string) => void;
  selectedPatientId?: string;
  setSelectedPatientId: (id: string | undefined) => void;
}

export default function Patients({
  patients,
  doctors,
  wards,
  onAddPatient,
  onUpdatePatient,
  onAdmitPatient,
  onDischargePatient,
  selectedPatientId,
  setSelectedPatientId
}: PatientsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isAdmittingFlow, setIsAdmittingFlow] = useState(false);

  // New Patient Form fields
  const [newName, setNewName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState("Male");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newInsurance, setNewInsurance] = useState("Blue Cross PeakCare");
  const [newEmergencyName, setNewEmergencyName] = useState("");
  const [newEmergencyPhone, setNewEmergencyPhone] = useState("");
  const [newEmergencyRelation, setNewEmergencyRelation] = useState("Spouse");
  const [newHistory, setNewHistory] = useState("");
  const [newAllergies, setNewAllergies] = useState("None reported");

  // Admitting Form State
  const [admitDoctorId, setAdmitDoctorId] = useState("");
  const [admitBedId, setAdmitBedId] = useState("");

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === "All" || p.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Get available beds flattened
  const availableBeds = wards.flatMap(w => w.beds.filter(b => b.status === BedStatus.AVAILABLE));

  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDob || !newPhone) return;

    const added: Patient = {
      id: `pat-${Date.now().toString().slice(-4)}`,
      name: newName,
      dob: newDob,
      gender: newGender,
      phone: newPhone,
      email: newEmail || `${newName.toLowerCase().replace(/\s+/g, '')}@hms.com`,
      insurance: newInsurance,
      emergencyContact: {
        name: newEmergencyName,
        phone: newEmergencyPhone,
        relationship: newEmergencyRelation
      },
      medicalHistory: newHistory,
      allergies: newAllergies,
      status: PatientStatus.OUTPATIENT
    };

    onAddPatient(added);
    setSelectedPatientId(added.id); // auto-select newly registered patient
    setIsAddingNew(false);
    resetForm();
  };

  const resetForm = () => {
    setNewName("");
    setNewDob("");
    setNewPhone("");
    setNewEmail("");
    setNewHistory("");
    setNewAllergies("");
    setNewEmergencyName("");
    setNewEmergencyPhone("");
  };

  const handleAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !admitDoctorId || !admitBedId) return;
    onAdmitPatient(selectedPatientId, admitDoctorId, admitBedId);
    setIsAdmittingFlow(false);
    setAdmitDoctorId("");
    setAdmitBedId("");
  };

  return (
    <div id="patients-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Search & Patient List (2 cols on desktop) */}
      <div className="lg:col-span-2 bg-white border border-zinc-200/80 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 font-sans">Patient Directory</h2>
            <p className="text-xs text-zinc-500">Search, filter, and register clinical chart documents.</p>
          </div>
          <button 
            id="register-btn"
            onClick={() => setIsAddingNew(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-md px-3 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" /> Register Patient
          </button>
        </div>

        {/* Directory Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
            <input 
              type="text"
              placeholder="Search by ID or name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs border border-zinc-200 bg-zinc-50 py-1.5 px-3 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800 font-medium"
            >
              <option value="All">All statuses</option>
              <option value={PatientStatus.OUTPATIENT}>Outpatient</option>
              <option value={PatientStatus.ADMITTED}>Admitted</option>
              <option value={PatientStatus.DISCHARGED}>Discharged</option>
            </select>
          </div>
        </div>

        {/* Patients List Grid/Table */}
        <div className="overflow-x-auto border border-zinc-150 rounded-xl">
          <table id="patients-table" className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-55/60 text-zinc-500 font-medium">
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Patient Name</th>
                <th className="py-2.5 px-4">Contact</th>
                <th className="py-2.5 px-4">Assigned Attending</th>
                <th className="py-2.5 px-4 text-center">Charts</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-400 bg-zinc-50/20">
                    No clinical charts matched current criteria.
                  </td>
                </tr>
              ) : (
                filteredPatients.map(patient => {
                  let statusBg = "bg-zinc-50 text-zinc-600 border-zinc-200";
                  if (patient.status === PatientStatus.ADMITTED) {
                    statusBg = "bg-rose-50 text-rose-700 border-rose-100";
                  } else if (patient.status === PatientStatus.DISCHARGED) {
                    statusBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  }

                  const matchedDoc = doctors.find(d => d.id === patient.doctorId);

                  return (
                    <tr 
                      key={patient.id} 
                      onClick={() => setSelectedPatientId(patient.id)}
                      className={`border-b border-zinc-100 hover:bg-zinc-50/70 transition cursor-pointer ${
                        selectedPatientId === patient.id ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBg}`}>
                          {patient.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-900">
                        <div>{patient.name}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">ID: {patient.id} • D.o.B: {patient.dob}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600">
                        {patient.phone}
                      </td>
                      <td className="py-3 px-4 text-zinc-700 font-medium">
                        {matchedDoc ? (
                          <div className="flex items-center gap-1">
                            <Stethoscope className="w-3.5 text-zinc-400" />
                            {matchedDoc.name}
                          </div>
                        ) : (
                          <span className="text-zinc-400">None assigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPatientId(patient.id);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                        >
                          View File
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail Panel / Admission Console (1 col) */}
      <div id="detail-drawer" className="bg-white border border-zinc-200/80 rounded-2xl p-6 space-y-5 shadow-xs flex flex-col justify-between">
        {selectedPatient ? (
          <div className="space-y-5 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono px-2 py-0.5 rounded border border-indigo-100 font-semibold">
                  EHR CLINICAL RECORD
                </span>
                <h3 className="text-base font-bold text-neutral-900 mt-1">{selectedPatient.name}</h3>
                <p className="text-[10px] text-zinc-400">UUID: {selectedPatient.id}</p>
              </div>
              <button 
                onClick={() => setSelectedPatientId(undefined)} 
                className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Demographics */}
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-zinc-100 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 block font-medium">Date of Birth</label>
                <span className="text-zinc-700 font-medium">{selectedPatient.dob}</span>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block font-medium">Gender</label>
                <span className="text-zinc-700 font-medium">{selectedPatient.gender}</span>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-400 block font-medium">Insurance Coverage</label>
                <span className="text-zinc-700 font-semibold">{selectedPatient.insurance}</span>
              </div>
            </div>

            {/* Clinical Health State */}
            <div className="space-y-3 pb-3 border-b border-zinc-100 text-xs">
              <div>
                <label className="text-[10px] text-red-500 font-bold tracking-wide flex items-center gap-1">
                  <AlertTriangle className="w-3" /> ALLERGIC HISTORY
                </label>
                <p className="text-neutral-900 font-semibold mt-0.5 bg-red-50/40 p-2 rounded-lg border border-red-100/50">
                  {selectedPatient.allergies || "No history"}
                </p>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block font-medium">Primary Diagnosis / Medical Summary</label>
                <p className="text-zinc-700 mt-1 bg-zinc-50 p-2.5 rounded-lg border border-zinc-150/50 leading-relaxed text-[11px]">
                  {selectedPatient.medicalHistory || "None declared"}
                </p>
              </div>
            </div>

            {/* Accompanying info */}
            <div className="space-y-1.5 text-xs pb-3">
              <label className="text-[10px] text-zinc-400 block font-medium">Emergency Contacts</label>
              <div className="p-2.5 border border-zinc-150 rounded-lg bg-zinc-50 text-[11px] space-y-1">
                <p className="font-semibold text-zinc-800">{selectedPatient.emergencyContact.name} ({selectedPatient.emergencyContact.relationship})</p>
                <p className="text-zinc-600 font-medium">{selectedPatient.emergencyContact.phone}</p>
              </div>
            </div>

            {/* Case Actions */}
            <div id="patient-actions" className="pt-3 space-y-2">
              <label className="text-[10px] text-zinc-400 font-semibold block tracking-wide">CASE ACTIONS & PROGRESS</label>
              
              {selectedPatient.status === PatientStatus.OUTPATIENT && (
                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500">Patient currently categorized as outpatient. Admitting secures a ward bed.</p>
                  <button 
                    id="admit-trigger"
                    onClick={() => {
                      setIsAdmittingFlow(true);
                      // Set default selections
                      if (doctors.length > 0) setAdmitDoctorId(doctors[0].id);
                      if (availableBeds.length > 0) setAdmitBedId(availableBeds[0].id);
                    }}
                    className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-xl text-xs hover:bg-indigo-700 hover:shadow-sm cursor-pointer transition flex items-center justify-center gap-2"
                  >
                    <Bed className="w-4 h-4" /> Admit Patient
                  </button>
                </div>
              )}

              {selectedPatient.status === PatientStatus.ADMITTED && (
                <div className="space-y-3">
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-1 text-xs text-rose-800">
                    <p className="font-semibold flex items-center gap-1 text-[11px]">
                      <Activity className="w-3.5 h-3.5 text-rose-600 animate-pulse" /> Admitted Status Active
                    </p>
                    {selectedPatient.admittedAt && (
                      <p className="text-[9px] text-rose-600/90 font-medium">Admitted: {new Date(selectedPatient.admittedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  <button 
                    id="discharge-trigger"
                    onClick={() => onDischargePatient(selectedPatient.id)}
                    className="w-full bg-emerald-600 text-white font-semibold py-2 rounded-xl text-xs hover:bg-emerald-700 cursor-pointer transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Discharge Patient
                  </button>
                </div>
              )}

              {selectedPatient.status === PatientStatus.DISCHARGED && (
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-1">
                  <p className="font-semibold text-zinc-700 flex items-center gap-1 text-[11.5px]">
                    <Check className="w-4 h-4 text-emerald-600 font-bold" /> Discharged Case
                  </p>
                  <p className="text-[10px] text-zinc-400">Bed released. Discharge paperwork processed.</p>
                  {selectedPatient.dischargedAt && (
                    <p className="text-[9px] text-zinc-400 font-mono">Timestamp: {new Date(selectedPatient.dischargedAt).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-zinc-400 space-y-3">
            <Users className="w-12 h-12 text-zinc-200 stroke-1" />
            <div>
              <h3 className="text-xs font-semibold text-neutral-800">No Patient Chart Selected</h3>
              <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
                Click on any row in the Patient Directory to view clinical logs, allergy registers, and execute admissions.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / REGISTER NEW PATIENT */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Patient Registration Register</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Please populate all required credentials to form a clinical EHR chart.</p>
              </div>
              <button onClick={() => setIsAddingNew(false)} className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Full Clinical Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Samuel Henderson" 
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Date of Birth *</label>
                  <input 
                    type="date" 
                    required 
                    value={newDob} 
                    onChange={e => setNewDob(e.target.value)}
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Biological Gender *</label>
                  <select 
                    value={newGender} 
                    onChange={e => setNewGender(e.target.value)}
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Mobile Contact *</label>
                  <input 
                    type="tel" 
                    required 
                    value={newPhone} 
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000" 
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Email Coordinates</label>
                  <input 
                    type="email" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="samuel.h@example.com" 
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Insurance Provider / Plan Sponsor</label>
                  <input 
                    type="text" 
                    value={newInsurance} 
                    onChange={e => setNewInsurance(e.target.value)}
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Emergency Details */}
                <div className="col-span-2 border-t border-zinc-100 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-indigo-600 block">EMERGENCY ESCORT / NEXT OF KIN</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="text" 
                      placeholder="Escort Name" 
                      required 
                      value={newEmergencyName} 
                      onChange={e => setNewEmergencyName(e.target.value)}
                      className="border border-zinc-200 p-2 rounded-lg text-xs"
                    />
                    <input 
                      type="tel" 
                      placeholder="Escort Phone" 
                      required 
                      value={newEmergencyPhone} 
                      onChange={e => setNewEmergencyPhone(e.target.value)}
                      className="border border-zinc-200 p-2 rounded-lg text-xs"
                    />
                    <select 
                      value={newEmergencyRelation} 
                      onChange={e => setNewEmergencyRelation(e.target.value)}
                      className="border border-zinc-200 p-2 rounded-lg text-xs"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Son/Daughter">Child</option>
                      <option value="Guardian">Guardian</option>
                    </select>
                  </div>
                </div>

                {/* Clinical Notes */}
                <div className="col-span-2 space-y-2 pt-2">
                  <div>
                    <label className="text-[10px] font-semibold text-red-500 uppercase tracking-wider block mb-1">Allergies & Contraindications</label>
                    <input 
                      type="text" 
                      value={newAllergies} 
                      onChange={e => setNewAllergies(e.target.value)}
                      className="w-full border border-zinc-200 p-2 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Clinical Context / Background History</label>
                    <textarea 
                      value={newHistory} 
                      onChange={e => setNewHistory(e.target.value)}
                      placeholder="Describe symptoms, chronicity, other comorbidities..." 
                      rows={2}
                      className="w-full border border-zinc-200 p-2 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden h-14"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setIsAddingNew(false)} 
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl"
                >
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADMIT PATIENT (WARD ALLOCATION) */}
      {isAdmittingFlow && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Bed Admission Setup</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Approve patient admission by securing a doctor and bed.</p>
              </div>
              <button onClick={() => setIsAdmittingFlow(false)} className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdmitSubmit} className="space-y-4">
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-150 flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-150 text-indigo-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedPatient.name.split(" ").map(n=>n[0]).join("")}
                </div>
                <div className="text-xs">
                  <p className="font-bold text-neutral-900">{selectedPatient.name}</p>
                  <p className="text-zinc-500 text-[10px]">Born {selectedPatient.dob} • Allergies: {selectedPatient.allergies}</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Attending Physician *</label>
                  <select
                    value={admitDoctorId}
                    required
                    onChange={e => setAdmitDoctorId(e.target.value)}
                    className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="" disabled>Select on-call doctor</option>
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.specialty}) - {doc.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Select Available Bed Node *</label>
                  {availableBeds.length === 0 ? (
                    <div className="p-3 border border-red-150 bg-red-50 text-red-800 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4" /> All physical hospital beds are occupied or cleaning.
                    </div>
                  ) : (
                    <select
                      value={admitBedId}
                      required
                      onChange={e => setAdmitBedId(e.target.value)}
                      className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="" disabled>Select available bed</option>
                      {wards.map(ward => {
                        const wardBeds = ward.beds.filter(b => b.status === BedStatus.AVAILABLE);
                        if (wardBeds.length === 0) return null;
                        return (
                          <optgroup key={ward.id} label={`${ward.name} (${ward.type})`}>
                            {wardBeds.map(bed => (
                              <option key={bed.id} value={bed.id}>
                                Bed {bed.number}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setIsAdmittingFlow(false)} 
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={availableBeds.length === 0 || !admitDoctorId}
                  className="bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl hover:bg-indigo-700"
                >
                  Confirm Ingress Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
