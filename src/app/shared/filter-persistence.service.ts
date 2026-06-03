import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FilterPersistenceService {

  private readonly prefix = 'zoho_kyc_filter_';

  save(pageKey: string, state: Record<string, unknown>): void {
    try {
      localStorage.setItem(this.prefix + pageKey, JSON.stringify(state));
    } catch { /* storage unavailable (private/incognito) */ }
  }

  load<T extends Record<string, unknown>>(pageKey: string): T | null {
    try {
      const raw = localStorage.getItem(this.prefix + pageKey);
      if (!raw) return null;
      return JSON.parse(raw, (_key, value) => {
        // Revive ISO date strings back to Date objects
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          const d = new Date(value);
          return isNaN(d.getTime()) ? value : d;
        }
        return value;
      }) as T;
    } catch {
      return null;
    }
  }

  clear(pageKey: string): void {
    try {
      localStorage.removeItem(this.prefix + pageKey);
    } catch { /* storage unavailable */ }
  }
}
