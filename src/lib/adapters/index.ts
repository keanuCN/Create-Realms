import { arkAdapter } from "./ark";
import { dashscopeAdapter } from "./dashscope";
import { klingAdapter } from "./kling";
import { minimaxAdapter } from "./minimax";
import { pixverseAdapter } from "./pixverse";
import { viduAdapter } from "./vidu";
import type { ProviderAdapter } from "./types";

const registry = new Map<string, ProviderAdapter>(
  [
    minimaxAdapter,
    arkAdapter,
    klingAdapter,
    pixverseAdapter,
    viduAdapter,
    dashscopeAdapter,
  ].map((adapter) => [adapter.id, adapter]),
);

export function getAdapter(provider: string): ProviderAdapter | undefined {
  return registry.get(provider);
}

export function listAdapters(): ProviderAdapter[] {
  return [...registry.values()];
}

export function registerAdapter(adapter: ProviderAdapter): void {
  registry.set(adapter.id, adapter);
}

export * from "./types";
export { downloadRemote } from "./http";