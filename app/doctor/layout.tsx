'use client';

import { AuthProvider } from '@/lib/auth';

export default function DoctorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}
