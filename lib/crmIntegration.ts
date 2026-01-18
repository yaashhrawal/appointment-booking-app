/**
 * CRM Integration Service
 * @version 1.0.1
 *
 * This service handles synchronization between appointments-app and Hospital-CRM-Bhilwara.
 * Both applications share the same Supabase instance.
 *
 * Key responsibilities:
 * - Patient mapping and creation
 * - Doctor validation and auto-creation
 * - Appointment synchronization
 * - ID generation following CRM formats
 */

import { supabase } from './supabase';

// ============================================================================
// CONSTANTS
// ============================================================================

const HOSPITAL_ID = '550e8400-e29b-41d4-a716-446655440000'; // Bhilwara Hospital

// ============================================================================
// INTERFACES
// ============================================================================

interface CRMPatient {
    id: string;
    patient_id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    gender?: string;
    age?: string;
    hospital_id: string;
}

interface CRMDoctor {
    id: string;
    name: string;
    department?: string;
    specialization?: string;
    fee?: number;
    hospital_id: string;
    is_active?: boolean;
}

interface CRMAppointment {
    id: string;
    appointment_id: string;
    patient_id: string;
    doctor_id: string;
    scheduled_at: string;
    status: string;
    hospital_id: string;
    created_at?: string;
}

export interface AppointmentData {
    patient: {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        crm_id?: string;
    };
    doctor: {
        id: string;
        name: string;
        specialty?: string;
        email?: string;
        phone?: string;
        crm_id?: string;
    };
    startTime: string;
    endTime: string;
    status: string;
}

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Main function to sync appointment from appointments-app to Hospital-CRM
 *
 * @param appointmentData - Appointment data from appointments-app
 * @returns CRM appointment_id (APT format) or 'SYNC_FAILED' on error
 */
export async function syncAppointmentToCRM(appointmentData: AppointmentData): Promise<string> {
    try {
        console.log('🔄 Starting CRM sync for appointment...');
        console.log('📋 Input data:', JSON.stringify({
            patient: { id: appointmentData.patient.id, name: appointmentData.patient.name },
            doctor: { id: appointmentData.doctor.id, name: appointmentData.doctor.name, crm_id: appointmentData.doctor.crm_id }
        }, null, 2));

        // Step 1: Find or create patient in CRM
        const crmPatient = await findOrCreateCRMPatient(appointmentData.patient);
        console.log('✅ CRM Patient ID:', crmPatient.id, 'Patient ID:', crmPatient.patient_id);

        // Step 2: Find or create doctor in CRM
        const crmDoctor = await findOrCreateCRMDoctor(appointmentData.doctor);
        console.log('✅ CRM Doctor ID:', crmDoctor.id, 'Name:', crmDoctor.name);

        // Step 3: Create appointment in CRM
        const crmAppointment = await createCRMAppointment({
            patient: crmPatient,
            doctor: crmDoctor,
            startTime: appointmentData.startTime,
            endTime: appointmentData.endTime,
            status: appointmentData.status,
        });
        console.log('✅ CRM Appointment ID:', crmAppointment.id);
        console.log('✅ CRM Appointment Number:', crmAppointment.appointment_id);

        return crmAppointment.appointment_id;
    } catch (error: any) {
        console.error('❌ CRM Sync Failed:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
        });
        // Soft failure mode - return indicator but don't throw
        return 'SYNC_FAILED';
    }
}

// ============================================================================
// PATIENT MANAGEMENT
// ============================================================================

/**
 * Find existing CRM patient or create new one
 */
async function findOrCreateCRMPatient(patient: AppointmentData['patient']): Promise<CRMPatient> {
    // Try to find existing patient by phone or email
    let existingPatient: CRMPatient | null = null;

    if (patient.phone) {
        console.log(`🔍 Looking up patient by phone: ${patient.phone}`);
        const { data } = await supabase
            .from('patients')
            .select('*')
            .eq('phone', patient.phone)
            .eq('hospital_id', HOSPITAL_ID)
            .limit(1)
            .single();
        existingPatient = data;
    }

    if (!existingPatient && patient.email) {
        console.log(`🔍 Looking up patient by email: ${patient.email}`);
        const { data } = await supabase
            .from('patients')
            .select('*')
            .eq('email', patient.email)
            .eq('hospital_id', HOSPITAL_ID)
            .limit(1)
            .single();
        existingPatient = data;
    }

    if (existingPatient) {
        console.log(`✅ Found existing patient: ${existingPatient.id}`);
        return existingPatient;
    }

    // Patient not found - create new one
    console.log(`⚠️ Patient ${patient.name} not found in CRM, creating...`);
    return await createCRMPatient(patient);
}

/**
 * Create a new patient in Hospital-CRM
 */
async function createCRMPatient(patient: AppointmentData['patient']): Promise<CRMPatient> {
    const { firstName, lastName } = splitName(patient.name);
    const patientId = await generateCRMPatientId();

    const newPatient = {
        patient_id: patientId,
        first_name: firstName,
        last_name: lastName,
        phone: patient.phone || null,
        email: patient.email || null,
        gender: 'M', // Default gender
        age: null,
        hospital_id: HOSPITAL_ID,
        is_active: true,
        is_confirmed: false, // Not confirmed until admin approves appointment
    };

    console.log('📝 Creating new CRM patient:', newPatient);

    const { data, error } = await supabase
        .from('patients')
        .insert([newPatient])
        .select()
        .single();

    if (error) {
        console.error('❌ Patient creation error:', error);
        throw new Error(`Failed to create CRM patient: ${error.message}`);
    }

    console.log(`✅ Created CRM patient: ${data.first_name} ${data.last_name} with ID: ${data.id}`);
    return data;
}

/**
 * Generate unique patient ID in CRM format (PAT202601XXXX)
 */
async function generateCRMPatientId(): Promise<string> {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `PAT${year}${month}`;

        // Get the last patient ID with this prefix
        const { data } = await supabase
            .from('patients')
            .select('patient_id')
            .like('patient_id', `${prefix}%`)
            .order('patient_id', { ascending: false })
            .limit(1)
            .single();

        if (data && data.patient_id) {
            // Extract sequence number and increment
            const lastSequence = parseInt(data.patient_id.replace(prefix, ''));
            const nextSequence = lastSequence + 1;
            return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
        }

        // First patient of the month
        return `${prefix}0001`;
    } catch (error) {
        // Fallback to timestamp if generation fails
        console.warn('Using timestamp fallback for patient ID');
        return `PAT${Date.now()}`;
    }
}

// ============================================================================
// DOCTOR MANAGEMENT
// ============================================================================

/**
 * Find existing CRM doctor or create new one
 * Note: appointments.doctor_id now references doctors(id)
 */
async function findOrCreateCRMDoctor(doctor: AppointmentData['doctor']): Promise<CRMDoctor> {
    // Check if doctor has a CRM ID
    if (doctor.crm_id) {
        console.log(`🔍 Looking up doctor by CRM ID: ${doctor.crm_id}`);
        const { data } = await supabase
            .from('doctors')
            .select('*')
            .eq('id', doctor.crm_id)
            .eq('hospital_id', HOSPITAL_ID)
            .single();

        if (data) {
            console.log(`✅ Found doctor by CRM ID: ${data.id}`);
            return data;
        }
    }

    // Try to find by name in doctors table
    console.log(`🔍 Looking up doctor by name: ${doctor.name}`);
    const { data: existingDoctor } = await supabase
        .from('doctors')
        .select('*')
        .eq('name', doctor.name)
        .eq('hospital_id', HOSPITAL_ID)
        .single();

    if (existingDoctor) {
        console.log(`✅ Found existing doctor: ${existingDoctor.id}`);
        return existingDoctor;
    }

    // Doctor not found - create placeholder
    console.log(`⚠️ Doctor ${doctor.name} not found in CRM, creating placeholder...`);
    return await createCRMDoctor(doctor);
}

/**
 * Create a new doctor in Hospital-CRM doctors table
 */
async function createCRMDoctor(doctor: AppointmentData['doctor']): Promise<CRMDoctor> {
    const newDoctor = {
        name: doctor.name,
        department: doctor.specialty || 'General Medicine',
        specialization: doctor.specialty || 'General Physician',
        fee: 500.00,
        phone: doctor.phone || null,
        email: doctor.email || null,
        hospital_id: HOSPITAL_ID,
        is_active: true,
    };

    console.log('📝 Creating new CRM doctor:', newDoctor);

    const { data, error } = await supabase
        .from('doctors')
        .insert([newDoctor])
        .select()
        .single();

    if (error) {
        console.error('❌ Doctor creation error:', error);
        throw new Error(`Failed to create CRM doctor: ${error.message}`);
    }

    console.log(`✅ Created CRM doctor: ${data.name} with ID: ${data.id}`);
    return data;
}

// ============================================================================
// APPOINTMENT MANAGEMENT
// ============================================================================

/**
 * Create appointment in Hospital-CRM
 */
async function createCRMAppointment(data: {
    patient: CRMPatient;
    doctor: CRMDoctor;
    startTime: string;
    endTime: string;
    status: string;
}): Promise<CRMAppointment> {
    const appointmentId = await generateCRMAppointmentId();
    const duration = calculateDuration(data.startTime, data.endTime);
    const status = mapStatus(data.status);

    console.log('📅 Creating CRM appointment with:');
    console.log(`   Appointment ID: ${appointmentId}`);
    console.log(`   Patient ID: ${data.patient.id}`);
    console.log(`   Doctor ID: ${data.doctor.id}`);
    console.log(`   Scheduled At: ${data.startTime}`);
    console.log(`   Duration: ${duration} minutes`);

    const newAppointment = {
        appointment_id: appointmentId,
        patient_id: data.patient.id,
        doctor_id: data.doctor.id,
        department_id: null,
        appointment_type: 'CONSULTATION',
        status: status,
        scheduled_at: data.startTime,
        duration: duration,
        hospital_id: HOSPITAL_ID,
        source: 'APPOINTMENTS_APP', // Track that this came from external booking
        confirmation_date: null, // Not confirmed yet
    };

    console.log('📝 Inserting appointment:', newAppointment);

    const { data: appointment, error } = await supabase
        .from('appointments')
        .insert([newAppointment])
        .select()
        .single();

    if (error) {
        console.error('❌ Appointment creation error:', error);
        throw new Error(`Failed to create CRM appointment: ${error.message}`);
    }

    console.log(`✅ Created CRM appointment: ${appointment.id} with appointment_id: ${appointmentId}`);
    return appointment;
}

/**
 * Generate unique appointment ID in CRM format (APT202601XXXX)
 */
async function generateCRMAppointmentId(): Promise<string> {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `APT${year}${month}`;

        // Get the last appointment ID with this prefix
        const { data } = await supabase
            .from('appointments')
            .select('appointment_id')
            .like('appointment_id', `${prefix}%`)
            .order('appointment_id', { ascending: false })
            .limit(1)
            .single();

        if (data && data.appointment_id) {
            // Extract sequence number and increment
            const lastSequence = parseInt(data.appointment_id.replace(prefix, ''));
            const nextSequence = lastSequence + 1;
            return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
        }

        // First appointment of the month
        return `${prefix}0001`;
    } catch (error) {
        // Fallback to timestamp if generation fails
        console.warn('Using timestamp fallback for appointment ID');
        return `APT${Date.now()}`;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Split full name into first and last name
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
}

/**
 * Map appointments-app status to Hospital-CRM status
 */
function mapStatus(appStatus: string): string {
    const statusMap: Record<string, string> = {
        'scheduled': 'SCHEDULED',
        'completed': 'COMPLETED',
        'cancelled': 'CANCELLED',
    };
    return statusMap[appStatus.toLowerCase()] || 'SCHEDULED';
}

/**
 * Calculate duration in minutes between two timestamps
 */
function calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    return durationMinutes > 0 ? durationMinutes : 30; // Default to 30 minutes
}
