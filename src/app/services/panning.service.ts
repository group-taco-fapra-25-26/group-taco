import { computed, ElementRef, Injectable, signal } from '@angular/core';
import { DisplayableGraph } from '../classes/displayable-graph.interface';
import { ViewBox, viewBoxValues } from '../components/display/display.constants';

@Injectable()
export class PanningService {
    INITIAL_VIEWBOX: ViewBox = viewBoxValues;
    private readonly ZOOM_INTENSITY = 0.1;
    private _viewBoxValues = signal(this.INITIAL_VIEWBOX);
    private _isPanning = false;
    private _panStartPoint = { x: 0, y: 0 };

    public viewBoxAsString = computed(() => {
        const v: ViewBox = this._viewBoxValues();
        return `${v.minX} ${v.minY} ${v.width} ${v.height}`;
    });

    /**
     * Initiates the panning process.
     * @param event
     *          the mouse event that started the panning
     * @param diagram
     *         the current diagram being displayed
     * @param drawingArea
     *        reference to the SVG drawing area
     */
    public startPan(
        event: MouseEvent,
        diagram: DisplayableGraph | undefined,
        drawingArea: ElementRef<SVGGraphicsElement>,
    ): void {
        if (event.button !== 0 || !diagram) return;
        this._isPanning = true;
        this._panStartPoint = { x: event.clientX, y: event.clientY };
        drawingArea.nativeElement.style.cursor = 'grabbing';
    }

    /**
     * Handles the panning movement by updating the viewBox values,
     * based on mouse movement.
     * @param event
     *         the mouse event during panning
     * @param drawingArea
     *        reference to the SVG drawing area
     */
    public pan(event: MouseEvent, drawingArea: ElementRef<SVGGraphicsElement>): void {
        if (!this._isPanning) {
            return;
        }
        event.preventDefault();

        const svg = drawingArea.nativeElement;
        const clientRect = svg.getBoundingClientRect();
        const scaleX = this._viewBoxValues().width / clientRect.width;
        const scaleY = this._viewBoxValues().height / clientRect.height;

        const dx = (event.clientX - this._panStartPoint.x) * scaleX;
        const dy = (event.clientY - this._panStartPoint.y) * scaleY;

        this._viewBoxValues.update(
            (v: ViewBox): ViewBox => ({
                ...v,
                minX: v.minX - dx,
                minY: v.minY - dy,
            }),
        );
        this._panStartPoint = { x: event.clientX, y: event.clientY };
    }

    /**
     * Ends the panning process.
     * @param drawingArea
     *       reference to the SVG drawing area
     */
    public endPan(drawingArea: ElementRef<SVGGraphicsElement>): void {
        this._isPanning = false;
        drawingArea.nativeElement.style.cursor = 'default';
    }

    /**
     * Resets the viewBox to its initial values and clears the panning state.
     * @param drawingArea
     *        optional reference to the SVG drawing area, to reset the cursor style
     */
    public resetViewBox(drawingArea?: ElementRef<SVGGraphicsElement>): void {
        this._isPanning = false;
        this._panStartPoint = { x: 0, y: 0 };
        this._viewBoxValues.set({ ...this.INITIAL_VIEWBOX });
        if (drawingArea) {
            drawingArea.nativeElement.style.cursor = 'default';
        }
    }

    /**
     * Handles zooming in and out based on mouse wheel events.
     * @param event
     *        the wheel event triggering the zoom
     * @param drawingArea
     *       reference to the SVG drawing area
     * @param diagram
     *       the current diagram being displayed
     */
    public zoom(
        event: WheelEvent,
        drawingArea: ElementRef<SVGGraphicsElement>,
        diagram: DisplayableGraph | undefined,
    ): void {
        if (!diagram) return;
        event.preventDefault();

        const svg = drawingArea.nativeElement;
        const clientRect = svg.getBoundingClientRect();

        const factor = event.deltaY > 0 ? 1 + this.ZOOM_INTENSITY : 1 - this.ZOOM_INTENSITY;

        this._viewBoxValues.update((v: ViewBox): ViewBox => {
            const newWidth = v.width * factor;
            const newHeight = v.height * factor;

            const mouseRelX = (event.clientX - clientRect.left) / clientRect.width;
            const mouseRelY = (event.clientY - clientRect.top) / clientRect.height;

            const dx = (v.width - newWidth) * mouseRelX;
            const dy = (v.height - newHeight) * mouseRelY;

            return {
                minX: v.minX + dx,
                minY: v.minY + dy,
                width: newWidth,
                height: newHeight,
            };
        });
    }
}
