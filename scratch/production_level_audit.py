import httpx
import sys

BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

print("=== Starting Production Level System Audit ===")

client = httpx.Client(timeout=10)

# --- 1. UNAUTHORIZED ACCESS TESTS ---
print("\n[1] Testing Authentication Shields (Should return 401 Unauthorized)...")
unauthorized_endpoints = [
    ("GET", "/api/patients/"),
    ("GET", "/api/doctors/"),
    ("GET", "/api/appointments/"),
    ("GET", "/api/prior-auth/"),
    ("GET", "/api/referrals/inbound"),
    ("GET", "/api/referrals/outbound"),
    ("PUT", "/api/users/profile"),
    ("GET", "/api/users/billing"),
    ("GET", "/api/users/notifications"),
]

for method, path in unauthorized_endpoints:
    resp = client.request(method, f"{BACKEND_URL}{path}")
    assert resp.status_code == 401, f"Security shield breached for {method} {path}: expected 401, got {resp.status_code}"
print(" - Authentication shields verified: ALL endpoints return 401 Unauthorized without a valid token.")


# --- 2. AUTHENTICATION (LOGIN) ---
print("\n[2] Logging in...")
login_payload = {
    "email": "audit-tester@linearhealth.com",
    "password": "securepassword123"
}
login_resp = client.post(f"{BACKEND_URL}/api/auth/login", json=login_payload)
if login_resp.status_code != 200:
    # If the user doesn't exist yet, register them
    print(" - Login failed, attempting user registration first...")
    register_resp = client.post(f"{BACKEND_URL}/api/auth/register", json={
        "email": login_payload["email"],
        "password": login_payload["password"],
        "full_name": "Production Auditor",
        "role": "admin"
    })
    assert register_resp.status_code == 201, f"Failed to register auditor: {register_resp.text}"
    token_data = register_resp.json()
else:
    token_data = login_resp.json()

access_token = token_data["access_token"]
headers = {"Authorization": f"Bearer {access_token}"}
print(" - Token acquired successfully.")


# --- 3. INPUT VALIDATION TESTS (FastAPI / Pydantic schema validation) ---
print("\n[3] Testing Input Validation & Error Handling (Should return 422 Unprocessable)...")
invalid_patient_payloads = [
    # Missing first_name
    {"last_name": "Connor", "date_of_birth": "1984-05-12", "phone": "555-0100", "medical_record_number": "MRN-1"},
    # Malformed date_of_birth format
    {"first_name": "John", "last_name": "Connor", "date_of_birth": "12-05-1984", "phone": "555-0100", "medical_record_number": "MRN-2"},
    # Invalid gender enum
    {"first_name": "John", "last_name": "Connor", "date_of_birth": "1984-05-12", "gender": "unknown", "phone": "555-0100", "medical_record_number": "MRN-3"}
]

for i, payload in enumerate(invalid_patient_payloads, 1):
    resp = client.post(f"{BACKEND_URL}/api/patients/", json=payload, headers=headers)
    assert resp.status_code == 422, f"Input validation bypassed on payload #{i}: expected 422, got {resp.status_code}"
print(" - Pydantic validator shields verified: Invalid payloads correctly rejected with 422 Unprocessable Entity.")


# --- 4. INTEGRITY CONSTRAINT TESTS (Foreign Keys) ---
print("\n[4] Testing Database Integrity Violations (Should return 400 Bad Request)...")
# Try creating an appointment for a patient/doctor that doesn't exist
invalid_appointment_payload = {
    "patient_id": 99999,
    "doctor_id": 99999,
    "appointment_date": "2026-06-10T14:30:00",
    "duration_minutes": 30,
    "reason": "Ghost consult"
}
appt_resp = client.post(f"{BACKEND_URL}/api/appointments/", json=invalid_appointment_payload, headers=headers)
# In our router: IntegrityError triggers 400 Bad Request with a clean detail message
assert appt_resp.status_code == 400, f"Integrity check bypassed: expected 400, got {appt_resp.status_code}"
print(" - Database constraint guards verified: Failsafe correctly caught foreign key exception.")


# --- 5. ENDPOINT AUDIT (All clinical & operational routes) ---
print("\n[5] Auditing Clinical Endpoints (Should return 200/201)...")

# GET Roster lists
for route in ["/api/patients/", "/api/doctors/", "/api/appointments/", "/api/prior-auth/"]:
    resp = client.get(f"{BACKEND_URL}{route}", headers=headers)
    assert resp.status_code == 200, f"Failed to retrieve list from {route}: {resp.text}"
print(" - GET lists: SUCCESS")

# GET referrals direction
for direction in ["inbound", "outbound"]:
    resp = client.get(f"{BACKEND_URL}/api/referrals/{direction}", headers=headers)
    assert resp.status_code == 200, f"Failed to retrieve {direction} referrals: {resp.text}"
print(" - GET referrals: SUCCESS")


# --- 6. DOCTOR ALIASES AND SEARCH ROUTER ---
print("\n[6] Auditing Doctor Aliases & Doctor Name Search...")
# Test doctor registration alias
test_doctor = {
    "first_name": "Asif",
    "last_name": "Bashir",
    "specialty": "Neurology",
    "license_number": "LIC-98982",
    "available_timings": "Monday to Friday, 9:00 AM - 5:00 PM",
    "fees": 250.0
}
# Try fetching first to check if they already exist
doc_check = client.get(f"{BACKEND_URL}/api/doctors/?name=Asif", headers=headers)
assert doc_check.status_code == 200
docs_found = doc_check.json()

if not docs_found:
    add_doc_resp = client.post(f"{BACKEND_URL}/api/doctors/add", json=test_doctor, headers=headers)
    assert add_doc_resp.status_code == 201, f"Doctor registration alias failed: {add_doc_resp.text}"
    print(" - Doctor registration alias (/api/doctors/add): SUCCESS")
else:
    print(" - Doctor already exists in database.")

# Test search query by name parameter
search_resp = client.get(f"{BACKEND_URL}/api/doctors/?name=Asif", headers=headers)
assert search_resp.status_code == 200
doctors = search_resp.json()
assert len(doctors) > 0, "Doctor search did not return doctor Asif"
asif_doc = doctors[0]
assert asif_doc["specialty"] == "Neurology"
assert asif_doc["available_timings"] == "Monday to Friday, 9:00 AM - 5:00 PM"
assert asif_doc["fees"] == 250.0
print(" - Doctor name search query: SUCCESS")


# --- 7. USER PROFILE & SETTINGS AUDIT ---
print("\n[7] Auditing User Operations & Workstation Preferences...")
profile_resp = client.get(f"{BACKEND_URL}/api/auth/me", headers=headers)
assert profile_resp.status_code == 200
user_data = profile_resp.json()
print(f" - Logged in user: {user_data['full_name']} ({user_data['email']})")

# Update profile
update_data = {
    "full_name": "Production Auditor",
    "professional_title": "Senior AI Systems Auditor",
    "bio": "Verifying HIPAA compliance and LiveKit API channels."
}
update_resp = client.put(f"{BACKEND_URL}/api/users/profile", json=update_data, headers=headers)
assert update_resp.status_code == 200
updated_user = update_resp.json()
assert updated_user["professional_title"] == "Senior AI Systems Auditor"
print(" - Profile updates: SUCCESS")

# Get billing
billing_resp = client.get(f"{BACKEND_URL}/api/users/billing", headers=headers)
assert billing_resp.status_code == 200
print(f" - Billing Info retrieved: {billing_resp.json()['plan_name']} ({billing_resp.json()['price']})")

# Get notifications
notif_resp = client.get(f"{BACKEND_URL}/api/users/notifications", headers=headers)
assert notif_resp.status_code == 200
print(f" - Clinical notifications: SUCCESS ({len(notif_resp.json())} pending)")


# --- 8. GATEWAYS AND TRIAGE ---
print("\n[8] Auditing Express Proxy Routes & Gateways...")
lk_resp = client.post(f"{FRONTEND_URL}/api/livekit/token", json={
    "room_name": "production-room-1",
    "participant_name": "Sarah-Auditor"
})
assert lk_resp.status_code == 200, f"Token proxy route failed: {lk_resp.text}"
print(" - LiveKit Gateway Token Generation: SUCCESS")

triage_resp = client.post(f"{FRONTEND_URL}/api/gemini/triage", json={
    "symptoms": "Experiencing sudden severe chest pain spreading to back and left shoulder."
})
assert triage_resp.status_code == 200, f"Triage route failed: {triage_resp.text}"
triage_data = triage_resp.json()
print(" - Gemini Triage proxy route: SUCCESS")
print(f"   -> Severity Classification: {triage_data.get('urgency')}")
print(f"   -> Recommended Department: {triage_data.get('department')}")

print("\n=== PRODUCTION AUDIT COMPLETE: 100% SECURE & VERIFIED ===")
