declare namespace Express {
  namespace Multer {
    interface File {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
      filename?: string;
      path?: string;
    }
  }

  interface Request {
    file?: Multer.File;
  }
}

declare module "multer" {
  import type { RequestHandler } from "express";

  interface StorageEngine {}

  interface Multer {
    single(fieldName: string): RequestHandler;
  }

  interface Options {
    storage?: StorageEngine;
  }

  interface MulterFactory {
    (options?: Options): Multer;
    memoryStorage(): StorageEngine;
  }

  const multer: MulterFactory;
  export default multer;
}

declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }

  const pdfParse: (dataBuffer: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}
