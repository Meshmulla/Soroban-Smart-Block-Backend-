import { prisma } from '../db';
import { config } from '../config';
import { fetchEvents, getLatestLedger, getTransaction } from './rpc';
import { decodeTransaction, decodeEvent } from './decoder';

const BATCH = config.indexerBatchSize;

async function getLastIndexedLedger(): Promise<number> {
  const state = await prisma.indexerState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', lastLedger: config.indexerStartLedger },
  });
  return state.lastLedger;
}

async function setLastIndexedLedger(ledger: number) {
  await prisma.indexerState.update({ where: { id: 'singleton' }, data: { lastLedger: ledger } });
}

async function processLedgerRange(start: number, end: number) {
  console.log(`Indexing ledgers ${start} → ${end}`);
  const events = await fetchEvents(start, end);

  for (const event of events) {
    // Ensure contract row exists
    await prisma.contract.upsert({
      where: { address: event.contractId },
      update: {},
      create: { address: event.contractId },
    });

    // Ensure transaction row exists
    const existingTx = await prisma.transaction.findUnique({ where: { hash: event.transactionHash } });
    if (!existingTx) {
      const txResult = await getTransaction(event.transactionHash).catch(() => null);
      const rawXdr = (txResult as any)?.envelopeXdr?.toXDR('base64') ?? '';
      const decoded = rawXdr ? await decodeTransaction(rawXdr) : {
        contractAddress: event.contractId,
        functionName: null,
        functionArgs: null,
        humanReadable: null,
      };

      await prisma.transaction.upsert({
        where: { hash: event.transactionHash },
        update: {},
        create: {
          hash: event.transactionHash,
          ledger: event.ledger,
          ledgerCloseTime: event.ledgerCloseTime,
          sourceAccount: (txResult as any)?.sourceAccount ?? 'unknown',
          contractAddress: decoded.contractAddress,
          functionName: decoded.functionName,
          functionArgs: decoded.functionArgs as object ?? undefined,
          rawXdr,
          status: (txResult as any)?.status === 'SUCCESS' ? 'success' : 'failed',
          humanReadable: decoded.humanReadable,
          feeCharged: String((txResult as any)?.feeCharged ?? ''),
        },
      });
    }

    // Decode and store event
    const { eventType, decoded } = decodeEvent(event.topics, event.data);
    await prisma.event.upsert({
      where: { id: `${event.transactionHash}-${event.topics[0] ?? '0'}` },
      update: {},
      create: {
        id: `${event.transactionHash}-${event.topics[0] ?? '0'}`,
        transactionHash: event.transactionHash,
        contractAddress: event.contractId,
        eventType,
        topics: event.topics,
        data: { raw: event.data },
        decoded: decoded as object,        ledger: event.ledger,
        ledgerCloseTime: event.ledgerCloseTime,
      },
    });
  }

  console.log(`Processed ${events.length} events in ledgers ${start}–${end}`);
}

export async function runIndexer() {
  console.log('🔍 Soroban indexer starting...');

  while (true) {
    try {
      const latest = await getLatestLedger();
      const last = await getLastIndexedLedger();

      if (last >= latest) {
        await sleep(config.indexerPollIntervalMs);
        continue;
      }

      const end = Math.min(last + BATCH, latest);
      await processLedgerRange(last + 1, end);
      await setLastIndexedLedger(end);
    } catch (err) {
      console.error('Indexer error:', err);
      await sleep(config.indexerPollIntervalMs);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
