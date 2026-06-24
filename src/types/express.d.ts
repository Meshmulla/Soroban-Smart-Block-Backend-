import type { TokenBucketResult, RateLimitTier } from '../middleware/tokenBucket';
import type { NetworkName, NetworkProfile } from '../profiles';

/** API key context attached by apiKeyAuth middleware. */
export interface ApiKeyContext {
  id: string;
  keyName: string;
  developerId: string;
  tier: RateLimitTier;
  rateLimitOverride?: number;
  allowedIps?: string[];
  allowedEndpoints?: string[];
}

/** Cold-storage routing context attached by coldStorageRouter middleware. */
export interface ColdStorageContext {
  enabled: boolean;
  type: 'parquet' | 'glacier' | 'archive';
  path?: string;
  ledgerSeq: number;
}

declare global {
  namespace Express {
    interface Request {
      // ── Core framework fields ──────────────────────────────────────────────
      body: unknown;

      // ── Network context (networkRouter middleware) ─────────────────────────
      /** Resolved Stellar network name (testnet | mainnet | devnet). */
      network: NetworkName;
      /** Full network profile including RPC/Horizon URLs. */
      networkProfile: NetworkProfile;

      // ── Cold-storage routing (coldStorageRouter middleware) ────────────────
      /**
       * Populated when the request targets a ledger older than
       * RECENT_LEDGER_DAYS. Undefined for hot-path requests.
       */
      coldStorage?: ColdStorageContext;

      // ── Auth & rate limiting (apiKeyAuth + tieredRateLimit middlewares) ────
      /** API key metadata. Undefined when no X-Api-Key header is sent. */
      apiKey?: ApiKeyContext;
      /** Token-bucket result attached by tieredRateLimit. */
      rateLimitResult?: TokenBucketResult;

      // ── Audit / admin context (freeze / adminAuth middleware) ───────────────
      /**
       * Admin actor identity injected by the adminAuth middleware in
       * freeze.ts. Value is the X-Admin-Token or X-Actor header string.
       */
      actor?: string;
    }
  }
}
