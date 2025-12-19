import { useState } from 'react';
import { uploadRegulation } from '../services/api';

export default function UploadForm({ onUploadSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const result = await uploadRegulation(file);
            onUploadSuccess(result.items);
        } catch (err) {
            setError("Failed to upload file. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2>Upload Regulation</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Upload a PDF or Text file to extract compliance requirements automatically.
            </p>

            <div style={{ position: 'relative', display: 'inline-block' }}>
                <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    id="file-upload"
                    disabled={loading}
                />
                <label htmlFor="file-upload" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loading ? (
                        <span>Processing...</span>
                    ) : (
                        <>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Select Document</span>
                        </>
                    )}
                </label>
            </div>

            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
        </div>
    );
}
