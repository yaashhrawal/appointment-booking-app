import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        // Get the doctor password from environment variable
        const correctPassword = process.env.DOCTOR_PASSWORD || 'doctor123';

        if (password === correctPassword) {
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
    } catch (error) {
        console.error('Auth verification error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
