import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

export const transactionRouter = Router();

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /transactions?page=1&limit=20&contract=&account=
transactionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { contract, account, status } = req.query as Record<string, string>;
    const skip = (page - 1) * limit;

    const where = {
      ...(contract && { contractAddress: contract }),
      ...(account && { sourceAccount: account }),
      ...(status && { status }),
    };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { ledger: 'desc' },
        skip,
        take: limit,
        select: {
          hash: true,
          ledger: true,
          ledgerCloseTime: true,
          sourceAccount: true,
          contractAddress: true,
          functionName: true,
          status: true,
          humanReadable: true,
          feeCharged: true,
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ data: transactions, total, page, limit });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// GET /transactions/:hash
transactionRouter.get('/:hash', async (req: Request, res: Response) => {
  const tx = await prisma.transaction.findUnique({
    where: { hash: req.params.hash },
    include: { events: true },
  });
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});
