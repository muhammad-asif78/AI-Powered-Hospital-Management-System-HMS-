export enum Specialty {
  GENERAL_MEDICINE = "General Medicine",
  CARDIOLOGY = "Cardiology",
  PEDIATRICS = "Pediatrics",
  NEUROLOGY = "Neurology",
  ORTHOPEDICS = "Orthopedics",
  EMERGENCY = "Emergency Medicine"
}

export enum StaffStatus {
  ON_DUTY = "On Duty",
  ACTIVE_CONSULT = "Active Consult",
  OFF_DUTY = "Off Duty"
}

export interface Doctor {
  id: string;
  name: string;
  specialty: Specialty;
  status: StaffStatus;
  email: string;
  phone: string;
  room: string;
}

export enum BedStatus {
  AVAILABLE = "Available",
  OCCUPIED = "Occupied",
  MAINTENANCE = "Maintenance"
}

export enum WardType {
  GENERAL = "General Ward",
  ICU = "Intensive Care Unit (ICU)",
  PEDIATRICS = "Pediatric Ward",
  EMERGENCY = "Emergency Ward"
}

export interface Bed {
  id: string;
  wardId: string;
  number: string;
  status: BedStatus;
  patientId?: string;
}

export interface Ward {
  id: string;
  name: string;
  type: WardType;
  beds: Bed[];
}

export enum PatientStatus {
  OUTPATIENT = "Outpatient",
  ADMITTED = "Admitted",
  DISCHARGED = "Discharged"
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  insurance: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalHistory: string;
  allergies: string;
  status: PatientStatus;
  doctorId?: string; // Assigned doctor
  bedId?: string; // Assigned bed
  admittedAt?: string;
  dischargedAt?: string;
}

export enum AppointmentStatus {
  SCHEDULED = "Scheduled",
  CHECKED_IN = "Checked In",
  COMPLETED = "Completed",
  CANCELED = "Canceled"
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  reason: string;
  urgency: "Routine" | "Urgent" | "Critical";
  status: AppointmentStatus;
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  patientId: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  status: "Paid" | "Outstanding";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  type?: "triage_result";
  triageData?: {
    urgency: "Critical" | "Urgent" | "Routine";
    department: Specialty;
    actions: string[];
    justification: string;
    nextSteps: string[];
  };
}
