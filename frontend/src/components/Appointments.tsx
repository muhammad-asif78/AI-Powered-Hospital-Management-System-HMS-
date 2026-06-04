import React, { useState } from "react";
import { 
  Calendar, 
  Clock, 
  Search, 
  Plus, 
  X, 
  CheckCircle, 
  ChevronRight, 
  AlertCircle, 
  User, 
  Stethoscope, 
  CalendarDays,
  Trash2,
  ListFilter
} from "lucide-react";
import { Appointment, Patient, Doctor, AppointmentStatus } from "../types";

interface AppointmentsProps {
  appointments: Appointment[];
  patients: Patient[];
  doctors: Doctor[];
  onAddAppointment: (apt: Appointment) => void;
  onUpdateAppointment: (apt: Appointment) => void;
  onCancelAppointment: (aptId: string) => void;
}

export default function Appointments({
  appointments,
  patients,
  doctors,
  onAddAppointment,
  onUpdateAppointment,
  onCancelAppointment
}: AppointmentsProps) {
  const [isBooking, setIsBooking] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("All");

  // Booking Form State
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"Routine" | "Urgent" | "Critical">("Routine");

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId || !date || !time || !reason) return;

    const added: Appointment = {
      id: `apt-${Date.now().toString().slice(-4)}`,
      patientId,
      doctorId,
      date,
      time,
      reason,
      urgency,
      status: AppointmentStatus.SCHEDULED
    };

    onAddAppointment(added);
    setIsBooking(false);
    resetForm();
  };

  const resetForm = () => {
    setPatientId("");
    setDoctorId("");
    setDate("");
    setTime("");
    setReason("");
    setUrgency("Routine");
  };

  const handleStatusChange = (aptId: string, nextStatus: AppointmentStatus) => {
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;
    onUpdateAppointment({ ...apt, status: nextStatus });
  };

  const getUrgencyClass = (level: string) => {
    switch (level) {
      case "Critical": return "bg-rose-50 border-rose-200 text-rose-700 font-semibold";
      case "Urgent": return "bg-amber-50 border-amber-200 text-amber-700 font-semibold";
      default: return "bg-blue-50 border-blue-200 text-blue-700 font-semibold";
    }
  };

  const getStatusClass = (status: AppointmentStatus) => {
    switch (status) {
      case AppointmentStatus.CHECKED_IN: return "bg-teal-50 text-teal-700 border-teal-200";
      case AppointmentStatus.COMPLETED: return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case AppointmentStatus.CANCELED: return "bg-zinc-50 text-zinc-400 border-zinc-200 line-through";
      default: return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const patientObj = patients.find(p => p.id === apt.patientId);
    const doctorObj = doctors.find(d => d.id === apt.doctorId);
    
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (patientObj?.name.toLowerCase().includes(term) ?? false) || 
      (doctorObj?.name.toLowerCase().includes(term) ?? false) || 
      apt.reason.toLowerCase().includes(term);

    const matchesUrgency = urgencyFilter === "All" || apt.urgency === urgencyFilter;

    return matchesSearch && matchesUrgency;
  });

  return (
    <div id="scheduler-panel" className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-950 font-sans">Patient Consult Scheduler</h1>
          <p className="text-xs text-zinc-500">Coordinate clinic appointments, log immediate triage alerts, and book incoming referrals.</p>
        </div>
        <button 
          id="book-trigger"
          onClick={() => {
            setIsBooking(true);
            // Prepopulate dates
            const today = new Date().toISOString().split('T')[0];
            setDate(today);
            setTime("09:00");
            if (patients.length > 0) setPatientId(patients[0].id);
            if (doctors.length > 0) setDoctorId(doctors[0].id);
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <CalendarDays className="w-4 h-4" /> Book Appointment
        </button>
      </div>

      {/* Roster list filter ribbon */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-zinc-200/80 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-2.5" />
          <input 
            type="text"
            placeholder="Search by patient, physician, or diagnosis reasoning..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <ListFilter className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Urgency:</span>
          <select
            value={urgencyFilter}
            onChange={e => setUrgencyFilter(e.target.value)}
            className="text-xs border border-zinc-200 bg-zinc-50 py-1.5 px-3 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800 font-medium"
          >
            <option value="All">All priorities</option>
            <option value="Routine">Routine</option>
            <option value="Urgent">Urgent</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Appointment Cards Grid */}
      <div id="appointment-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAppointments.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white border border-zinc-200 rounded-2xl flex flex-col items-center justify-center space-y-3">
            <Calendar className="w-12 h-12 text-zinc-200 stroke-1" />
            <div>
              <p className="text-xs font-bold text-neutral-800">No Scheduled Consultations</p>
              <p className="text-[10px] text-zinc-500 mt-1 max-w-[280px]">All calendars are currently clear. Book an outpatient check-in to get started.</p>
            </div>
          </div>
        ) : (
          filteredAppointments.map(apt => {
            const patientObj = patients.find(p => p.id === apt.patientId);
            const doctorObj = doctors.find(d => d.id === apt.doctorId);

            return (
              <div 
                key={apt.id} 
                className="bg-white border border-zinc-200/80 rounded-2xl p-5 hover:shadow-lg hover:border-zinc-300 transition-all flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${getUrgencyClass(apt.urgency)}`}>
                      {apt.urgency} Priority
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${getStatusClass(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>

                  {/* Patient Name & Assigned Physicians */}
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-neutral-900 leading-tight">
                          {patientObj?.name || "Unknown Patient"}
                        </h3>
                        <p className="text-[9px] text-zinc-400 font-mono mt-0.5">ID: {apt.patientId}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-800 leading-tight">
                          {doctorObj?.name || "Unassigned Doctor"}
                        </h4>
                        <p className="text-[9px] text-zinc-500 font-medium">{doctorObj?.specialty}</p>
                      </div>
                    </div>
                  </div>

                  {/* Consulting reasons */}
                  <p className="text-[11px] font-medium text-zinc-650 bg-neutral-50 p-2.5 rounded-xl border border-zinc-150 leading-relaxed min-h-[48px]">
                    {apt.reason}
                  </p>

                  {/* Time stats */}
                  <div className="flex items-center justify-between text-[11px] border-t border-zinc-100/60 pt-3">
                    <span className="flex items-center gap-1 text-zinc-500 font-medium">
                      <CalendarDays className="w-3.5 text-zinc-400" />
                      {new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1 font-mono font-bold text-zinc-700">
                      <Clock className="w-3.5 text-zinc-400" />
                      {apt.time}
                    </span>
                  </div>
                </div>

                {/* Operations buttons */}
                {apt.status !== AppointmentStatus.COMPLETED && apt.status !== AppointmentStatus.CANCELED ? (
                  <div className="flex items-center gap-2 pt-2 text-[10.5px]">
                    {apt.status === AppointmentStatus.SCHEDULED && (
                      <button 
                        onClick={() => handleStatusChange(apt.id, AppointmentStatus.CHECKED_IN)}
                        className="flex-1 bg-indigo-55 border border-indigo-150 hover:bg-indigo-600 hover:text-white text-indigo-700 font-semibold py-1.5 px-3 rounded-xl transition cursor-pointer text-center"
                      >
                        Patient Check-In
                      </button>
                    )}
                    {apt.status === AppointmentStatus.CHECKED_IN && (
                      <button 
                        onClick={() => handleStatusChange(apt.id, AppointmentStatus.COMPLETED)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-xl transition cursor-pointer text-center"
                      >
                        Complete Session
                      </button>
                    )}
                    <button 
                      onClick={() => onCancelAppointment(apt.id)}
                      className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-100 p-1.5 rounded-lg transition"
                      title="Cancel consult slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 text-[10px] text-center font-semibold text-zinc-400">
                    {apt.status === AppointmentStatus.COMPLETED ? "Consult completed on time" : "Session canceled"}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SCHEDULE DIRECT REFERRAL BOOKING MODAL */}
      {isBooking && (
        <div className="fixed inset-0 z-50 bg-neutral-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Clinical Consultation Scheduling</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Secure clinical hours and allocate specialist slots.</p>
              </div>
              <button onClick={() => setIsBooking(false)} className="p-1 rounded-sm hover:bg-zinc-100 text-zinc-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Select Patient Chart *</label>
                  <select
                    value={patientId}
                    required
                    onChange={e => setPatientId(e.target.value)}
                    className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Select patient from directory</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Select On-Duty Practitioner *</label>
                  <select
                    value={doctorId}
                    required
                    onChange={e => setDoctorId(e.target.value)}
                    className="w-full border border-zinc-200 p-2.5 rounded-xl bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="" disabled>Select staff practitioner</option>
                    {doctors.filter(d=>d.status !== "Off Duty").map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.specialty})
                      </option>
                    ))}
                    {doctors.filter(d=>d.status === "Off Duty").map(doc => (
                      <option key={doc.id} value={doc.id} disabled>
                        {doc.name} (Off Duty • {doc.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Appointment Date *</label>
                    <input 
                      type="date" 
                      required
                      value={date} 
                      onChange={e => setDate(e.target.value)}
                      className="w-full border border-zinc-200 p-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Consultation Time *</label>
                    <input 
                      type="time" 
                      required
                      value={time} 
                      onChange={e => setTime(e.target.value)}
                      className="w-full border border-zinc-200 p-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Triage Priority / Urgency *</label>
                  <div className="flex gap-2">
                    {["Routine", "Urgent", "Critical"].map(level => (
                      <label 
                        key={level}
                        className={`flex-1 border text-center p-2 rounded-xl font-medium cursor-pointer transition ${
                          urgency === level 
                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold" 
                            : "border-zinc-200 hover:bg-zinc-50 text-zinc-650"
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="urgency"
                          value={level} 
                          checked={urgency === level}
                          onChange={() => setUrgency(level as any)}
                          className="sr-only"
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">Indication Reason *</label>
                  <textarea 
                    required
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    placeholder="Enter patient symptoms, indications or reference reason..." 
                    rows={2}
                    className="w-full border border-zinc-200 p-2 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 h-16"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 text-xs font-semibold">
                <button 
                  type="button" 
                  onClick={() => setIsBooking(false)} 
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl"
                >
                  Confirm Calendar Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
