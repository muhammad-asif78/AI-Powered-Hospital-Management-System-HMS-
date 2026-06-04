import React, { useState } from "react";
import { 
  Building2, 
  Search, 
  Filter, 
  PlusCircle, 
  X, 
  Phone, 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  UserCircle,
  Clock,
  Briefcase
} from "lucide-react";
import { Doctor, Specialty, StaffStatus } from "../types";

interface DoctorsProps {
  doctors: Doctor[];
  onAddDoctor: (doc: Doctor) => void;
  onUpdateDoctor: (doc: Doctor) => void;
}

export default function Doctors({ doctors, onAddDoctor, onUpdateDoctor }: DoctorsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Doctor Form
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState<Specialty>(Specialty.GENERAL_MEDICINE);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [room, setRoom] = useState("");

  const handleCreateDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !room) return;

    const added: Doctor = {
      id: `doc-${Date.now().toString().slice(-4)}`,
      name: name,
      specialty: specialty,
      status: StaffStatus.ON_DUTY,
      email: email,
      phone: phone,
      room: room
    };

    onAddDoctor(added);
    setIsAddingNew(false);
    setName("");
    setEmail("");
    setPhone("");
    setRoom("");
  };

  const handleStatusToggle = (docId: string, currentStatus: StaffStatus) => {
    const doc = doctors.find(d => d.id === docId);
    if (!doc) return;

    // Cycle status: On Duty -> Active Consult -> Off Duty -> On Duty
    let nextStatus: StaffStatus = StaffStatus.ON_DUTY;
    if (currentStatus === StaffStatus.ON_DUTY) {
      nextStatus = StaffStatus.ACTIVE_CONSULT;
    } else if (currentStatus === StaffStatus.ACTIVE_CONSULT) {
      nextStatus = StaffStatus.OFF_DUTY;
    }

    onUpdateDoctor({ ...doc, status: nextStatus });
  };

  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = specialtyFilter === "All" || doc.specialty === specialtyFilter;
    return matchesSearch && matchesSpecialty;
  });

  return (
    <div id="doctors-panel" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-950 font-sans">Medical Staff Roster</h1>
          <p className="text-xs text-zinc-500">Manage consultant specialties, current floor status, and secure on-call schedules.</p>
        </div>
        <button 
          id="add-staff-btn"
          onClick={() => setIsAddingNew(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" /> Register Physician
        </button>
      </div>

      {/* Filter Ribbon */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-zinc-200/80 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
          <input 
            type="text"
            placeholder="Search by physician name or key department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Specialty Branch:</span>
          <select
            value={specialtyFilter}
            onChange={e => setSpecialtyFilter(e.target.value)}
            className="text-xs border border-zinc-200 bg-zinc-50 py-1.5 px-3 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800 font-medium"
          >
            <option value="All">All departments</option>
            {Object.values(Specialty).map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Grids */}
      <div id="doctors-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.map(doc => {
          let statusBadgeColor = "bg-zinc-50 text-zinc-600 border-zinc-200";
          let circleBg = "bg-zinc-400";
          
          if (doc.status === StaffStatus.ON_DUTY) {
            statusBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
            circleBg = "bg-emerald-500";
          } else if (doc.status === StaffStatus.ACTIVE_CONSULT) {
            statusBadgeColor = "bg-amber-50 text-amber-700 border-amber-100";
            circleBg = "bg-amber-500";
          } else if (doc.status === StaffStatus.OFF_DUTY) {
            statusBadgeColor = "bg-rose-50 text-rose-700 border-rose-100";
            circleBg = "bg-rose-400";
          }

          return (
            <div 
              key={doc.id} 
              className="bg-white border border-zinc-200/80 rounded-2xl p-5 hover:shadow-lg hover:border-zinc-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs border border-indigo-100 uppercase">
                      {doc.name.split(" ").filter(n=>!n.includes("Dr.")).map(n=>n[0]).join("")}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900">{doc.name}</h3>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium mt-0.5">
                        <Briefcase className="w-3" />
                        {doc.specialty}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${statusBadgeColor}`}>
                    {doc.status}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-650 bg-neutral-50 p-2.5 rounded-xl border border-zinc-150 space-y-1 font-medium">
                  <p className="flex items-center gap-1.5 font-mono text-zinc-500">
                    <Clock className="w-3" /> {doc.room}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono">
                    <Phone className="w-3 text-zinc-400" /> {doc.phone}
                  </p>
                  <p className="flex items-center gap-1.5 font-mono">
                    <Mail className="w-3 text-zinc-400" /> {doc.email}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleStatusToggle(doc.id, doc.status)}
                  className="flex-1 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-semibold py-1.5 px-3 rounded-lg text-[10.5px] transition cursor-pointer"
                  title="Cycle duty statuses between On Duty, Consult, and Off Duty"
                >
                  Rotate Status
                </button>
                <a 
                  href={`mailto:${doc.email}`}
                  className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-indigo-600 p-2 rounded-lg transition"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: REGISTER STAFF PHYSICIAN */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 bg-neutral-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Physician Roster Onboarding</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Allocate clinical suite space and specialty fields for new staff.</p>
              </div>
              <button onClick={() => setIsAddingNew(false)} className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDoctor} className="space-y-4">
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Physician Full Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Dr. Catherine Reed" 
                    className="w-full border border-zinc-200 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Medical Specialty Branch *</label>
                  <select 
                    value={specialty} 
                    onChange={e => setSpecialty(e.target.value as Specialty)}
                    className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {Object.values(Specialty).map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Corporate Suite / Room Allocation *</label>
                  <input 
                    type="text" 
                    required 
                    value={room} 
                    onChange={e => setRoom(e.target.value)}
                    placeholder="e.g. Consultation Block B-12" 
                    className="w-full border border-zinc-200 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Email Coordinates *</label>
                    <input 
                      type="email" 
                      required 
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      placeholder="c.reed@stjude.org" 
                      className="w-full border border-zinc-200 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Contact Phone *</label>
                    <input 
                      type="tel" 
                      required 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000" 
                      className="w-full border border-zinc-200 p-2.5 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
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
                  Board Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
