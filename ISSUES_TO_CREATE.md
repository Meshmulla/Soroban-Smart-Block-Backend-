# GitHub Issues to Create

Create these on GitHub after pushing the repo. Apply the `Stellar Wave` label to all of them.
Use **New Issue → Wave Issue** template for each.

---

## Issue 1 — Add cursor-based pagination to `/transactions`

**Labels:** `Stellar Wave`, `enhancement`, `good first issue`
**Complexity:** Medium (150 pts)

### Context
The current `/api/v1/transactions` endpoint uses offset-based pagination (`page` + `limit`). For a block explorer with high write throughput, offset pagination becomes slow and can return duplicate or skipped rows as new ledgers are indexed.

### Task
Replace offset pagination with cursor-based pagination using the transaction `ledger` field as the cursor.

- Add optional `cursor` query param (a ledger number). When provided, return results with `ledger < cursor` (descending).
- Return a `nextCursor` field in the response pointing to the last item's ledger.
- Keep backward compatibility: if `cursor` is absent, behave as before.

### Acceptance criteria
- [ ] `GET /api/v1/transactions?cursor=5000000&limit=20` returns correct results
- [ ] Response includes `nextCursor` field
- [ ] Existing `page`/`limit` params still work
- [ ] Unit test covering cursor logic
- [ ] No TypeScript errors (`npm run build` passes)

---

## Issue 2 — Add Horizon fallback for transaction fetch

**Labels:** `Stellar Wave`, `enhancement`
**Complexity:** Medium (150 pts)

### Context
In `src/indexer/indexer.ts`, when the indexer fetches a transaction by hash via `getTransaction()`, it calls the Soroban RPC node. RPC nodes have limited history windows (typically 7 days). Transactions older than that return `NOT_FOUND`.

### Task
Add a fallback to the Horizon REST API when the RPC returns `NOT_FOUND` or throws.

- In `src/indexer/rpc.ts`, add `getTransactionFromHorizon(hash: string)` using `axios` against `config.horizonUrl`.
- In `src/indexer/indexer.ts`, try RPC first, fall back to Horizon on failure.
- Map the Horizon response fields (`source_account`, `fee_charged`, `envelope_xdr`) to the same shape used by the RPC result.

### Acceptance criteria
- [ ] Indexer does not crash when RPC returns NOT_FOUND
- [ ] Transaction is stored with correct `sourceAccount` and `rawXdr` from Horizon
- [ ] Fallback is logged at `debug` level
- [ ] No TypeScript errors

---

## Issue 3 — Add `/api/v1/tokens/:address/balance/:account` endpoint

**Labels:** `Stellar Wave`, `enhancement`
**Complexity:** Medium (150 pts)

### Context
The explorer tracks SEP-41 token transfers but has no way to query the current balance of an account for a given token. This is useful for wallet history views.

### Task
Add `GET /api/v1/tokens/:address/balance/:account` that queries the token balance by calling the Soroban RPC `simulateTransaction` with the SEP-41 `balance(address)` function.

- Use `rpc.simulateTransaction` with a minimal `invokeHostFunction` operation calling `balance` on the token contract.
- Return `{ address, account, balance, symbol, decimals }`.
- Return 404 if the contract is not a registered token.

### Acceptance criteria
- [ ] Endpoint returns correct balance for a known testnet token
- [ ] Handles RPC errors gracefully (returns 502 with error message)
- [ ] Response includes `decimals` for frontend formatting
- [ ] No TypeScript errors

---

## Issue 4 — Add contract function call statistics endpoint

**Labels:** `Stellar Wave`, `enhancement`
**Complexity:** Medium (150 pts)

### Context
There is no way to see which functions on a contract are called most frequently. This is a core block explorer feature — Etherscan shows "Top Methods" for every contract.

### Task
Add `GET /api/v1/contracts/:address/stats` that returns aggregated call counts per function.

- Query the `Transaction` table, group by `functionName` where `contractAddress = :address`.
- Return `[{ functionName, callCount, lastCalledAt }]` sorted by `callCount` desc.
- Add a `since` query param (ISO date string) to filter by `ledgerCloseTime >= since`.

### Acceptance criteria
- [ ] Returns correct counts from the DB
- [ ] `since` filter works correctly
- [ ] Empty array (not 404) when contract exists but has no transactions
- [ ] No TypeScript errors

---

## Issue 5 — Add API integration tests for `/transactions` and `/events`

**Labels:** `Stellar Wave`, `good first issue`
**Complexity:** Medium (150 pts)

### Context
The project has unit tests for the decoder but no integration tests for the API routes. Contributors need confidence that route changes don't break the API contract.

### Task
Add integration tests using `vitest` + `supertest` for:
- `GET /api/v1/transactions` — pagination, filtering by `contract`, `account`, `status`
- `GET /api/v1/transactions/:hash` — 200 with events, 404 for unknown hash
- `GET /api/v1/events` — pagination, filtering by `contract`, `type`

Use an in-memory SQLite database (via `DATABASE_URL=file::memory:?cache=shared`) or mock Prisma with `vitest-mock-extended`.

### Acceptance criteria
- [ ] At least 8 test cases covering the above routes
- [ ] Tests run with `npm test` without a live database
- [ ] All tests pass
- [ ] No TypeScript errors

---

## Issue 6 — Decode `fee_bump` transaction envelopes

**Labels:** `Stellar Wave`, `enhancement`
**Complexity:** High (200 pts)

### Context
The decoder in `src/indexer/decoder.ts` handles `envelopeTypeTx` (v1) and `envelopeTypeTxV0` (v0) but silently returns `null` for `envelopeTypeTxFeeBump`. Fee-bump transactions wrap an inner transaction and are common on Stellar mainnet.

### Task
Handle `envelopeTypeTxFeeBump` in `decodeTransaction`:
- Extract the inner transaction from `envelope.feeBump().tx().innerTx()`.
- The inner tx is itself a `TransactionEnvelope` — recurse or inline the v1 decode path.
- Set `humanReadable` to include a note: `"(fee-bump) {inner human readable}"`.

### Acceptance criteria
- [ ] Fee-bump envelopes are decoded correctly
- [ ] Inner transaction's `contractAddress`, `functionName`, `functionArgs` are populated
- [ ] `humanReadable` is prefixed with `(fee-bump)`
- [ ] Unit test with a real fee-bump XDR fixture
- [ ] No TypeScript errors

---

## Issue 7 — Add `GET /api/v1/search?q=` endpoint

**Labels:** `Stellar Wave`, `enhancement`
**Complexity:** High (200 pts)

### Context
Block explorers need a universal search box. Users should be able to paste a transaction hash, contract address, or account address and get routed to the right resource.

### Task
Add `GET /api/v1/search?q=<query>` that detects the input type and returns the matching resource.

Detection rules:
- 64-char hex string → look up as transaction hash
- Starts with `C` and 56 chars → look up as contract address
- Starts with `G` and 56 chars → look up as account (return recent transactions)
- Otherwise → return `{ type: 'unknown' }`

Return `{ type: 'transaction'|'contract'|'account'|'unknown', data: <resource> }`.

### Acceptance criteria
- [ ] Correctly identifies and returns all 3 resource types
- [ ] Returns 200 with `type: 'unknown'` for unrecognized input (not 404)
- [ ] Unit tests for each detection branch
- [ ] No TypeScript errors

---

## Issue 8 — Add rate limiting per IP with Redis (optional) or in-memory fallback

**Labels:** `Stellar Wave`, `enhancement`
**Complexity:** High (200 pts)

### Context
The current rate limiter uses `express-rate-limit` with the default in-memory store. This doesn't work correctly when running multiple API instances (e.g., Docker Compose scale-out). A Redis store would fix this, but Redis is an optional dependency.

### Task
- Add `rate-limit-redis` as an optional dependency.
- If `REDIS_URL` env var is set, use Redis store for `express-rate-limit`.
- If `REDIS_URL` is not set, fall back to the existing in-memory store (no breaking change).
- Add `REDIS_URL` to `.env.example` with a comment marking it optional.
- Update `docker-compose.yml` to include an optional Redis service (commented out by default).

### Acceptance criteria
- [ ] App starts without Redis (no `REDIS_URL` set)
- [ ] App uses Redis store when `REDIS_URL` is set
- [ ] `docker-compose.yml` has a commented Redis service block
- [ ] No TypeScript errors

---

## Issue 9 — Add `decoded` field to transaction list response

**Labels:** `Stellar Wave`, `good first issue`
**Complexity:** Trivial (100 pts)

### Context
`GET /api/v1/transactions` returns `humanReadable` but not the structured `functionArgs`. Frontend developers need the decoded args to build rich UI without re-parsing.

### Task
Add `functionArgs` to the `select` clause in `src/api/transactions.ts` for both the list and detail endpoints. Ensure the field is included in the response.

### Acceptance criteria
- [ ] `functionArgs` appears in `GET /api/v1/transactions` list response
- [ ] `functionArgs` appears in `GET /api/v1/transactions/:hash` detail response
- [ ] No TypeScript errors

---

## Issue 10 — Write a `GET /health` extended health check

**Labels:** `Stellar Wave`, `good first issue`
**Complexity:** Trivial (100 pts)

### Context
The current `/health` endpoint returns `{ status: 'ok' }`. Operators need to know if the database and RPC node are reachable, and how far behind the indexer is.

### Task
Extend `GET /health` to return:
```json
{
  "status": "ok" | "degraded",
  "db": "ok" | "error",
  "rpc": "ok" | "error",
  "indexerLag": 42,
  "lastIndexedLedger": 5000000,
  "latestLedger": 5000042
}
```

- Check DB with `prisma.$queryRaw\`SELECT 1\``.
- Check RPC with `getLatestLedger()`.
- Read `lastIndexedLedger` from `IndexerState`.
- Set `status: 'degraded'` if DB or RPC check fails.
- Respond in under 2 seconds (add a timeout).

### Acceptance criteria
- [ ] Returns all fields listed above
- [ ] `status` is `degraded` when DB is unreachable
- [ ] Response time < 2s (use `Promise.race` with a timeout)
- [ ] No TypeScript errors
