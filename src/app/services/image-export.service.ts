import { inject, Injectable } from '@angular/core';
import { ToasterNotificationService } from './toaster-notification.service';

@Injectable({
    providedIn: 'root',
})
export class ImageExportService {
    private _toasterService = inject(ToasterNotificationService);
    private readonly FILE_NAME = 'petri-netz';
    private readonly SCALE_FACTOR = 2;

    /**
     * Exports the given SVG element as an image in the specified format,
     * only exports the visible area of the SVG.
     * @param svg
     *      the SVG element to export
     * @param format
     *      the image format ('png' or 'jpeg')
     */
    public exportImage(svg: SVGGraphicsElement, format: 'png' | 'jpeg'): void {
        const { width, height } = svg.getBoundingClientRect();
        const svgUrl = this._createSvgUrl(svg, width, height);

        const img = new Image();
        img.onload = () => {
            this._renderAndDownload(img, width, height, format);
            URL.revokeObjectURL(svgUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            this._toasterService.showError('Fehler beim Export', 'Das SVG-Bild konnte nicht geladen werden.');
        };
        img.src = svgUrl;
    }

    private _createSvgUrl(svg: SVGGraphicsElement, width: number, height: number): string {
        const svgClone = svg.cloneNode(true) as SVGGraphicsElement;
        svgClone.setAttribute('width', `${width}`);
        svgClone.setAttribute('height', `${height}`);

        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgClone);
        const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });

        return URL.createObjectURL(svgBlob);
    }

    private _renderAndDownload(img: HTMLImageElement, width: number, height: number, format: 'png' | 'jpeg'): void {
        const canvas = document.createElement('canvas');
        canvas.width = width * this.SCALE_FACTOR;
        canvas.height = height * this.SCALE_FACTOR;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(this.SCALE_FACTOR, this.SCALE_FACTOR);

        if (format === 'jpeg') {
            // JPEGs have no transparency, so we need a white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imgUrl = canvas.toDataURL(`image/${format}`);
        try {
            this._triggerDownload(imgUrl, format);
        } finally {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
        }
    }

    private _triggerDownload(url: string, format: string): void {
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${this.FILE_NAME}.${format}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
}
