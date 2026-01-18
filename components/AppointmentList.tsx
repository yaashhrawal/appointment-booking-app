'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAppointmentsFromCRM } from '@/lib/crm';

interface Appointment {
    id: string;
    patient_name: string;
    start_time: string;
    status: string;
    crm_appointment_id: string;
    source?: string;
    doctor_name?: string;
}

const SYNC_INTERVAL = 30000; // 30 seconds polling interval

export default function AppointmentList() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'error'>('syncing');
    const [isLive, setIsLive] = useState(false);

    // Fetch appointments function
    const fetchAppointments = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        setSyncStatus('syncing');

        try {
            // 1. Fetch appointments from Supabase (from appointments-app bookings)
            const { data: localData, error } = await supabase
                .from('appointments')
                .select(`
                    id, 
                    scheduled_at,
                    status, 
                    appointment_id,
                    patient_id,
                    doctor_id,
                    patients:patient_id (id, first_name, last_name),
                    doctors:doctor_id (id, name)
                `)
                .in('status', ['scheduled', 'confirmed'])
                .order('scheduled_at', { ascending: true })
                .limit(50);

            let localFormatted: Appointment[] = [];
            if (!error && localData) {
                localFormatted = localData.map((apt: any) => ({
                    id: apt.id,
                    patient_name: apt.patients ? `${apt.patients.first_name} ${apt.patients.last_name}` : 'Unknown Patient',
                    start_time: apt.scheduled_at,
                    status: apt.status,
                    crm_appointment_id: apt.appointment_id || apt.id,
                    doctor_name: apt.doctors?.name || 'Assigned Doctor',
                    source: 'CRM'
                }));
            }

            // 2. Also try to fetch from future_appointments view (legacy CRM view)
            const crmData = await fetchAppointmentsFromCRM();
            const crmFormatted = crmData.map(apt => ({
                id: apt.id,
                patient_name: 'CRM Patient',
                start_time: `${apt.appointment_date}T${apt.appointment_time}`,
                status: apt.status.toLowerCase(),
                crm_appointment_id: apt.id,
                source: 'CRM_LEGACY'
            }));

            // 3. Merge and deduplicate (prefer main appointments table)
            const existingIds = new Set(localFormatted.map(a => a.id));
            const uniqueCrmAppointments = crmFormatted.filter(a => !existingIds.has(a.id));

            // 4. Merge, filter for upcoming only, and sort
            const now = new Date();
            const merged = [...localFormatted, ...uniqueCrmAppointments]
                .filter(apt => new Date(apt.start_time) >= now)
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

            setAppointments(merged);
            setLastSynced(new Date());
            setSyncStatus('synced');
            setIsLive(true);

            console.log('🔄 Appointments synced:', merged.length, 'upcoming');

        } catch (err: any) {
            console.warn('Appointment Sync Error:', err.message);
            setSyncStatus('error');

            // Keep existing appointments on error
            if (appointments.length === 0) {
                setAppointments([]);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch and setup real-time subscription
    useEffect(() => {
        fetchAppointments(true);

        // Setup real-time subscription for appointments table
        const subscription = supabase
            .channel('appointments-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointments'
                },
                (payload) => {
                    console.log('📡 Real-time update received:', payload.eventType);
                    // Refetch appointments when any change happens
                    fetchAppointments(false);
                }
            )
            .subscribe((status) => {
                console.log('📡 Realtime subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    setIsLive(true);
                }
            });

        // Setup polling as fallback (every 30 seconds)
        const pollInterval = setInterval(() => {
            fetchAppointments(false);
        }, SYNC_INTERVAL);

        // Cleanup
        return () => {
            subscription.unsubscribe();
            clearInterval(pollInterval);
        };
    }, [fetchAppointments]);

    // Format last synced time
    const formatLastSynced = () => {
        if (!lastSynced) return 'Never';
        const seconds = Math.floor((new Date().getTime() - lastSynced.getTime()) / 1000);
        if (seconds < 10) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    };

    // Refresh timer display
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(timer);
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                    <span className="text-slate-500">Loading appointments...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header with Live Sync Status */}
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Upcoming Appointments</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Real-time sync with <span className="font-medium text-indigo-600">Hospital CRM</span>
                    </p>
                </div>

                {/* Live Sync Status Indicator */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                        {syncStatus === 'syncing' ? (
                            <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                                <span className="animate-spin h-3 w-3 border-2 border-amber-600 border-t-transparent rounded-full"></span>
                                Syncing...
                            </span>
                        ) : syncStatus === 'error' ? (
                            <span className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                                <span className="h-2 w-2 bg-red-500 rounded-full"></span>
                                Sync Error
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                {isLive ? 'Live' : 'Synced'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                            Updated: {formatLastSynced()}
                        </span>
                        <button
                            onClick={() => fetchAppointments(false)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                            title="Refresh now"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Appointments List */}
            <ul className="divide-y divide-slate-100">
                {appointments.length === 0 ? (
                    <li className="p-8 text-center text-slate-500">
                        <div className="inline-block p-4 rounded-full bg-slate-50 mb-3">🗓️</div>
                        <p className="font-medium">No upcoming appointments</p>
                        <p className="text-sm mt-1">New bookings will appear here automatically</p>
                    </li>
                ) : (
                    appointments.map((apt) => (
                        <li key={apt.id} className="group hover:bg-slate-50 transition-all duration-200">
                            <div className="px-6 py-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg flex-shrink-0">
                                            {apt.patient_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                                                {apt.patient_name}
                                            </h4>
                                            <p className="text-sm text-slate-500 mt-0.5">
                                                ID: <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {apt.crm_appointment_id ? apt.crm_appointment_id.substring(0, 8) : 'PENDING'}
                                                </span>
                                            </p>
                                            {apt.doctor_name && (
                                                <p className="text-xs text-slate-400 mt-1">
                                                    👨‍⚕️ {apt.doctor_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(apt.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${apt.status === 'scheduled' || apt.status === 'confirmed'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {apt.status.toUpperCase()}
                                            </span>
                                            {apt.source === 'CRM' && (
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                                                    From CRM
                                                </span>
                                            )}
                                            {apt.source === 'CRM_LEGACY' && (
                                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 uppercase tracking-wide">
                                                    Legacy CRM
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))
                )}
            </ul>

            {/* Footer with sync info */}
            {appointments.length > 0 && (
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Showing {appointments.length} upcoming appointment{appointments.length !== 1 ? 's' : ''}</span>
                    <span>Auto-refresh every 30s</span>
                </div>
            )}
        </div>
    );
}
