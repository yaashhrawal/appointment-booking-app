'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AppointmentList from '@/components/AppointmentList';
import Notifications from '@/components/Notifications';
import ApiKeyManager from '@/components/ApiKeyManager';

export default function DoctorDashboard() {
    const [refreshKey, setRefreshKey] = useState(0);
    const appointmentListRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { isAuthenticated, isLoading, logout } = useAuth();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/doctor/login');
        }
    }, [isAuthenticated, isLoading, router]);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const handleLogout = () => {
        logout();
        router.push('/doctor/login');
    };

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex items-center gap-3">
                    <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                    <span className="text-slate-600">Loading...</span>
                </div>
            </div>
        );
    }

    // Don't render dashboard if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Dashboard</h1>
                        <p className="text-slate-500 mt-1">Manage appointments, patient notifications, and integrations</p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleRefresh}
                            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">↻</span> Refresh
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex-1 sm:flex-none bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 hover:border-red-300 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                        >
                            🚪 Logout
                        </button>
                    </div>
                </div>

                {/* Live Sync Banner */}
                <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white p-4 rounded-xl shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </div>
                        <div>
                            <p className="font-semibold">Real-Time Sync Active</p>
                            <p className="text-sm text-indigo-100">Appointments update automatically from Hospital CRM</p>
                        </div>
                    </div>
                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-medium">
                        Auto-refresh every 30s
                    </span>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8" ref={appointmentListRef}>
                        <AppointmentList key={refreshKey} />
                        <ApiKeyManager />
                    </div>
                    <div className="space-y-8">
                        <Notifications />
                    </div>
                </div>
            </div>
        </div>
    );
}
