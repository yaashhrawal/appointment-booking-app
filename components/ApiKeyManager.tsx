'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ApiKey {
    id: string;
    label: string;
    key: string;
    created_at: string;
    is_active: boolean;
}

export default function ApiKeyManager() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [showNewKey, setShowNewKey] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [label, setLabel] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const { data, error } = await supabase
                .from('api_keys')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // Table might not exist - this is okay, just log and continue
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.warn('api_keys table does not exist yet - feature not initialized');
                } else {
                    console.warn('Error fetching keys:', error.message);
                }
                setKeys([]);
                return;
            }
            setKeys(data || []);
        } catch (error: any) {
            console.warn('API Keys fetch skipped:', error?.message || 'Unknown error');
            setKeys([]);
        } finally {
            setLoading(false);
        }
    };


    const generateKey = async () => {
        if (!label.trim()) return alert('Please enter a label for this key (e.g., "City Hospital")');

        const key = `sk_seva_${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}`;

        try {
            const { data, error } = await supabase
                .from('api_keys')
                .insert([{ label, key }])
                .select()
                .single();

            if (error) throw error;

            setNewKey(key);
            setShowNewKey(true);
            setKeys([data, ...keys]);
            setLabel('');
        } catch (error: any) {
            alert('Error generating key: ' + error.message);
        }
    };

    const revokeKey = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this key? The partner using it will lose access immediately.')) return;

        try {
            const { error } = await supabase
                .from('api_keys')
                .delete() // Or update is_active = false
                .eq('id', id);

            if (error) throw error;
            setKeys(keys.filter(k => k.id !== id));
        } catch (error: any) {
            alert('Error revoking key: ' + error.message);
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-500">Loading API Keys...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">Seva-Connect Integration</h3>
                    <p className="text-sm text-slate-500 mt-1">Manage secure keys for cross-app booking</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="Key Label (e.g. Partner Name)"
                        className="flex-1 sm:w-64 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                    />
                    <button
                        onClick={generateKey}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
                    >
                        + Generate
                    </button>
                </div>
            </div>

            {showNewKey && (
                <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-100 animate-fade-in relative">
                    <button onClick={() => setShowNewKey(false)} className="absolute top-2 right-2 text-green-700 hover:text-green-900">×</button>
                    <p className="text-sm font-medium text-green-800 mb-2">New API Key Generated:</p>
                    <code className="block bg-white p-3 rounded-lg border border-green-200 text-slate-800 font-mono text-sm break-all select-all">
                        {newKey}
                    </code>
                    <p className="text-xs text-green-600 mt-2">Make sure to copy this now. It may strictly be hidden in the future.</p>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Label</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">API Key</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {keys.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">
                                    No active API keys. Generate one to start integrating.
                                </td>
                            </tr>
                        ) : (
                            keys.map((k) => (
                                <tr key={k.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{k.label}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                        {showNewKey && newKey === k.key ? k.key : `${k.key.substring(0, 12)}...`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                        {new Date(k.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => revokeKey(k.id)}
                                            className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                                        >
                                            Revoke
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
