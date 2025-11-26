import React, { useCallback, useState } from 'react';
import { parseTrace } from '../core/TraceModel';
import type { TraceModel } from '../core/TraceModel';

interface TraceUploaderProps {
    onUpload: (model: TraceModel) => void;
}

export const TraceUploader: React.FC<TraceUploaderProps> = ({ onUpload }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback((file: File) => {
        setIsLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const json = JSON.parse(text);
                const model = parseTrace(json);
                onUpload(model);
            } catch (err) {
                console.error(err);
                setError('Failed to parse trace file. Please ensure it is a valid JSON trace.');
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    }, [onUpload]);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    return (
        <div
            className={`trace-uploader ${isDragging ? 'dragging' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
                border: '2px dashed #ccc',
                borderRadius: '8px',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragging ? '#f0f8ff' : 'transparent',
                transition: 'all 0.2s ease',
                color: '#666'
            }}
        >
            <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                style={{ display: 'none' }}
                id="trace-file-input"
            />
            <label htmlFor="trace-file-input" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                {isLoading ? (
                    <p>Parsing trace file...</p>
                ) : (
                    <>
                        <h3>Drag & Drop Trace File Here</h3>
                        <p>or click to select a .json file</p>
                        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                    </>
                )}
            </label>
        </div>
    );
};
