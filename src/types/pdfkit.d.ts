/** pdfkit 0.20 tidak membundel tipe; minimum yang dipakai render-binary. */
declare module "pdfkit" {
  class PDFDocument extends import("stream").Readable {
    constructor(options?: Record<string, unknown>);
    text(text: string, options?: Record<string, unknown>): PDFDocument;
    font(name: string, size?: number): PDFDocument;
    fontSize(size: number): PDFDocument;
    addPage(): PDFDocument;
    end(): void;
    on(event: string, listener: (...args: never[]) => void): this;
  }
  export = PDFDocument;
}
