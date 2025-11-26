export interface TraceEvent {
    name: string;
    cat: string;
    ph: string;
    ts: number; // Timestamp in microseconds
    pid: number;
    tid: number;
    dur?: number; // Duration in microseconds
    args?: Record<string, any>;
    id?: string; // Optional ID for async events
    depth?: number; // Visual depth for stacking
}

export interface Thread {
    tid: number;
    name: string;
    events: TraceEvent[];
    maxDepth?: number;
}

export interface Process {
    pid: number;
    name: string;
    threads: Map<number, Thread>;
}

export interface TraceModel {
    processes: Map<number, Process>;
    minTime: number;
    maxTime: number;
}

export function parseTrace(data: any): TraceModel {
    let events: TraceEvent[] = [];

    if (Array.isArray(data)) {
        events = data;
    } else if (data && Array.isArray(data.traceEvents)) {
        events = data.traceEvents;
    } else {
        throw new Error("Invalid trace format");
    }

    const processes = new Map<number, Process>();
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const event of events) {
        // Skip metadata events for now, or handle them separately
        if (!event.pid && !event.tid) continue;

        // Ensure numeric types
        const ts = Number(event.ts);
        const dur = event.dur ? Number(event.dur) : 0;

        // Update event with parsed values to avoid re-parsing later
        event.ts = ts;
        event.dur = dur;

        // Update time bounds
        if (ts < minTime) minTime = ts;
        // For 'B' (Begin) and 'E' (End) events, duration might be calculated later.
        // For 'X' (Complete) events, we have dur.
        const endTime = dur ? ts + dur : ts;
        if (endTime > maxTime) maxTime = endTime;

        // Get or create Process
        let process = processes.get(event.pid);
        if (!process) {
            process = { pid: event.pid, name: `Process ${event.pid}`, threads: new Map() };
            processes.set(event.pid, process);
        }

        // Get or create Thread
        let thread = process.threads.get(event.tid);
        if (!thread) {
            thread = { tid: event.tid, name: `Thread ${event.tid}`, events: [] };
            process.threads.set(event.tid, thread);
        }

        // Handle Metadata events to name processes/threads
        if (event.ph === 'M') {
            if (event.name === 'process_name' && event.args?.name) {
                process.name = event.args.name;
            } else if (event.name === 'thread_name' && event.args?.name) {
                thread.name = event.args.name;
            }
        } else {
            thread.events.push(event);
        }
    }

    // Sort events by timestamp
    processes.forEach(process => {
        process.threads.forEach(thread => {
            thread.events.sort((a, b) => a.ts - b.ts);

            // Calculate stack depth
            const stack: TraceEvent[] = [];
            thread.maxDepth = 0;

            for (const event of thread.events) {
                // Remove events that have ended
                // We iterate backwards to safely remove
                for (let i = stack.length - 1; i >= 0; i--) {
                    const stackEvent = stack[i];
                    const stackEnd = stackEvent.dur ? stackEvent.ts + stackEvent.dur : stackEvent.ts;
                    if (stackEnd <= event.ts) {
                        stack.splice(i, 1);
                    }
                }

                // Find the first available depth
                // Simple greedy approach: depth is the current stack size?
                // No, we need to fill gaps. But for simple flame graphs, stack size usually works if sorted.
                // However, to be robust, let's just use the lowest available depth index.
                // Actually, standard trace viewers usually just stack them.
                // If A encloses B, B is at depth + 1.
                // If A and B are siblings (A ends before B starts), they can be at same depth.

                // Since we removed ended events, the stack contains only events that overlap with current.
                // So current event depth is simply the stack length.
                event.depth = stack.length;
                thread.maxDepth = Math.max(thread.maxDepth, event.depth);
                stack.push(event);
            }
        });
    });

    return { processes, minTime, maxTime };
}
