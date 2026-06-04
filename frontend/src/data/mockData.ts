import { 
  Doctor, 
  Specialty, 
  StaffStatus, 
  Patient, 
  PatientStatus, 
  Ward, 
  WardType, 
  BedStatus, 
  Appointment, 
  AppointmentStatus, 
  Invoice 
} from "../types";

export const initialDoctors: Doctor[] = [
  {
    id: "doc-1",
    name: "Dr. Elena Rostova",
    specialty: Specialty.CARDIOLOGY,
    status: StaffStatus.ON_DUTY,
    email: "e.rostova@stjude.org",
    phone: "+1 (555) 019-2834",
    room: "Cardiology Suite 402"
  },
  {
    id: "doc-2",
    name: "Dr. Marcus Vance",
    specialty: Specialty.NEUROLOGY,
    status: StaffStatus.ACTIVE_CONSULT,
    email: "m.vance@stjude.org",
    phone: "+1 (555) 014-9872",
    room: "Neurology Wing 305"
  },
  {
    id: "doc-3",
    name: "Dr. Sarah Jenkins",
    specialty: Specialty.PEDIATRICS,
    status: StaffStatus.ON_DUTY,
    email: "s.jenkins@stjude.org",
    phone: "+1 (555) 012-3456",
    room: "Pediatrics Cabin 112"
  },
  {
    id: "doc-4",
    name: "Dr. Alan Mercer",
    specialty: Specialty.ORTHOPEDICS,
    status: StaffStatus.OFF_DUTY,
    email: "a.mercer@stjude.org",
    phone: "+1 (555) 017-3849",
    room: "Orthopedic Lab 201"
  },
  {
    id: "doc-5",
    name: "Dr. Priya Patel",
    specialty: Specialty.GENERAL_MEDICINE,
    status: StaffStatus.ON_DUTY,
    email: "p.patel@stjude.org",
    phone: "+1 (555) 015-6712",
    room: "Consultation Block B"
  },
  {
    id: "doc-6",
    name: "Dr. Arthur Pendelton",
    specialty: Specialty.EMERGENCY,
    status: StaffStatus.ON_DUTY,
    email: "a.pendelton@stjude.org",
    phone: "+1 (555) 011-2233",
    room: "Trauma Room 1"
  }
];

export const initialPatients: Patient[] = [
  {
    id: "pat-1",
    name: "Alexander Mercer",
    dob: "1984-08-12",
    gender: "Male",
    phone: "+1 (555) 301-3841",
    email: "alex.mercer@gmail.com",
    insurance: "Blue Cross PeakCare",
    emergencyContact: {
      name: "Sophia Mercer",
      phone: "+1 (555) 301-3842",
      relationship: "Spouse"
    },
    medicalHistory: "Prior knee arthroscopy in 2019. Mild asthma managed via Albuterol inhaler.",
    allergies: "Penicillin, Strawberries",
    status: PatientStatus.ADMITTED,
    doctorId: "doc-4",
    bedId: "bed-gen-1",
    admittedAt: "2026-05-18T10:30:00Z"
  },
  {
    id: "pat-2",
    name: "Eleanor Hayes",
    dob: "1962-02-27",
    gender: "Female",
    phone: "+1 (555) 890-4102",
    email: "eleanor.hayes@outlook.com",
    insurance: "Aetna Health Prime",
    emergencyContact: {
      name: "David Hayes",
      phone: "+1 (555) 890-4103",
      relationship: "Son"
    },
    medicalHistory: "Chronic hypertension diagnosed in 2015. Type 2 diabetes regulated with Metformin.",
    allergies: "Sulfa Drugs",
    status: PatientStatus.ADMITTED,
    doctorId: "doc-1",
    bedId: "bed-icu-1",
    admittedAt: "2026-05-20T14:15:00Z"
  },
  {
    id: "pat-3",
    name: "Leo Fitzgerald",
    dob: "2018-11-05",
    gender: "Male",
    phone: "+1 (555) 412-1922",
    email: "marsha.fitz@gmail.com",
    insurance: "UnitedHealthcare",
    emergencyContact: {
      name: "Marsha Fitzgerald",
      phone: "+1 (555) 412-1923",
      relationship: "Mother"
    },
    medicalHistory: "Recurrent tonsillitis. Up-to-date on all pediatric immunizations.",
    allergies: "None reported",
    status: PatientStatus.OUTPATIENT,
    doctorId: "doc-3"
  },
  {
    id: "pat-4",
    name: "Clarissa Vance",
    dob: "1991-05-19",
    gender: "Female",
    phone: "+1 (555) 702-8833",
    email: "c.vance@yahoo.com",
    insurance: "Cigna CareGold",
    emergencyContact: {
      name: "William Vance",
      phone: "+1 (555) 702-8834",
      relationship: "Father"
    },
    medicalHistory: "Migraines with visual aura. Family history of stroke.",
    allergies: "Aspirin",
    status: PatientStatus.DISCHARGED,
    doctorId: "doc-2",
    admittedAt: "2026-05-15T09:00:00Z",
    dischargedAt: "2026-05-19T16:00:00Z"
  },
  {
    id: "pat-5",
    name: "Benjamin Zhao",
    dob: "1975-12-30",
    gender: "Male",
    phone: "+1 (555) 124-9125",
    email: "ben.zhao@ucsf.edu",
    insurance: "No Insurance (Self-Pay)",
    emergencyContact: {
      name: "Sherry Zhao",
      phone: "+1 (555) 124-9126",
      relationship: "Sister"
    },
    medicalHistory: "Hyperlipidemia. Regular jogger.",
    allergies: "Peanuts",
    status: PatientStatus.OUTPATIENT,
    doctorId: "doc-5"
  }
];

export const initialWards: Ward[] = [
  {
    id: "ward-icu",
    name: "Intensive Care Unit",
    type: WardType.ICU,
    beds: [
      { id: "bed-icu-1", wardId: "ward-icu", number: "ICU-101", status: BedStatus.OCCUPIED, patientId: "pat-2" },
      { id: "bed-icu-2", wardId: "ward-icu", number: "ICU-102", status: BedStatus.AVAILABLE },
      { id: "bed-icu-3", wardId: "ward-icu", number: "ICU-103", status: BedStatus.AVAILABLE },
      { id: "bed-icu-4", wardId: "ward-icu", number: "ICU-104", status: BedStatus.MAINTENANCE }
    ]
  },
  {
    id: "ward-gen",
    name: "General Medical Ward",
    type: WardType.GENERAL,
    beds: [
      { id: "bed-gen-1", wardId: "ward-gen", number: "GEN-201", status: BedStatus.OCCUPIED, patientId: "pat-1" },
      { id: "bed-gen-2", wardId: "ward-gen", number: "GEN-202", status: BedStatus.AVAILABLE },
      { id: "bed-gen-3", wardId: "ward-gen", number: "GEN-203", status: BedStatus.AVAILABLE },
      { id: "bed-gen-4", wardId: "ward-gen", number: "GEN-204", status: BedStatus.AVAILABLE },
      { id: "bed-gen-5", wardId: "ward-gen", number: "GEN-205", status: BedStatus.AVAILABLE },
      { id: "bed-gen-6", wardId: "ward-gen", number: "GEN-206", status: BedStatus.AVAILABLE }
    ]
  },
  {
    id: "ward-peds",
    name: "Pediatric Care Pavilion",
    type: WardType.PEDIATRICS,
    beds: [
      { id: "bed-peds-1", wardId: "ward-peds", number: "PED-301", status: BedStatus.AVAILABLE },
      { id: "bed-peds-2", wardId: "ward-peds", number: "PED-302", status: BedStatus.AVAILABLE },
      { id: "bed-peds-3", wardId: "ward-peds", number: "PED-303", status: BedStatus.AVAILABLE },
      { id: "bed-peds-4", wardId: "ward-peds", number: "PED-304", status: BedStatus.MAINTENANCE }
    ]
  },
  {
    id: "ward-er",
    name: "Emergency Trauma Observation",
    type: WardType.EMERGENCY,
    beds: [
      { id: "bed-er-1", wardId: "ward-er", number: "ER-A", status: BedStatus.AVAILABLE },
      { id: "bed-er-2", wardId: "ward-er", number: "ER-B", status: BedStatus.AVAILABLE },
      { id: "bed-er-3", wardId: "ward-er", number: "ER-C", status: BedStatus.AVAILABLE }
    ]
  }
];

export const initialAppointments: Appointment[] = [
  {
    id: "apt-1",
    patientId: "pat-3",
    doctorId: "doc-3",
    date: "2026-05-21",
    time: "10:30",
    reason: "Monthly pediatric checkup and mild tonsil swelling monitoring.",
    urgency: "Routine",
    status: AppointmentStatus.SCHEDULED
  },
  {
    id: "apt-2",
    patientId: "pat-5",
    doctorId: "doc-5",
    date: "2026-05-21",
    time: "11:15",
    reason: "Severe recurring migraines and follow-up on therapeutic response to dietary shifts.",
    urgency: "Urgent",
    status: AppointmentStatus.CHECKED_IN
  },
  {
    id: "apt-3",
    patientId: "pat-1",
    doctorId: "doc-4",
    date: "2026-05-19",
    time: "14:00",
    reason: "Post-admission orthopaedic surgery consultation and suture inspection.",
    urgency: "Routine",
    status: AppointmentStatus.COMPLETED
  }
];

export const initialInvoices: Invoice[] = [
  {
    id: "inv-1",
    patientId: "pat-4",
    date: "2026-05-19",
    items: [
      { description: "Standard Consultation Fee (Neurology Wing)", amount: 150 },
      { description: "Bed Rent - General Ward (4 Nights @ $120/night)", amount: 480 },
      { description: "Migraine Therapeutics (Intravenous)", amount: 95 },
      { description: "CT Brain Scan & Interpretation", amount: 620 }
    ],
    total: 1345,
    status: "Paid"
  },
  {
    id: "inv-2",
    patientId: "pat-1",
    date: "2026-05-21",
    items: [
      { description: "Emergency Orthopaedic Triage Visit", amount: 200 },
      { description: "X-Ray Joint Imaging Bilateral", amount: 280 },
      { description: "General Ward Admission Bed Deposit", amount: 300 }
    ],
    total: 780,
    status: "Outstanding"
  }
];
