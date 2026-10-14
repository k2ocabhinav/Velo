export interface SecurityHeader {
  key: string;
  value: string;
}

export interface SecurityHeaderOptions {
  apiBaseUrl?: string;
  environment?: string;
}

export function createSecurityHeaders(options?: SecurityHeaderOptions): SecurityHeader[];
