import React from 'react';
import type { TraceEvent } from '../core/TraceModel';

interface DetailsPanelProps {
    event: TraceEvent | null;
    onClose: () => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ event, onClose }) => {
    if (!event) return null;

    return (
        <div className="details-panel">
            <div className="details-header">
                <h2>Event Details</h2>
                <button onClick={onClose} className="close-button">×</button>
            </div>
            <div className="details-content">
                <div className="detail-row">
                    <span className="detail-label">Name</span>
                    <span className="detail-value">{event.name}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Category</span>
                    <span className="detail-value">{event.cat || 'N/A'}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Start Time</span>
                    <span className="detail-value">{event.ts} µs</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Duration</span>
                    <span className="detail-value">{event.dur ? `${event.dur} µs` : 'N/A'}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Process ID</span>
                    <span className="detail-value">{event.pid}</span>
                </div>
                <div className="detail-row">
                    <span className="detail-label">Thread ID</span>
                    <span className="detail-value">{event.tid}</span>
                </div>

                {event.args && Object.keys(event.args).length > 0 && (
                    <div className="args-section">
                        <h3>Arguments</h3>
                        {Object.entries(event.args).map(([key, value]) => (
                            <div key={key} className="detail-row">
                                <span className="detail-label">{key}</span>
                                <span className="detail-value">{JSON.stringify(value)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
