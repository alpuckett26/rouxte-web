// Square payments — server-side only. Do NOT import in client components.
import { SquareClient, SquareEnvironment } from "square";

let _client: SquareClient | null = null;

/** Lazily initialized Square client — safe at build time. */
export function getSquare(): SquareClient {
  if (!_client) {
    _client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
  }
  return _client;
}

export const SQUARE_LOCATION_ID = () =>
  process.env.SQUARE_LOCATION_ID ?? "";
