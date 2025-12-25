
export interface PDFPageData {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ConversionSettings {
  format: 'png' | 'jpeg';
  scale: number; // DPI Scale (e.g., 2 for high res)
  pageRange: string; // e.g., "1-5, 8, 10-12"
  quality: number; // 0 to 1 for JPEG quality
}

export interface DocumentAnalysis {
  summary: string;
  suggestedTags: string[];
}
