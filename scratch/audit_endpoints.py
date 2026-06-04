import httpx
import sys

BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

print("=== Starting E2E System Audit ===")

client = httpx.Client(timeout=10)

# 1. User Registration / Login
print("\n[1] Testing Auth Endpoints...")
test_user = {
    "email": "audit-tester@linearhealth.com",
    "password": "securepassword123",
    "full_name": "Audit Tester User",
    "role": "admin"
}

# Try registering
register_resp = client.post(f"{BACKEND_URL}/api/auth/register", json=test_user)
if register_resp.status_code == 201:
    print(" - Register: SUCCESS (Created new user)")
    token_data = register_resp.json()
elif register_resp.status_code == 400 and "already registered" in register_resp.text:
    print(" - Register: SUCCESS (User already exists)")
    # Login instead
    login_resp = client.post(f"{BACKEND_URL}/api/auth/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token_data = login_resp.json()
else:
    print(f" - Register: FAILED ({register_resp.status_code}): {register_resp.text}")
    sys.exit(1)

access_token = token_data["access_token"]
headers = {"Authorization": f"Bearer {access_token}"}

# Fetch me
me_resp = client.get(f"{BACKEND_URL}/api/auth/me", headers=headers)
assert me_resp.status_code == 200, f"/api/auth/me failed: {me_resp.text}"
print(f" - Auth Me: SUCCESS (Logged in as {me_resp.json()['full_name']})")


# 2. Patient Creation & Listing
print("\n[2] Testing Patient Endpoints...")
patient_count = int(httpx.Client().get(f'{BACKEND_URL}/api/patients/', headers=headers).json().__len__())
patient_payload = {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1990-01-15",
    "gender": "male",  # Must be lowercase enum
    "email": f"johndoe-{patient_count + 1000}@example.com",  # Unique email to avoid IntegrityError
    "phone": "555-0199",
    "medical_record_number": f"MRN-{patient_count + 1000}"
}
pat_create_resp = client.post(f"{BACKEND_URL}/api/patients/", json=patient_payload, headers=headers)
assert pat_create_resp.status_code == 201, f"Patient creation failed: {pat_create_resp.text}"
created_patient = pat_create_resp.json()
patient_id = created_patient["id"]
print(f" - Create Patient: SUCCESS (ID: {patient_id}, MRN: {created_patient.get('medical_record_number')})")

# Get list of patients
patients_list_resp = client.get(f"{BACKEND_URL}/api/patients/", headers=headers)
assert patients_list_resp.status_code == 200, f"Patient list failed: {patients_list_resp.text}"
patients = patients_list_resp.json()
assert any(p["id"] == patient_id for p in patients), "Created patient not found in roster list"
print(f" - List Patients: SUCCESS ({len(patients)} patients found)")

# Get specific patient
patient_get_resp = client.get(f"{BACKEND_URL}/api/patients/{patient_id}", headers=headers)
assert patient_get_resp.status_code == 200, f"Patient get failed: {patient_get_resp.text}"
print(f" - Get Patient details: SUCCESS")


# 3. Doctor Creation & Listing
print("\n[3] Testing Doctor Endpoints...")
doctor_count = int(httpx.Client().get(f'{BACKEND_URL}/api/doctors/', headers=headers).json().__len__())
doctor_payload = {
    "first_name": "Sarah",
    "last_name": "Connor",
    "specialty": "Cardiology",
    "license_number": f"LIC-{doctor_count + 10000}",
    "email": f"sarah.connor-{doctor_count + 10000}@linearhealth.com",  # Unique email to avoid IntegrityError
    "phone": "555-0188"
}
doc_create_resp = client.post(f"{BACKEND_URL}/api/doctors/", json=doctor_payload, headers=headers)
assert doc_create_resp.status_code == 201, f"Doctor creation failed: {doc_create_resp.text}"
created_doctor = doc_create_resp.json()
doctor_id = created_doctor["id"]
print(f" - Create Doctor: SUCCESS (ID: {doctor_id}, Specialty: {created_doctor.get('specialty')})")

# Get list of doctors
doctors_list_resp = client.get(f"{BACKEND_URL}/api/doctors/", headers=headers)
assert doctors_list_resp.status_code == 200, f"Doctors list failed: {doctors_list_resp.text}"
doctors = doctors_list_resp.json()
assert any(d["id"] == doctor_id for d in doctors), "Created doctor not found in directory list"
print(f" - List Doctors: SUCCESS ({len(doctors)} doctors found)")


# 4. Consult Scheduling & Listing
print("\n[4] Testing Appointment Scheduler...")
appointment_payload = {
    "patient_id": patient_id,
    "doctor_id": doctor_id,
    "appointment_date": "2026-06-10T14:30:00",
    "duration_minutes": 30,
    "reason": "Routine cardiac checkup"
}
apt_create_resp = client.post(f"{BACKEND_URL}/api/appointments/", json=appointment_payload, headers=headers)
assert apt_create_resp.status_code == 201, f"Appointment creation failed: {apt_create_resp.text}"
created_apt = apt_create_resp.json()
apt_id = created_apt["id"]
print(f" - Create Appointment: SUCCESS (ID: {apt_id}, Date: {created_apt.get('appointment_date')})")

# List appointments
apts_list_resp = client.get(f"{BACKEND_URL}/api/appointments/", headers=headers)
assert apts_list_resp.status_code == 200, f"Appointments list failed: {apts_list_resp.text}"
apts = apts_list_resp.json()
assert any(a["id"] == apt_id for a in apts), "Created appointment not found in schedules"
print(f" - List Appointments: SUCCESS ({len(apts)} appointments scheduled)")


# 5. Referrals
print("\n[5] Testing Referral Endpoints...")
inbound_referral = {
    "referring_provider_name": "St. Jude Clinic",
    "referring_provider_npi": "1234567890",
    "referring_facility": "St. Jude Heart Center",
    "referral_date": "2026-06-01",
    "reason": "Mitral valve assessment",
    "clinical_notes": "Slight murmur detected during school physical.",
    "patient_id": patient_id
}
in_ref_resp = client.post(f"{BACKEND_URL}/api/referrals/inbound", json=inbound_referral, headers=headers)
assert in_ref_resp.status_code == 201, f"Inbound referral failed: {in_ref_resp.text}"
print(f" - Create Inbound Referral: SUCCESS (ID: {in_ref_resp.json()['id']})")

outbound_referral = {
    "patient_id": patient_id,
    "referring_doctor_id": doctor_id,
    "referred_to_provider": "Dr. Charles Xavier",
    "referred_to_facility": "Xavier Institute",
    "referred_to_specialty": "Neurology",
    "referral_date": "2026-06-01",
    "reason": "EEG diagnostics",
    "clinical_summary": "Experiencing unexplained focal spells."
}
out_ref_resp = client.post(f"{BACKEND_URL}/api/referrals/outbound", json=outbound_referral, headers=headers)
assert out_ref_resp.status_code == 201, f"Outbound referral failed: {out_ref_resp.text}"
print(f" - Create Outbound Referral: SUCCESS (ID: {out_ref_resp.json()['id']})")


# 6. Prior Authorization
print("\n[6] Testing Prior Authorization...")
prior_auth_payload = {
    "patient_id": patient_id,
    "doctor_id": doctor_id,
    "insurance_provider_id": 1,
    "procedure_code": "CPT-93000",
    "procedure_description": "Electrocardiogram (ECG) profiling",
    "diagnosis_code": "ICD-10-R07.9",
    "clinical_justification": "History of palpitations and atypical discomfort."
}
pa_create_resp = client.post(f"{BACKEND_URL}/api/prior-auth/", json=prior_auth_payload, headers=headers)
assert pa_create_resp.status_code == 201, f"Prior auth failed: {pa_create_resp.text}"
print(f" - Submit Prior Auth: SUCCESS (ID: {pa_create_resp.json()['id']}, Status: {pa_create_resp.json().get('status')})")


# 7. Dashboard Ops
print("\n[7] Testing Dashboard Stats...")
stats_resp = client.get(f"{BACKEND_URL}/api/dashboard/stats", headers=headers)
assert stats_resp.status_code == 200, f"Stats failed: {stats_resp.text}"
print(" - Operational Stats: SUCCESS")


# 8. User Profile & Settings
print("\n[8] Testing User Profile & Setting Endpoints...")
profile_update = {
    "professional_title": "Lead Clinical Systems Auditor",
    "bio": "E2E testing agent and workspace auditor."
}
profile_resp = client.put(f"{BACKEND_URL}/api/users/profile", json=profile_update, headers=headers)
assert profile_resp.status_code == 200, f"Profile update failed: {profile_resp.text}"
print(" - Update Profile details: SUCCESS")

billing_resp = client.get(f"{BACKEND_URL}/api/users/billing", headers=headers)
assert billing_resp.status_code == 200, f"Get billing details failed: {billing_resp.text}"
print(" - Get Billing details: SUCCESS")


# 9. LiveKit Web Gateway
print("\n[9] Testing LiveKit Token Dispatch Gateway...")
lk_resp = client.post(f"{FRONTEND_URL}/api/livekit/token", json={
    "room_name": "audit-room-final",
    "participant_name": "patient-audit"
})
assert lk_resp.status_code == 200, f"LiveKit token failed: {lk_resp.text}"
print(" - LiveKit Token Dispatch: SUCCESS")


# 10. Local AI Symptom Routing (Express / Gemini proxy)
print("\n[10] Testing AI Receptionist Symptom Triage Router...")
triage_resp = client.post(f"{FRONTEND_URL}/api/gemini/triage", json={
    "symptoms": "Experiencing breathing difficulty, severe fatigue, and high body temperature."
})
assert triage_resp.status_code == 200, f"Triage failed: {triage_resp.text}"
triage_data = triage_resp.json()
print(" - AI Triage routing: SUCCESS")
print(f"   -> Calculated Urgency Level: {triage_data.get('urgency')}")
print(f"   -> Directed Specialty Dept: {triage_data.get('department')}")

print("\n=== SYSTEM AUDIT COMPLETED: 100% SUCCESS ===")
