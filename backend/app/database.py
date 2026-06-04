"""Async PostgreSQL database engine and session management."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def seed_data(session: AsyncSession):
    """Seed default doctors, patients, appointments, and referrals if not present."""
    from app.models import Doctor, Patient, Gender, Appointment, AppointmentStatus, InboundReferral, ReferralStatus
    from datetime import date, datetime, timedelta
    
    # 1. Seed Doctors
    doc_result = await session.execute(select(Doctor))
    doctors = doc_result.scalars().all()
    if not doctors:
        doctors = [
            Doctor(first_name="Arthur", last_name="Conan", specialty="Cardiology", license_number="LIC-12345", phone="555-0101", email="conan@linearhealth.com", is_accepting_patients=True),
            Doctor(first_name="Sarah", last_name="Wilson", specialty="Neurology", license_number="LIC-67890", phone="555-0102", email="wilson@linearhealth.com", is_accepting_patients=True),
            Doctor(first_name="Gregory", last_name="House", specialty="Infectious Diseases", license_number="LIC-55555", phone="555-0103", email="house@linearhealth.com", is_accepting_patients=True)
        ]
        session.add_all(doctors)
        await session.flush()

    # 2. Seed Patients
    pat_result = await session.execute(select(Patient))
    patients = pat_result.scalars().all()
    if not patients:
        patients = [
            Patient(first_name="John", last_name="Doe", date_of_birth=date(1985, 5, 15), gender=Gender.male, email="john.doe@gmail.com", phone="555-0201", address="123 Main St, Boston MA", medical_record_number="MRN-882910"),
            Patient(first_name="Jane", last_name="Smith", date_of_birth=date(1990, 8, 20), gender=Gender.female, email="jane.smith@gmail.com", phone="555-0202", address="456 Elm St, New York NY", medical_record_number="MRN-773829"),
            Patient(first_name="Robert", last_name="Johnson", date_of_birth=date(1972, 12, 10), gender=Gender.male, email="robert.j@gmail.com", phone="555-0203", address="789 Oak Ave, Chicago IL", medical_record_number="MRN-994821")
        ]
        session.add_all(patients)
        await session.flush()

    # 3. Seed Appointments
    appt_result = await session.execute(select(Appointment))
    existing_appts = appt_result.scalars().all()
    if not existing_appts and doctors and patients:
        appointments = [
            Appointment(patient_id=patients[0].id, doctor_id=doctors[0].id, appointment_date=datetime.now() + timedelta(hours=2), duration_minutes=30, status=AppointmentStatus.scheduled, reason="Routine cardiovascular follow-up"),
            Appointment(patient_id=patients[1].id, doctor_id=doctors[1].id, appointment_date=datetime.now() - timedelta(hours=3), duration_minutes=45, status=AppointmentStatus.completed, reason="Migraine headache consultation"),
            Appointment(patient_id=patients[2].id, doctor_id=doctors[2].id, appointment_date=datetime.now() + timedelta(hours=5), duration_minutes=30, status=AppointmentStatus.scheduled, reason="Unexplained fever evaluation")
        ]
        session.add_all(appointments)

    # 4. Seed Inbound Referrals
    ref_result = await session.execute(select(InboundReferral))
    existing_refs = ref_result.scalars().all()
    if not existing_refs and patients:
        referrals = [
            InboundReferral(patient_id=patients[0].id, referring_provider_name="Dr. Lisa Cuddy", referring_provider_npi="1982736450", referring_facility="Princeton Plainsboro", referral_date=date.today(), reason="Needs cardiologist review", status=ReferralStatus.pending, insurance_verified=True),
            InboundReferral(patient_id=patients[1].id, referring_provider_name="Dr. Eric Foreman", referring_provider_npi="1029384756", referring_facility="Mercy Hospital", referral_date=date.today() - timedelta(days=2), reason="Persistent neurological aura", status=ReferralStatus.accepted, insurance_verified=True)
        ]
        session.add_all(referrals)


async def init_db():
    """Create all tables and seed default admin user on startup."""
    import app.models  # Ensure all models are registered on Base.metadata before table creation
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed admin user
    from app.models import User, UserRole
    from app.security import hash_password
    import logging
    logger = logging.getLogger("linear_health")

    try:
        async with async_session() as session:
            result = await session.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
            admin = result.scalar_one_or_none()
            
            if not admin:
                admin = User(
                    email=settings.ADMIN_EMAIL,
                    hashed_password=hash_password(settings.ADMIN_PASSWORD),
                    full_name="System Administrator",
                    role=UserRole.admin,
                    is_active=True,
                )
                session.add(admin)
            else:
                # Update password if it changed in .env
                admin.hashed_password = hash_password(settings.ADMIN_PASSWORD)
                
            await seed_data(session)
            await session.commit()
    except Exception as exc:
        logger.warning(
            "Database schema mismatch or outdated columns detected (%s). Re-creating all tables to synchronize schema...",
            str(exc)
        )
        # Drop all tables and recreate them from fresh metadata
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            
        # Re-seed the admin user after clean table creation
        async with async_session() as session:
            admin = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                full_name="System Administrator",
                role=UserRole.admin,
                is_active=True,
            )
            session.add(admin)
            await seed_data(session)
            await session.commit()
        logger.info("Database schema synchronized and administrator seeded successfully.")
