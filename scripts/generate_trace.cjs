const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../large_trace.json');
const NUM_EVENTS = 10000;
const NUM_THREADS = 10;
const NUM_PROCESSES = 2;

const events = [];

// Metadata
for (let p = 0; p < NUM_PROCESSES; p++) {
    events.push({
        name: 'process_name',
        ph: 'M',
        pid: p,
        tid: 0,
        args: { name: 'Process ' + p }
    });

    for (let t = 0; t < NUM_THREADS; t++) {
        events.push({
            name: 'thread_name',
            ph: 'M',
            pid: p,
            tid: t,
            args: { name: 'Thread ' + t }
        });
    }
}

// Generate Events
for (let i = 0; i < NUM_EVENTS; i++) {
    const pid = Math.floor(Math.random() * NUM_PROCESSES);
    const tid = Math.floor(Math.random() * NUM_THREADS);
    const ts = Math.floor(Math.random() * 1000000); // Random start time within 1 second
    const dur = Math.floor(Math.random() * 5000) + 100; // Duration 100us - 5ms

    events.push({
        name: 'Event ' + i,
        cat: 'test',
        ph: 'X',
        ts: ts,
        dur: dur,
        pid: pid,
        tid: tid
    });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(events, null, 2));
console.log('Generated ' + events.length + ' events in ' + OUTPUT_FILE);
