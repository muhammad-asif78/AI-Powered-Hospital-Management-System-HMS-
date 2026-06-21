import { useState, useEffect } from "react";
import { 
  Activity, 
  Users, 
  UserCheck, 
  Calendar, 
  Bed, 
  FileText, 
  BrainCircuit, 
  Stethoscope, 
  Building2, 
  LogOut,
  ChevronRight,
  Menu,
  X,
  FileSymlink,
  ShieldCheck,
  PhoneCall
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { 
  Patient, 
  Doctor, 
  Ward, 
  Appointment, 
  Invoice, 
  PatientStatus, 
  BedStatus,
  Specialty,
  AppointmentStatus,
  StaffStatus
} from "./types";

import { 
  initialPatients, 
  initialDoctors, 
  initialWards, 
  initialAppointments, 
  initialInvoices 
} from "./data/mockData";

import Dashboard from "./components/Dashboard";
import Patients from "./components/Patients";
import Doctors from "./components/Doctors";
import Appointments from "./components/Appointments";
import Beds from "./components/Beds";
import Billing from "./components/Billing";
import Triage from "./components/Triage";
import Referrals from "./components/Referrals";
import PriorAuth from "./components/PriorAuth";
import AICallCenter from "./components/AICallCenter";
import Login from "./components/Login";
import LedgerChatWidget from "./components/LedgerChatWidget";
import { api } from "./api";

export default function App() {
  // Secure Context Redirection Guard (Automatically routes 0.0.0.0 to localhost to enable secure microphone access!)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === '0.0.0.0') {
      window.location.hostname = 'localhost';
    }
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("token");
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Persistent State
  const [patients, setPatients] = useState<Patient[]>(() => {
    const cached = localStorage.getItem("hms_patients");
    return cached ? JSON.parse(cached) : initialPatients;
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => {
    const cached = localStorage.getItem("hms_doctors");
    return cached ? JSON.parse(cached) : initialDoctors;
  });

  const [wards, setWards] = useState<Ward[]>(() => {
    const cached = localStorage.getItem("hms_wards");
    return cached ? JSON.parse(cached) : initialWards;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const cached = localStorage.getItem("hms_appointments");
    return cached ? JSON.parse(cached) : initialAppointments;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const cached = localStorage.getItem("hms_invoices");
    return cached ? JSON.parse(cached) : initialInvoices;
  });

  // Write changes to cache
  useEffect(() => {
    localStorage.setItem("hms_patients", JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem("hms_doctors", JSON.stringify(doctors));
  }, [doctors]);

  useEffect(() => {
    localStorage.setItem("hms_wards", JSON.stringify(wards));
  }, [wards]);

  useEffect(() => {
    localStorage.setItem("hms_appointments", JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem("hms_invoices", JSON.stringify(invoices));
  }, [invoices]);

  // Connect Database to Frontend (Patients and Doctors)
  // Connect Database to Frontend (Patients, Doctors, and Appointments)
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = () => {
      api.getPatients().then((data) => {
        if (data && data.length > 0) {
          setPatients(data.map((p: any) => ({
            id: String(p.id),
            name: p.first_name + " " + p.last_name,
            dob: p.date_of_birth,
            gender: p.gender || "Other",
            phone: p.phone || "",
            email: p.email || "",
            insurance: "Unknown",
            emergencyContact: { name: "", phone: "", relationship: "" },
            medicalHistory: "None",
            allergies: "None reported",
            status: PatientStatus.OUTPATIENT
          })));
        }
      }).catch(console.error);

      api.getDoctors().then((data) => {
        if (data && data.length > 0) {
          setDoctors(data.map((d: any) => ({
            id: String(d.id),
            name: "Dr. " + d.first_name + " " + d.last_name,
            specialty: d.specialty as any,
            status: StaffStatus.ON_DUTY,
            email: d.email || "",
            phone: d.phone || "",
            room: "General"
          })));
        }
      }).catch(console.error);

      api.getAppointments().then((data) => {
        if (data && data.length > 0) {
          setAppointments(data.map((a: any) => ({
            id: String(a.id),
            patientId: String(a.patient_id),
            doctorId: String(a.doctor_id),
            date: a.appointment_date.split("T")[0],
            time: a.appointment_date.split("T")[1].substring(0, 5),
            reason: a.reason || "",
            urgency: (a.notes === "Critical" || a.notes === "Urgent" || a.notes === "Routine")
              ? a.notes
              : (a.reason?.toLowerCase().includes("chest") || a.reason?.toLowerCase().includes("heart") || a.reason?.toLowerCase().includes("severe") || a.reason?.toLowerCase().includes("pain"))
                ? "Urgent"
                : "Routine",
            status: a.status as any
          })));
        }
      }).catch(console.error);
    };

    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // CLINICAL HANDLERS & OPERATIONS
  const handleAddPatient = (pat: Patient) => {
    setPatients([pat, ...patients]);
  };

  const handleUpdatePatient = (updated: Patient) => {
    setPatients(patients.map(p => p.id === updated.id ? updated : p));
  };

  const handleAddDoctor = (doc: Doctor) => {
    setDoctors([doc, ...doctors]);
  };

  const handleUpdateDoctor = (updated: Doctor) => {
    setDoctors(doctors.map(d => d.id === updated.id ? updated : d));
  };

  const handleAddAppointment = (apt: Appointment) => {
    setAppointments([apt, ...appointments]);
    api.createAppointment({
      patient_id: parseInt(apt.patientId, 10),
      doctor_id: parseInt(apt.doctorId, 10),
      appointment_date: `${apt.date}T${apt.time}:00`,
      duration_minutes: 30,
      reason: apt.reason,
      notes: apt.urgency
    }).catch(console.error);
  };

  const handleUpdateAppointment = (updated: Appointment) => {
    setAppointments(appointments.map(a => a.id === updated.id ? updated : a));
    if (!updated.id.startsWith("apt-")) {
      api.updateAppointment(updated.id, {
        status: updated.status
      }).catch(console.error);
    }
  };

  const handleCancelAppointment = (aptId: string) => {
    setAppointments(appointments.map(a => a.id === aptId ? { ...a, status: AppointmentStatus.CANCELED } : a));
    if (!aptId.startsWith("apt-")) {
      api.updateAppointment(aptId, {
        status: AppointmentStatus.CANCELED
      }).catch(console.error);
    }
  };

  const handleAddInvoice = (inv: Invoice) => {
    setInvoices([inv, ...invoices]);
  };

  const handleUpdateInvoice = (updated: Invoice) => {
    setInvoices(invoices.map(i => i.id === updated.id ? updated : i));
  };

  const handleUpdateBedStatus = (wardId: string, bedId: string, nextStatus: BedStatus) => {
    setWards(wards.map(w => {
      if (w.id === wardId) {
        return {
          ...w,
          beds: w.beds.map(b => b.id === bedId ? { ...b, status: nextStatus, patientId: undefined } : b)
        };
      }
      return w;
    }));
  };

  // ADVANCED OPERATION: ADMIT PATIENT (Assigns Dr + Bed)
  const handleAdmitPatient = (patientId: string, doctorId: string, bedId: string) => {
    // 1. Update Patient's clinical status
    setPatients(patients.map(p => {
      if (p.id === patientId) {
        return {
          ...p,
          status: PatientStatus.ADMITTED,
          doctorId,
          bedId,
          admittedAt: new Date().toISOString()
        };
      }
      return p;
    }));

    // 2. Lock / Allocate bed node in targeted Ward
    setWards(wards.map(w => {
      return {
        ...w,
        beds: w.beds.map(b => {
          if (b.id === bedId) {
            return {
              ...b,
              status: BedStatus.OCCUPIED,
              patientId
            };
          }
          return b;
        })
      };
    }));
  };

  // ADVANCED OPERATION: DISCHARGE (Frees bed node & generates itemized Invoices immediately!)
  const handleDischargePatient = (patientId: string) => {
    const patientObj = patients.find(p => p.id === patientId);
    if (!patientObj) return;

    const admissionDate = patientObj.admittedAt ? new Date(patientObj.admittedAt) : new Date(Date.now() - 3 * 24 * 60 * 60 * 1050); // fallback 3 days
    const dischargeTime = new Date();
    const daysElapsed = Math.max(1, Math.ceil((dischargeTime.getTime() - admissionDate.getTime()) / (1000 * 3600 * 24)));

    // 1. Free Up physical Bed Node in Wards state
    let freedBedNumber = "N/A";
    let bedRate = 180; // defaults general ward rate
    
    setWards(wards.map(w => {
      const targetBed = w.beds.find(b => b.id === patientObj.bedId);
      if (targetBed) {
        freedBedNumber = targetBed.number;
        if (w.id === "ward-icu") bedRate = 1200;
        if (w.id === "ward-er") bedRate = 450;
        if (w.id === "ward-peds") bedRate = 250;
      }
      return {
        ...w,
        beds: w.beds.map(b => b.id === patientObj.bedId ? { ...b, status: BedStatus.AVAILABLE, patientId: undefined } : b)
      };
    }));

    // 2. Calculate clinical charge formulations & make invoice items
    const invoiceItems = [
      { description: `Standard Consultation (MD Ref: ${patientObj.doctorId || "General Staff"})`, amount: 150 },
      { description: `Ward Ingress Rent: ${freedBedNumber} (${daysElapsed} Nights @ $${bedRate}/night)`, amount: daysElapsed * bedRate }
    ];

    // Optional added dummy charges for medicine + tests
    if (patientObj.allergies !== "None reported") {
      invoiceItems.push({ description: "Clinical Allergy Profile Diagnostic Panel", amount: 180 });
    }
    invoiceItems.push({ description: "Operational Pharmacy Medicine Kit", amount: 75 });

    const totalInvoiceVal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

    const generatedInvoice: Invoice = {
      id: `inv-${Date.now().toString().slice(-4)}`,
      patientId,
      date: dischargeTime.toISOString().split("T")[0],
      items: invoiceItems,
      total: totalInvoiceVal,
      status: "Outstanding"
    };

    // 3. Discharge the Patient record
    setPatients(patients.map(p => {
      if (p.id === patientId) {
        return {
          ...p,
          status: PatientStatus.DISCHARGED,
          bedId: undefined,
          dischargedAt: dischargeTime.toISOString()
        };
      }
      return p;
    }));

    // 4. Save Invoice & smoothly transition to the Billing sheet
    setInvoices([generatedInvoice, ...invoices]);
    setSelectedPatientId(undefined); // blur target EHR
    setActiveTab("billing"); // smoothly jump to ledger sheet!
  };

  // CLINICAL AI ROUTING FAST-TRACK INGESTION
  const handleFastTrackAppointment = (data: {
    specialty: Specialty;
    urgency: "Routine" | "Urgent" | "Critical";
    reason: string;
  }) => {
    // 1. Go directly to schedule tab
    setActiveTab("appointments");
    // Pre-fill parameters and focus on creation log
    alert(`Fast-tracking complete! Clinical Router mapped this case as [${data.urgency}] Priority and referred to the [${data.specialty}] Team.`);
  };

  const navItems = [
    { id: "dashboard", label: "Executive Desk", icon: Activity },
    { id: "patients", label: "EHR Roster", icon: Users },
    { id: "doctors", label: "Physicians Directory", icon: Stethoscope },
    { id: "appointments", label: "Consult Scheduler", icon: Calendar },
    { id: "beds", label: "Ward Planner", icon: Bed },
    { id: "billing", label: "Revenue Ledger", icon: FileText },
    { id: "triage", label: "AI Symptom Router", icon: BrainCircuit },
    { id: "referrals", label: "Referrals", icon: FileSymlink },
    { id: "priorauth", label: "Prior Auth", icon: ShieldCheck },
    { id: "callcenter", label: "AI Agent", icon: PhoneCall }
  ];

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className={`min-h-screen text-neutral-800 flex flex-col md:flex-row font-sans transition-colors duration-300 ${
      activeTab === "callcenter" ? "bg-[#030712]" : "bg-zinc-50"
    }`}>
      
      {/* 1. SIDEBAR NAVIGATION - DESKTOP */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-zinc-900 text-zinc-350 shrink-0 border-r border-zinc-805/80 p-5 min-h-screen">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              H
            </div>
            <div>
              <p className="text-white text-xs font-bold font-sans tracking-tight">AI HMS</p>
              <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block">HMS Core v1.2</span>
            </div>
          </div>

          <nav id="sidebar-nav" className="space-y-1">
            {navItems.map(item => {
              const active = activeTab === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-xs font-semibold tracking-wide transition cursor-pointer ${
                    active 
                      ? "bg-zinc-800 text-white shadow-xs font-bold" 
                      : "text-zinc-300 hover:bg-zinc-850 hover:text-white"
                  }`}
                >
                  <IconComp className={`w-4 h-4 shrink-0 ${active ? "text-indigo-400" : "text-zinc-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>


      </aside>

      {/* 2. MOBILE HEADER & NAVIGATION */}
      <header className="md:hidden flex items-center justify-between bg-zinc-900 border-b border-zinc-800 p-4 shrink-0 text-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs">
            H
          </div>
          <span className="text-xs font-bold tracking-tight">AI HMS</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="p-1.5 hover:bg-zinc-800 rounded-lg"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* 3. MOBILE DROP-DOWN MENU DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-zinc-900 text-zinc-300 border-b border-zinc-800 p-4 space-y-3 shrink-0 absolute top-14 left-0 right-0 z-40 shadow-xl"
          >
            <nav className="space-y-1">
              {navItems.map(item => {
                const active = activeTab === item.id;
                const IconComp = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-semibold ${
                      active ? "bg-zinc-800 text-white" : "hover:bg-zinc-850 hover:text-white"
                    }`}
                  >
                    <IconComp className="w-4 h-4 text-zinc-450" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. MAIN VIEWPORT & WORKSPACE */}
      <main 
        id="main-viewport" 
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          activeTab === "callcenter"
            ? "p-0 bg-[#030712] w-full"
            : "p-4 md:p-8 bg-zinc-50 max-w-7xl mx-auto w-full"
        }`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeTab === "dashboard" && (
              <Dashboard 
                doctors={doctors}
                patients={patients}
                wards={wards}
                setActiveTab={setActiveTab}
                setSelectedPatientId={setSelectedPatientId}
              />
            )}

            {activeTab === "patients" && (
              <Patients 
                patients={patients}
                doctors={doctors}
                wards={wards}
                onAddPatient={handleAddPatient}
                onUpdatePatient={handleUpdatePatient}
                onAdmitPatient={handleAdmitPatient}
                onDischargePatient={handleDischargePatient}
                selectedPatientId={selectedPatientId}
                setSelectedPatientId={setSelectedPatientId}
              />
            )}

            {activeTab === "doctors" && (
              <Doctors 
                doctors={doctors}
                onAddDoctor={handleAddDoctor}
                onUpdateDoctor={handleUpdateDoctor}
              />
            )}

            {activeTab === "appointments" && (
              <Appointments 
                appointments={appointments}
                patients={patients}
                doctors={doctors}
                onAddAppointment={handleAddAppointment}
                onUpdateAppointment={handleUpdateAppointment}
                onCancelAppointment={handleCancelAppointment}
              />
            )}

            {activeTab === "beds" && (
              <Beds 
                wards={wards}
                patients={patients}
                doctors={doctors}
                onAdmitPatient={handleAdmitPatient}
                onUpdateBedStatus={handleUpdateBedStatus}
              />
            )}

            {activeTab === "billing" && (
              <Billing 
                invoices={invoices}
                patients={patients}
                onAddInvoice={handleAddInvoice}
                onUpdateInvoice={handleUpdateInvoice}
              />
            )}

            {activeTab === "triage" && (
              <Triage 
                onFastTrackAppointment={handleFastTrackAppointment}
              />
            )}

            {activeTab === "referrals" && <Referrals />}
            {activeTab === "priorauth" && <PriorAuth />}
            {activeTab === "callcenter" && <AICallCenter />}
          </motion.div>
        </AnimatePresence>
      </main>

      <LedgerChatWidget doctors={doctors} />
    </div>
  );
}
