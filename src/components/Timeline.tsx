import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { TraceModel, TraceEvent } from '../core/TraceModel';
import { CanvasRenderer } from '../core/CanvasRenderer';

interface TimelineProps {
    model: TraceModel;
    onEventSelected?: (event: TraceEvent | null) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ model, onEventSelected }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<CanvasRenderer | null>(null);

    // View State (Refs for performance in animation loop)
    const viewState = useRef({
        visibleStartTime: model.minTime,
        visibleEndTime: model.maxTime,
        scrollTop: 0,
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0,
        dragStartX: 0,
        dragStartY: 0,
    });

    // React state for things that need to trigger re-renders (like tooltips)
    const [hoveredEvent, setHoveredEvent] = useState<TraceEvent | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number } | null>(null);

    // Keys state
    const keysPressed = useRef<Set<string>>(new Set());

    // Initialize renderer and reset view
    useEffect(() => {
        if (canvasRef.current && model) {
            rendererRef.current = new CanvasRenderer(canvasRef.current, model);
            viewState.current = {
                ...viewState.current,
                visibleStartTime: model.minTime,
                visibleEndTime: model.maxTime,
                scrollTop: 0
            };
        }
    }, [model]);

    // Keyboard listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key.toLowerCase());
        const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Main Loop
    const render = useCallback(() => {
        if (!rendererRef.current || !containerRef.current || !canvasRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const state = viewState.current;

        // Handle WASD / Keyboard Zoom & Pan
        const range = state.visibleEndTime - state.visibleStartTime;
        const zoomSpeed = 0.05; // 5% per frame
        // const panSpeed = 0.02 * width; // Pixel-equivalent speed - not directly used for time shift

        if (keysPressed.current.has('w')) {
            // Zoom in (center focused)
            const center = (state.visibleStartTime + state.visibleEndTime) / 2;
            const newRange = range * (1 - zoomSpeed);
            state.visibleStartTime = center - newRange / 2;
            state.visibleEndTime = center + newRange / 2;
        }
        if (keysPressed.current.has('s')) {
            // Zoom out
            const center = (state.visibleStartTime + state.visibleEndTime) / 2;
            const newRange = range * (1 + zoomSpeed);
            state.visibleStartTime = center - newRange / 2;
            state.visibleEndTime = center + newRange / 2;
        }
        if (keysPressed.current.has('a')) {
            // Pan Left
            const shift = range * 0.02;
            state.visibleStartTime -= shift;
            state.visibleEndTime -= shift;
        }
        if (keysPressed.current.has('d')) {
            // Pan Right
            const shift = range * 0.02;
            state.visibleStartTime += shift;
            state.visibleEndTime += shift;
        }

        rendererRef.current.render(
            state.visibleStartTime,
            state.visibleEndTime,
            state.scrollTop,
            width,
            height
        );
    }, []);

    useEffect(() => {
        let animationFrameId: number;
        const loop = () => {
            render();
            animationFrameId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [render]);

    // Mouse Handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const state = viewState.current;
        const range = state.visibleEndTime - state.visibleStartTime;
        const width = e.currentTarget.clientWidth;

        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const zoomFactor = 1 + Math.abs(e.deltaY) * 0.001;
            const mouseX = e.nativeEvent.offsetX;
            const timeAtMouse = state.visibleStartTime + (mouseX / width) * range;

            let newRange = e.deltaY > 0 ? range * zoomFactor : range / zoomFactor;

            state.visibleStartTime = timeAtMouse - (mouseX / width) * newRange;
            state.visibleEndTime = state.visibleStartTime + newRange;
        } else {
            // Pan
            // Normalize delta (trackpads give smaller deltas than mice usually)
            const deltaX = e.deltaX;
            const deltaY = e.deltaY;

            // Horizontal Pan
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                const shift = (deltaX / width) * range;
                state.visibleStartTime += shift;
                state.visibleEndTime += shift;
            } else {
                // Vertical Scroll
                state.scrollTop = Math.max(0, state.scrollTop + deltaY);
            }
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        viewState.current.isDragging = true;
        viewState.current.lastMouseX = e.clientX;
        viewState.current.lastMouseY = e.clientY;
        viewState.current.dragStartX = e.clientX;
        viewState.current.dragStartY = e.clientY;
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const state = viewState.current;

        if (state.isDragging) {
            // Drag Pan
            const deltaX = e.clientX - state.lastMouseX;
            const deltaY = e.clientY - state.lastMouseY;

            const width = e.currentTarget.clientWidth;
            const range = state.visibleEndTime - state.visibleStartTime;

            // Pan Time (Horizontal)
            const timeShift = -(deltaX / width) * range;
            state.visibleStartTime += timeShift;
            state.visibleEndTime += timeShift;

            // Pan Tracks (Vertical)
            state.scrollTop = Math.max(0, state.scrollTop - deltaY);

            state.lastMouseX = e.clientX;
            state.lastMouseY = e.clientY;

            // Hide tooltip while dragging
            setHoveredEvent(null);
            setTooltipPos(null);
        } else {
            // Hover Logic
            if (!rendererRef.current || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const width = containerRef.current.clientWidth;

            const event = rendererRef.current.getEventAt(
                x, y,
                state.visibleStartTime, state.visibleEndTime,
                state.scrollTop,
                width
            );

            if (event) {
                setHoveredEvent(event);
                setTooltipPos({ x: e.clientX + 10, y: e.clientY + 10 });
                containerRef.current.style.cursor = 'pointer';
            } else {
                setHoveredEvent(null);
                setTooltipPos(null);
                containerRef.current.style.cursor = 'default';
            }
        }
    }, []);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        const state = viewState.current;
        state.isDragging = false;
        if (containerRef.current) containerRef.current.style.cursor = 'default';

        // Check if it was a click (minimal movement)
        const dist = Math.sqrt(
            Math.pow(e.clientX - state.dragStartX, 2) +
            Math.pow(e.clientY - state.dragStartY, 2)
        );

        if (dist < 5 && onEventSelected) {
            // It was a click
            onEventSelected(hoveredEvent);
        }
    }, [hoveredEvent, onEventSelected]);

    const handleMouseLeave = useCallback(() => {
        viewState.current.isDragging = false;
        setHoveredEvent(null);
        setTooltipPos(null);
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />

            {hoveredEvent && tooltipPos && (
                <div style={{
                    position: 'fixed',
                    left: tooltipPos.x,
                    top: tooltipPos.y,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    zIndex: 1000,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    maxWidth: '300px'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{hoveredEvent.name}</div>
                    <div>Duration: {hoveredEvent.dur ? `${hoveredEvent.dur} µs` : 'N/A'}</div>
                    <div style={{ color: '#aaa', fontSize: '10px', marginTop: '4px' }}>
                        Click to select
                    </div>
                </div>
            )}
        </div>
    );
};
