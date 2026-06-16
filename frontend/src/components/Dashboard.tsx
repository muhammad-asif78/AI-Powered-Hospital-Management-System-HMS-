import { useState, useEffect } from "react";
import { api } from "../api";
import { 
  Activity, 
  Users, 
  UserCheck, 
  Bed, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  Stethoscope, 
  ShieldAlert,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { Doctor, Patient, Ward, BedStatus, PatientStatus } from "../types";

interface DashboardProps {
  doctors: Doctor[];
  patients: Patient[];
  wards: Ward[];
  setActiveTab: (tab: string) => void;
  setSelectedPatientId?: (id: string) => void;
}

export default function Dashboard({ doctors, patients, wards, setActiveTab, setSelectedPatientId }: DashboardProps) {
  // Compute analytics
  const totalPatients = patients.length;
  const activePatientsCount = patients.filter(p => p.status === PatientStatus.ADMITTED).length;
  const onDutyDoctorsCount = doctors.filter(d => d.status !== "Off Duty").length;

  let totalBedsCount = 0;
  let occupiedBedsCount = 0;
  let maintenanceBedsCount = 0;

  wards.forEach(w => {
    w.beds.forEach(b => {
      totalBedsCount++;
      if (b.status === BedStatus.OCCUPIED) occupiedBedsCount++;
      if (b.status === BedStatus.MAINTENANCE) maintenanceBedsCount++;
    });
  });

  const availableBedsCount = totalBedsCount - occupiedBedsCount - maintenanceBedsCount;
  const bedOccupancyRate = totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 0;

  // ICU Specific Check
  const icuWard = wards.find(w => w.id === "ward-icu");
  const icuOccupied = icuWard ? icuWard.beds.filter(b => b.status === BedStatus.OCCUPIED).length : 0;
  const icuTotal = icuWard ? icuWard.beds.length : 0;
  
  // Urgent Patients
  const admittedPatients = patients.filter(p => p.status === PatientStatus.ADMITTED);

  // SVG Chart: Compute patient specialty spread
  const specialtyCount: Record<string, number> = {};
  doctors.forEach(d => {
    specialtyCount[d.specialty] = 0;
  });
  patients.forEach(p => {
    if (p.status === PatientStatus.ADMITTED && p.doctorId) {
      const doc = doctors.find(d => d.id === p.doctorId);
      if (doc) {
        specialtyCount[doc.specialty] = (specialtyCount[doc.specialty] || 0) + 1;
      }
    }
  });

  const chartData = Object.entries(specialtyCount).map(([name, value]) => ({
    name,
    value,
    percentage: activePatientsCount > 0 ? Math.round((value / activePatientsCount) * 100) : 0
  }));

  // Census logs removed from dashboard layout - now rendered globally in the overlay chat widget

  return (
    <div id="dashboard-tab" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 font-sans">Hospital Census Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time occupancy status, active clinical logs, and departmental stats.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 self-start md:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live Ingress Router Connected
        </div>
      </div>

      {/* Main KPI Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Admitted Patients Card */}
        <div id="kpi-pat" className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex items-start justify-between shadow-xs shadow-zinc-100">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active In-Patients</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">{activePatientsCount}</span>
              <span className="text-xs text-zinc-400">/ {totalPatients} total</span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3" />
              Stable clinical load
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Doctors On Duty */}
        <div id="kpi-doc" className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex items-start justify-between shadow-xs shadow-zinc-100">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Staff On Duty</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">{onDutyDoctorsCount}</span>
              <span className="text-xs text-zinc-400">/ {doctors.length} active</span>
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">
              • Dr. Rostova on Call
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Available Beds */}
        <div id="kpi-beds" className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex items-start justify-between shadow-xs shadow-zinc-100">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Bed Census</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">{availableBedsCount}</span>
              <span className="text-xs text-zinc-400">/ {totalBedsCount} available</span>
            </div>
            <div className="h-1.5 w-32 bg-zinc-100 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${bedOccupancyRate > 80 ? "bg-amber-500" : "bg-indigo-600"}`}
                style={{ width: `${bedOccupancyRate}%` }}
              ></div>
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Bed className="w-5 h-5" />
          </div>
        </div>

        {/* Bed Occupancy Meter */}
        <div id="kpi-occupancy" className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex items-start justify-between shadow-xs shadow-zinc-100">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Occupancy Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-neutral-900">{bedOccupancyRate}%</span>
              <span className="text-xs text-amber-600 font-medium">Moderate</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Goal limits: &lt;85%</p>
          </div>
          <div className={`p-3 rounded-xl ${bedOccupancyRate > 75 ? "bg-amber-50 text-amber-600" : "bg-zinc-50 text-zinc-600"}`}>
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Primary Visual Row of Charts & Live Bed Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ward Bed Allocations Quick Grid */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/80 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-neutral-900">Bed Allocation Layout</h2>
              <p className="text-xs text-zinc-400">Interactive live status map of all physical wards and emergency wings.</p>
            </div>
            <button 
              onClick={() => setActiveTab("beds")} 
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
            >
              Full bed desk <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wards.map(ward => {
              const occupiedCount = ward.beds.filter(b => b.status === BedStatus.OCCUPIED).length;
              const totalCount = ward.beds.length;
              const ratio = totalCount > 0 ? (occupiedCount / totalCount) * 100 : 0;
              
              return (
                <div key={ward.id} className="border border-zinc-150 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-800 tracking-tight">{ward.name}</span>
                    <span className="text-[10px] font-mono font-medium text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100">
                      {occupiedCount}/{totalCount} Occupied
                    </span>
                  </div>
                  
                  {/* Mini physical bed grids */}
                  <div className="grid grid-cols-4 gap-2">
                    {ward.beds.map(bed => {
                      let bgClass = "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";
                      if (bed.status === BedStatus.OCCUPIED) {
                        bgClass = "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100";
                      } else if (bed.status === BedStatus.MAINTENANCE) {
                        bgClass = "bg-zinc-100 border-zinc-200 text-zinc-500";
                      }
                      return (
                        <div 
                          key={bed.id} 
                          title={`Bed ${bed.number}: ${bed.status}`}
                          className={`border text-[10px] font-medium py-1.5 rounded-lg text-center transition cursor-help ${bgClass}`}
                        >
                          {bed.number.split("-")[1] || bed.number}
                        </div>
                      );
                    })}
                  </div>

                  {/* Progressive Bar */}
                  <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${ratio > 75 ? "bg-rose-500" : "bg-indigo-600"}`} 
                      style={{ width: `${ratio}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ICU Watchout Box */}
          {icuWard && icuOccupied >= icuTotal - 1 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3 mt-4">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-amber-950">Intensive Care Capacity Warning</h4>
                <p className="text-[11px] text-amber-800 mt-1">
                  ICU Bed availability is down to 1 bed. Prepare observation beds or clear non-critical ICU patients.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Area Admission Trends (SVG) */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-neutral-900">Patient Census by Specialty</h2>
            <p className="text-xs text-zinc-400">Current active inpatient load routed by specialist team.</p>
          </div>

          {/* Render list of specialty allocations */}
          <div className="space-y-4 my-5">
            {chartData.map((dept, index) => {
              const bgColors = ["bg-indigo-600", "bg-emerald-600", "bg-sky-600", "bg-rose-600", "bg-purple-600", "bg-amber-500"];
              const color = bgColors[index % bgColors.length];
              return (
                <div key={dept.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-zinc-600">{dept.name}</span>
                    <span className="font-semibold text-neutral-800">{dept.value} Patients ({dept.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-50 rounded-full overflow-hidden border border-zinc-100">
                    <div 
                      className={`h-full rounded-full ${color}`} 
                      style={{ width: `${dept.percentage || 2}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {chartData.length === 0 || chartData.every(d => d.value === 0) ? (
              <div className="text-center py-10 text-xs text-zinc-400">
                <Stethoscope className="w-8 h-8 mx-auto text-zinc-300 stroke-1 mb-2" />
                No active admitted patients.
              </div>
            ) : null}
          </div>

          <div className="bg-zinc-50 border border-zinc-150 p-3.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[11px] font-medium text-zinc-600">Symptom AI Auto-routing</span>
            </div>
            <button 
              onClick={() => setActiveTab("triage")}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
            >
              Consult Triage <ChevronRight className="w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row - Active Inpatient Roster (Spanned full width for clean aesthetics) */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Critical Cases Tracker */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Active Inpatient Roster</h2>
              <p className="text-xs text-zinc-400">Active clinical status of currently admitted patients.</p>
            </div>
            <button 
              onClick={() => setActiveTab("patients")} 
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 cursor-pointer"
            >
              View Roster <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 text-zinc-500 font-medium">
                  <th className="pb-3 pl-1">Patient Name</th>
                  <th className="pb-3">Bed Room</th>
                  <th className="pb-3">Attending Physician</th>
                  <th className="pb-3 text-right pr-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {admittedPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-zinc-400 bg-zinc-50/50 rounded-xl">
                      No admitted records present. Register or admit in Patient Panel.
                    </td>
                  </tr>
                ) : (
                  admittedPatients.map(patient => {
                    const attendingDoc = doctors.find(d => d.id === patient.doctorId);
                    const bedObj = wards.flatMap(w => w.beds).find(b => b.id === patient.bedId);
                    
                    return (
                      <tr key={patient.id} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                        <td className="py-3 pl-1">
                          <div className="font-semibold text-zinc-900">{patient.name}</div>
                          <div className="text-[10px] text-zinc-400">ID: {patient.id}</div>
                        </td>
                        <td className="py-3">
                          <span className="font-mono bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {bedObj?.number || "Unassigned"}
                          </span>
                        </td>
                        <td className="py-3 text-zinc-700">
                          {attendingDoc?.name || "Unassigned"}
                        </td>
                        <td className="py-3 text-right pr-1">
                          <button 
                            onClick={() => {
                              if (setSelectedPatientId) {
                                setSelectedPatientId(patient.id);
                                setActiveTab("patients");
                              }
                            }}
                            className="bg-zinc-50 border border-zinc-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-150 text-zinc-600 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer"
                          >
                            Details
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
      </div>
    </div>
  );
}
