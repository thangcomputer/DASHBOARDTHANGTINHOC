export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocumentData {
  id: 'terms' | 'privacy';
  slug: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  updatedAt: string;
  summaryBullets: string[];
  sections: LegalSection[];
}

export declare const LEGAL_META: {
  brandName: string;
  operatorName: string;
  appName: string;
  bundleId: string;
  websiteUrl: string;
  lmsPortalUrl: string;
  supportHotline: string;
  consultHotline: string;
  zaloPhone: string;
  effectiveDate: string;
  version: string;
};

export declare const LEGAL_DOCUMENTS: {
  terms: LegalDocumentData;
  privacy: LegalDocumentData;
};

export declare function getLegalDocument(type?: 'terms' | 'privacy' | string): LegalDocumentData;
