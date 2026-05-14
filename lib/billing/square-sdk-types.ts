/**
 * Shared TypeScript shapes for the Square Web Payments SDK.
 * Loaded via <script src="https://web.squarecdn.com/v1/square.js">.
 * We only model the surface our checkout actually uses.
 */

export interface SquarePayments {
  card: () => Promise<SquarePaymentMethod>;
  paymentRequest: (opts: SquarePaymentRequestOptions) => SquarePaymentRequest;
  applePay: (req: SquarePaymentRequest) => Promise<SquarePaymentMethod>;
  googlePay: (req: SquarePaymentRequest) => Promise<SquarePaymentMethod>;
}

export interface SquarePaymentRequestOptions {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string; pending?: boolean };
}

export interface SquarePaymentRequest { /* opaque */ }

export interface SquarePaymentMethod {
  attach: (selector: string | HTMLElement) => Promise<void>;
  tokenize: () => Promise<{
    status: "OK" | "Error";
    token?: string;
    errors?: Array<{ message: string }>;
  }>;
  destroy?: () => Promise<void>;
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}
