import React, { useState } from "react";
import { 
  Bed, 
  Users, 
  PlusCircle, 
  PenTool, 
  Trash2, 
  Check, 
  X, 
  Wrench, 
  ShieldAlert, 
  Activity, 
  UserPlus, 
  Calendar,
  Layers
} from "lucide-react";
import { Ward, BedStatus, Patient, Doctor, PatientStatus } from "../types";

interface BedsProps {
  wards: Ward[];
  patients: Patient[];
  doctors: Doctor[];
  onAdmitPatient: (patientId: string, doctorId: string, bedId: string) => void;
  onUpdateBedStatus: (wardId: string, bedId: string, nextStatus: BedStatus) => void;
}

export default function Beds({ wards, patients, doctors, onAdmitPatient, onUpdateBedStatus }: BedsProps) {
  const [activeWardId, setActiveWardId] = useState(wards[0]?.id || "");
  const [admitTargetBedId, setAdmitTargetBedId] = useState<string | null>(null);

  // Admit Form State inline
  const [admitPatientId, setAdmitPatientId] = useState("");
  const [admitDoctorId, setAdmitDoctorId] = useState("");

  const activeWard = wards.find(w => w.id === activeWardId);
  const activePatients = patients.filter(p => p.status === PatientStatus.OUTPATIENT);

  // Compute stats
  let totalBeds = 0;
  let occupiedBeds = 0;
  let maintenanceBeds = 0;

  wards.forEach(w => {
    w.beds.forEach(b => {
      totalBeds++;
      if (b.status === BedStatus.OCCUPIED) occupiedBeds++;
      if (b.status === BedStatus.MAINTENANCE) maintenanceBeds++;
    });
  });

  const availableBeds = totalBeds - occupiedBeds - maintenanceBeds;

  const handleInlineAdmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitTargetBedId || !admitPatientId || !admitDoctorId) return;

    onAdmitPatient(admitPatientId, admitDoctorId, admitTargetBedId);
    setAdmitTargetBedId(null);
    setAdmitPatientId("");
    setAdmitDoctorId("");
  };

  const handleMaintenanceToggle = (wardId: string, bedId: string, currentStatus: BedStatus) => {
    const nextStatus = currentStatus === BedStatus.MAINTENANCE ? BedStatus.AVAILABLE : BedStatus.MAINTENANCE;
    onUpdateBedStatus(wardId, bedId, nextStatus);
  };

  return (
    <div id="beds-panel" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-950 font-sans">Physical Bed & Ward Planner</h1>
          <p className="text-xs text-zinc-500 font-medium">Verify physical bed placements, optimize floorplans, and route arrivals instantaneously.</p>
        </div>
        
        {/* Aggregated Ward Counters */}
        <div className="flex items-center gap-2 border border-zinc-200 bg-white px-3 py-1.5 rounded-xl text-xs font-mono font-medium self-start sm:self-auto">
          <span className="text-emerald-600">{availableBeds} Clean</span>
          <span className="text-zinc-300">|</span>
          <span className="text-rose-500">{occupiedBeds} Taken</span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500">{maintenanceBeds} Prep</span>
        </div>
      </div>

      {/* Ward Tab Selection Bar */}
      <div className="flex border-b border-zinc-200">
        {wards.map(w => {
          const occupiedCount = w.beds.filter(b=>b.status === BedStatus.OCCUPIED).length;
          return (
            <button
              key={w.id}
              onClick={() => setActiveWardId(w.id)}
              className={`py-3 px-4 text-xs font-semibold tracking-wide border-b-2 -mb-px transition cursor-pointer ${
                activeWardId === w.id 
                  ? "border-indigo-600 text-indigo-600 font-bold" 
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5" /> {w.name}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">
                  {occupiedCount}/{w.beds.length}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Major Visualized Grid Layout of selected Ward */}
      {activeWard ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Layout Grid (2 Cols on Desktop) */}
          <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-neutral-900">{activeWard.name} Node Plan</h2>
              <p className="text-xs text-zinc-400">Click on any green node to directly admit, or toggle node sanitation maintenance statuses.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {activeWard.beds.map(bed => {
                const residentPatient = patients.find(p => p.id === bed.patientId);
                const attendingDoc = residentPatient ? doctors.find(d => d.id === residentPatient.doctorId) : null;

                let stateClass = "border-emerald-250 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-100";
                if (bed.status === BedStatus.OCCUPIED) {
                  stateClass = "border-rose-220 bg-rose-50/40 text-rose-800 hover:bg-rose-100/60";
                } else if (bed.status === BedStatus.MAINTENANCE) {
                  stateClass = "border-zinc-250 bg-zinc-50 text-zinc-400";
                }

                return (
                  <div 
                    key={bed.id}
                    className={`border p-4 rounded-xl transition flex flex-col justify-between h-40 shadow-xs ${stateClass}`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono font-bold tracking-tight bg-white border border-zinc-200/50 px-1.5 py-0.5 rounded text-zinc-800">
                          {bed.number}
                        </span>
                        
                        {/* Bed status indicator light */}
                        <div className={`w-2 h-2 rounded-full ${
                          bed.status === BedStatus.OCCUPIED ? "bg-rose-500" :
                          bed.status === BedStatus.MAINTENANCE ? "bg-amber-400" : "bg-emerald-500"
                        }`}></div>
                      </div>

                      <div className="mt-3.5 space-y-1">
                        {bed.status === BedStatus.OCCUPIED && residentPatient ? (
                          <>
                            <p className="text-xs font-bold text-zinc-900 line-clamp-1">{residentPatient.name}</p>
                            <p className="text-[10px] text-zinc-400 font-medium font-mono">MD: {attendingDoc ? attendingDoc.name.replace("Dr. ", "") : "Unassigned"}</p>
                          </>
                        ) : bed.status === BedStatus.MAINTENANCE ? (
                          <p className="text-[10px] text-zinc-400 font-mono tracking-wide">SANITIZING BED</p>
                        ) : (
                          <p className="text-[10px] text-emerald-700 font-semibold font-mono tracking-wide">AVAL CLINICAL NODE</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100/40 flex justify-between items-center gap-2">
                      {bed.status === BedStatus.AVAILABLE ? (
                        <button
                          onClick={() => {
                            setAdmitTargetBedId(bed.id);
                            if (activePatients.length > 0) setAdmitPatientId(activePatients[0].id);
                            if (doctors.length > 0) setAdmitDoctorId(doctors[0].id);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1 px-2.5 rounded text-[10px] transition cursor-pointer"
                        >
                          Place Patient
                        </button>
                      ) : bed.status === BedStatus.OCCUPIED ? (
                        <span className="text-[10px] text-zinc-450 font-semibold">Allocated</span>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-semibold">Service Desk</span>
                      )}

                      {/* Maintenance Toggle icon button */}
                      {bed.status !== BedStatus.OCCUPIED && (
                        <button
                          onClick={() => handleMaintenanceToggle(activeWard.id, bed.id, bed.status)}
                          className="text-zinc-400 hover:text-indigo-600 transition p-1.5"
                          title="Toggle maintenance cleaning status"
                        >
                          <Wrench className="w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Info Drawer Side (1 Col) */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-900">Admitted Census List</h3>
              <p className="text-xs text-zinc-500">Overview of patient nodes on this floor.</p>

              <div className="space-y-3">
                {activeWard.beds.filter(b => b.status === BedStatus.OCCUPIED).map(bed => {
                  const patient = patients.find(p => p.id === bed.patientId);
                  const doc = patient ? doctors.find(d => d.id === patient.doctorId) : null;
                  
                  if (!patient) return null;
                  return (
                    <div key={bed.id} className="p-3 bg-neutral-50 border border-zinc-150 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-neutral-900">{patient.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">Assignee Node: {bed.number}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-zinc-700">{doc?.name || "MD On duty"}</div>
                        <span className="text-[9px] text-zinc-400 font-mono">Specialist</span>
                      </div>
                    </div>
                  );
                })}

                {activeWard.beds.filter(b => b.status === BedStatus.OCCUPIED).length === 0 && (
                  <div className="text-center py-10 text-zinc-400 text-xs">
                    All beds on this floor currently unoccupied.
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-900 mt-5">
              <h4 className="font-semibold text-indigo-950 flex items-center gap-1">
                <ShieldAlert className="w-4 text-indigo-600" /> Administrative Ward Controls
              </h4>
              <p className="text-[10px] leading-relaxed">
                Bed allocations are linked to the Billing core. Discharging a patient frees up the bed node instantly and outputs draft statement sheets automatically.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-zinc-400 text-xs">No active wards configuration available.</div>
      )}

      {/* MODAL: DIRECT INGRESS WARD PLACEMENT */}
      {admitTargetBedId && (
        <div className="fixed inset-0 z-50 bg-neutral-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center text-xs">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Ingress Placement Setup</h3>
                <p className="text-zinc-400 text-[11px] mt-0.5">Secure clinical bed placement instantly.</p>
              </div>
              <button onClick={() => setAdmitTargetBedId(null)} className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInlineAdmitSubmit} className="space-y-4">
              <div className="space-y-3 text-xs">
                
                {activePatients.length === 0 ? (
                  <div className="p-3 border border-red-150 bg-red-50 text-red-800 rounded-xl text-[11px] font-medium leading-relaxed">
                    No unregistered outpatient records found! Go to the "Patients" panel to register clients before performing bedroom check-ins.
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Inpatient Name *</label>
                    <select
                      value={admitPatientId}
                      required
                      onChange={e => setAdmitPatientId(e.target.value)}
                      className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:outline-hidden"
                    >
                      <option value="" disabled>Select outpatient to admit</option>
                      {activePatients.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Attending Clinician *</label>
                  <select
                    value={admitDoctorId}
                    required
                    onChange={e => setAdmitDoctorId(e.target.value)}
                    className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:outline-hidden"
                  >
                    <option value="" disabled>Select physician</option>
                    {doctors.filter(d=>d.status !== "Off Duty").map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.specialty})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setAdmitTargetBedId(null)} 
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={activePatients.length === 0 || !admitDoctorId}
                  className="bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl"
                >
                  Approve Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
