import { Coords } from '../classes/json-petri-net';

export class GeometryUtil {
    private static readonly HALF_HEIGHT = 10;
    private static readonly CHAR_WIDTH = 4;
    private static readonly MARGIN = 4;
    private static readonly MIN_LABEL_HALF_WIDTH = 10;
    private static readonly EPSILON = 0.0001;

    /**
     * Calculates the intersection point of a line segment from `center` to `other`
     * with a bounding box centered at `center`.
     * The bounding box size is determined by the label length.
     * @param center The center of the node (and the bounding box).
     * @param other The other point (target or source of the line).
     * @param label The text label of the node.
     */
    static getLabelBoundingBoxIntersection(center: Coords, other: Coords, label: string): Coords {
        const dx = other.x - center.x;
        const dy = other.y - center.y;

        // No line if points are same
        if (dx === 0 && dy === 0) return { x: center.x, y: center.y };

        const halfWidth = Math.max(this.MIN_LABEL_HALF_WIDTH, label.length * this.CHAR_WIDTH);

        const w = halfWidth + this.MARGIN;
        const h = this.HALF_HEIGHT + this.MARGIN;

        // Avoid division by zero
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // If dx is 0 (vertical line), we hit top/bottom boundary
        const tx = absDx > this.EPSILON ? w / absDx : Infinity;
        // If dy is 0 (horizontal line), we hit left/right boundary
        const ty = absDy > this.EPSILON ? h / absDy : Infinity;

        const t = Math.min(tx, ty);

        return {
            x: center.x + dx * t,
            y: center.y + dy * t,
        };
    }
}
