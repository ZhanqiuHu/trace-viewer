import { useState } from 'react';
import type { TraceModel, TraceEvent } from './core/TraceModel';
import { TraceUploader } from './components/TraceUploader';
import { Timeline } from './components/Timeline';
import { DetailsPanel } from './components/DetailsPanel';
import './index.css';

function App() {
  const [model, setModel] = useState<TraceModel | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TraceEvent | null>(null);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Trace Viewer</h1>
        {model && (
          <button onClick={() => { setModel(null); setSelectedEvent(null); }} className="reset-button">
            Load New Trace
          </button>
        )}
      </header>

      <main className="app-content">
        {!model ? (
          <div className="uploader-container">
            <TraceUploader onUpload={setModel} />
          </div>
        ) : (
          <>
            <Timeline model={model} onEventSelected={setSelectedEvent} />
            <DetailsPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
