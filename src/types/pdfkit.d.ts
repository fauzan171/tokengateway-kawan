/** pdfkit 0.20 tidak membundel tipe; minimum yang dipakai render-binary. */
declare module "pdfkit" {
  class PDFDocument extends import("stream").Readable {
    constructor(options?: Record<string, unknown>);
    text(text: string, options?: Record<string, unknown>): PDFDocument;
    font(name: string, size?: number): PDFDocument;
    fontSize(size: number): PDFDocument;
    addPage(): PDFDocument;
    /** D3: divider (garis) dan image (embed byte PNG/JPEG). */
    moveTo(x: number, y: number): PDFDocument;
    lineTo(x: number, y: number): PDFDocument;
    lineWidth(width: number): PDFDocument;
    stroke(): PDFDocument;
    image(src: Buffer | string, x?: number, y?: number, options?: Record<string, unknown>): PDFDocument;
    /** Posisi vertikal kursor saat ini (bottom dari konten terakhir). */
    y: number;
    end(): void;
    on(event: string, listener: (...args: never[]) => void): this;
  }
  export = PDFDocument;
}
