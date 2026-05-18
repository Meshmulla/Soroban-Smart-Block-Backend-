import { xdr, scValToNative, Address } from '@stellar/stellar-sdk';
import { prisma } from '../db';

export interface ContractAbi {
  functions: AbiFunction[];
}

export interface AbiFunction {
  name: string;
  inputs: AbiParam[];
  humanTemplate?: string; // e.g. "{from} swapped {amount_in} {token_in} → {amount_out} {token_out}"
}

export interface AbiParam {
  name: string;
  type: string;
}

// Built-in ABI for SEP-41 token standard
export const SEP41_ABI: ContractAbi = {
  functions: [
    {
      name: 'transfer',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'i128' },
      ],
      humanTemplate: '{from} transferred {amount} tokens to {to}',
    },
    {
      name: 'transfer_from',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'i128' },
      ],
      humanTemplate: '{spender} transferred {amount} tokens from {from} to {to}',
    },
    {
      name: 'mint',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'i128' },
      ],
      humanTemplate: 'Minted {amount} tokens to {to}',
    },
    {
      name: 'burn',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'amount', type: 'i128' },
      ],
      humanTemplate: '{from} burned {amount} tokens',
    },
    {
      name: 'approve',
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'i128' },
        { name: 'expiration_ledger', type: 'u32' },
      ],
      humanTemplate: '{from} approved {spender} to spend {amount} tokens',
    },
  ],
};

/**
 * Get ABI for a contract address. Falls back to SEP-41 for token contracts.
 */
export async function getContractAbi(contractAddress: string): Promise<ContractAbi | null> {
  const contract = await prisma.contract.findUnique({ where: { address: contractAddress } });
  if (!contract) return null;
  if (contract.isToken) return SEP41_ABI;
  if (contract.abi) return contract.abi as unknown as ContractAbi;
  return null;
}

/**
 * Decode raw XDR ScVal arguments into a named map using the ABI.
 */
export function decodeArgs(
  fnName: string,
  rawArgs: xdr.ScVal[],
  abi: ContractAbi
): Record<string, unknown> | null {
  const fn = abi.functions.find((f) => f.name === fnName);
  if (!fn) return null;

  const result: Record<string, unknown> = {};
  fn.inputs.forEach((param, i) => {
    const val = rawArgs[i];
    if (!val) return;
    try {
      result[param.name] = scValToNative(val);
    } catch {
      result[param.name] = val.toXDR('base64');
    }
  });
  return result;
}

/**
 * Render a human-readable string from decoded args and a template.
 */
export function renderHuman(
  fnName: string,
  args: Record<string, unknown>,
  abi: ContractAbi,
  contractName?: string | null,
  decimals?: number
): string {
  const fn = abi.functions.find((f) => f.name === fnName);
  if (!fn?.humanTemplate) return `Called ${fnName} on ${contractName ?? 'contract'}`;

  let text = fn.humanTemplate;
  for (const [key, val] of Object.entries(args)) {
    let display = String(val);
    // Format i128 amounts with decimals
    if (decimals && (key === 'amount' || key === 'amount_in' || key === 'amount_out')) {
      const num = BigInt(display);
      const divisor = BigInt(10 ** decimals);
      display = (Number(num) / Number(divisor)).toFixed(decimals > 4 ? 4 : decimals);
    }
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), display);
  }
  if (contractName) text += ` on ${contractName}`;
  return text;
}
