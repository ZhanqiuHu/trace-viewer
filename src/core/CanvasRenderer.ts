import type { TraceModel, Thread, TraceEvent } from './TraceModel';

export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private model: TraceModel;

    // Layout constants
    private readonly TRACK_HEIGHT = 24; // Slightly taller
    private readonly TRACK_PADDING = 4;
    private readonly LABEL_WIDTH = 220;
    private readonly HEADER_HEIGHT = 30;

    // Perfetto-inspired Colors
    private readonly COLORS = [
        '#37474F', '#455A64', '#546E7A', '#607D8B', // Greys/Blues
        '#827717', '#9E9D24', '#AFB42B', '#C0CA33', // Limes
        '#E65100', '#EF6C00', '#F57C00', '#FB8C00', // Oranges
        '#1B5E20', '#2E7D32', '#388E3C', '#43A047', // Greens
        '#0D47A1', '#1565C0', '#1976D2', '#1E88E5', // Blues
        '#B71C1C', '#C62828', '#D32F2F', '#E53935', // Reds
    ];

    constructor(canvas: HTMLCanvasElement, model: TraceModel) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no alpha
        if (!ctx) throw new Error('Could not get 2d context');
        this.ctx = ctx;
        this.model = model;
    }

    public render(
        visibleStartTime: number,
        visibleEndTime: number,
        scrollTop: number,
        width: number,
        height: number
    ) {
        // Handle DPI
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, width, height);

        // Setup scaling
        const timeRange = visibleEndTime - visibleStartTime;
        const timeToPixel = (time: number) => {
            return this.LABEL_WIDTH + ((time - visibleStartTime) / timeRange) * (width - this.LABEL_WIDTH);
        };

        let currentY = this.HEADER_HEIGHT - scrollTop;

        // Draw Grid
        this.drawGrid(visibleStartTime, visibleEndTime, height, timeToPixel);

        // Draw Tracks
        this.model.processes.forEach((process) => {
            // Draw Process Header
            if (currentY + this.TRACK_HEIGHT > 0 && currentY < height) {
                this.ctx.fillStyle = '#f5f5f5';
                this.ctx.fillRect(0, currentY, width, this.TRACK_HEIGHT);
                this.ctx.fillStyle = '#333';
                this.ctx.font = 'bold 13px "Roboto", "Helvetica Neue", sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(process.name, 10, currentY + 17);
            }
            currentY += this.TRACK_HEIGHT + this.TRACK_PADDING;

            process.threads.forEach((thread) => {
                const trackDepth = (thread.maxDepth || 0) + 1;
                const trackPixelHeight = trackDepth * this.TRACK_HEIGHT;

                if (currentY + trackPixelHeight > 0 && currentY < height) {
                    this.drawThreadTrack(thread, currentY, timeToPixel, visibleStartTime, visibleEndTime, width);
                }
                currentY += trackPixelHeight + this.TRACK_PADDING;
            });
        });
    }

    private drawThreadTrack(
        thread: Thread,
        y: number,
        timeToPixel: (t: number) => number,
        visibleStartTime: number,
        visibleEndTime: number,
        width: number
    ) {
        // Calculate dynamic track height based on depth
        // Default height is for depth 0. Each additional depth adds TRACK_HEIGHT.
        // We need to pass the calculated height back or handle layout differently.
        // For now, let's assume fixed layout in 'render' loop is not enough.
        // We need to change 'render' to calculate Y positions dynamically.

        // However, this method is called with a specific 'y'.
        // Let's just draw the slices relative to 'y'.

        const trackHeight = (thread.maxDepth || 0) + 1;
        const totalHeight = trackHeight * this.TRACK_HEIGHT;

        // Draw Track Label Background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, y, this.LABEL_WIDTH, totalHeight);

        // Draw Track Label Text
        this.ctx.fillStyle = '#666';
        this.ctx.font = '12px "Roboto", "Helvetica Neue", sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(thread.name, this.LABEL_WIDTH - 10, y + 17);

        // Draw Slices
        thread.events.forEach((event) => {
            const endTime = event.dur ? event.ts + event.dur : event.ts;

            // Culling
            if (endTime < visibleStartTime || event.ts > visibleEndTime) return;

            const x = Math.max(this.LABEL_WIDTH, timeToPixel(event.ts));
            const endX = Math.min(width, timeToPixel(endTime));
            const w = Math.max(1, endX - x);

            if (w < 0) return;

            // Calculate Y offset based on depth
            const depth = event.depth || 0;
            const sliceY = y + (depth * this.TRACK_HEIGHT);

            // Color hashing
            const colorIndex = Math.abs(this.hashString(event.name)) % this.COLORS.length;
            this.ctx.fillStyle = this.COLORS[colorIndex];

            this.ctx.fillRect(x, sliceY, w, this.TRACK_HEIGHT);

            // Draw text if wide enough
            if (w > 15) {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '11px "Roboto", "Helvetica Neue", sans-serif';
                this.ctx.textAlign = 'left';

                const text = event.name;
                const textMetrics = this.ctx.measureText(text);

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(x, sliceY, w, this.TRACK_HEIGHT);
                this.ctx.clip();

                if (textMetrics.width < w - 4) {
                    this.ctx.fillText(text, x + 4, sliceY + 16);
                } else {
                    // Simple truncation
                    this.ctx.fillText(text, x + 4, sliceY + 16);
                }
                this.ctx.restore();
            }
        });
    }

    private drawGrid(
        start: number,
        end: number,
        height: number,
        timeToPixel: (t: number) => number
    ) {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        // Draw vertical lines
        const range = end - start;
        // Aim for ~10 grid lines
        const idealStep = range / 10;
        const magnitude = Math.pow(10, Math.floor(Math.log10(idealStep)));
        const step = Math.ceil(idealStep / magnitude) * magnitude;

        const firstLine = Math.ceil(start / step) * step;

        for (let t = firstLine; t <= end; t += step) {
            const x = timeToPixel(t);
            if (x > this.LABEL_WIDTH) {
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, height);
            }
        }
        this.ctx.stroke();
    }

    public getEventAt(
        x: number,
        y: number,
        visibleStartTime: number,
        visibleEndTime: number,
        scrollTop: number,
        width: number
    ): TraceEvent | null {
        if (x < this.LABEL_WIDTH) return null;

        const timeRange = visibleEndTime - visibleStartTime;
        const pixelToTime = (px: number) => {
            return visibleStartTime + ((px - this.LABEL_WIDTH) / (width - this.LABEL_WIDTH)) * timeRange;
        };

        const time = pixelToTime(x);
        let currentY = this.HEADER_HEIGHT - scrollTop;

        for (const process of this.model.processes.values()) {
            currentY += this.TRACK_HEIGHT + this.TRACK_PADDING; // Process header

            for (const thread of process.threads.values()) {
                const trackDepth = (thread.maxDepth || 0) + 1;
                const trackPixelHeight = trackDepth * this.TRACK_HEIGHT;

                if (y >= currentY && y <= currentY + trackPixelHeight) {
                    // Found the track, now find the event
                    // We need to check depth as well
                    const depthAtY = Math.floor((y - currentY) / this.TRACK_HEIGHT);

                    for (const event of thread.events) {
                        const endTime = event.dur ? event.ts + event.dur : event.ts;
                        const eventDepth = event.depth || 0;

                        if (eventDepth === depthAtY && time >= event.ts && time <= endTime) {
                            return event;
                        }
                    }
                }
                currentY += trackPixelHeight + this.TRACK_PADDING;
            }
        }
        return null;
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }
}
