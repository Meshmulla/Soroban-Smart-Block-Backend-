import { SorobanRpc, xdr, StrKey } from '@stellar/stellar-sdk';
import { config } from '../config';

export const rpc = new SorobanRpc.Server(config.stellarRpcUrl, { allowHttp: false });

export interface LedgerEvent {
  contractId: string;
  transactionHash: string;
  ledger: number;
  ledgerCloseTime: Date;
  topics: string[];
  data: string;
}

/**
 * Fetch Soroban events for a ledger range from the RPC node.
 */
export async function fetchEvents(startLedger: number, endLedger: number): Promise<LedgerEvent[]> {
  const response = await rpc.getEvents({
    startLedger,
    filters: [{ type: 'contract' }],
  });

  return (response.events ?? [])
    .filter((e) => e.ledger <= endLedger)
    .map((e) => ({
      contractId: String(e.contractId ?? ''),
      transactionHash: e.txHash,
      ledger: e.ledger,
      ledgerCloseTime: new Date(e.ledgerClosedAt),
      topics: e.topic.map((t) => t.toXDR('base64')),
      data: e.value.toXDR('base64'),
    }));
}

/**
 * Fetch the latest ledger number from the RPC node.
 */
export async function getLatestLedger(): Promise<number> {
  const info = await rpc.getLatestLedger();
  return info.sequence;
}

/**
 * Fetch a transaction by hash.
 */
export async function getTransaction(hash: string) {
  return rpc.getTransaction(hash);
}
