import type { BankAdapter } from "@/lib/banking/types";

const adapterRegistry = new Map<string, BankAdapter>();

export function registerAdapter(adapter: BankAdapter): void {
  adapterRegistry.set(adapter.institutionId, adapter);
}

export function getAdapter(institutionId: string): BankAdapter | undefined {
  return adapterRegistry.get(institutionId);
}

export function listAdapters(): BankAdapter[] {
  return Array.from(adapterRegistry.values());
}
