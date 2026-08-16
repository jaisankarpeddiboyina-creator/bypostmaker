import { PlatformAdapter } from '../sdk/PlatformAdapter';

const CORE_VERSION = '0.1.0';

export class AdapterRegistry {
  private adapters = new Map<string, PlatformAdapter>();

  register(adapter: PlatformAdapter): void {
    const { id, minimumCoreVersion } = adapter.manifest;

    if (!this.isCompatible(minimumCoreVersion, CORE_VERSION)) {
      throw new Error(
        `Adapter "${id}" requires core >= ${minimumCoreVersion}, running ${CORE_VERSION}`
      );
    }
    if (this.adapters.has(id)) {
      throw new Error(`Adapter "${id}" already registered`);
    }
    this.adapters.set(id, adapter);
  }

  get(id: string): PlatformAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`No adapter registered for platform "${id}"`);
    return adapter;
  }

  list(): PlatformAdapter[] {
    return [...this.adapters.values()];
  }

  private isCompatible(required: string, actual: string): boolean {
    const [rMaj, rMin] = required.split('.').map(Number);
    const [aMaj, aMin] = actual.split('.').map(Number);
    if (aMaj !== rMaj) return aMaj > rMaj;
    return aMin >= rMin;
  }
}
