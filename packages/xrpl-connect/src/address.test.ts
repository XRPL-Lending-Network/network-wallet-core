import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { Address } from './address';

describe('Address.generateXamanSecretNumbers()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps every group within the 16 bits a Secret Numbers group encodes', () => {
    for (let run = 0; run < 500; run++) {
      const groups = Address.generateXamanSecretNumbers();
      expect(Address.isValidXamanSecretNumbers(groups)).toBe(true);
      for (const group of groups) {
        expect(Number(group.slice(0, 5))).toBeLessThanOrEqual(0xffff);
      }
    }
  });

  it('uses the largest value a group can hold without overflowing', () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint16Array) => array.fill(0xffff) });
    const groups = Address.generateXamanSecretNumbers();
    expect(groups.map((group) => group.slice(0, 5))).toEqual(Array(8).fill('65535'));
    expect(Address.isValidXamanSecretNumbers(groups)).toBe(true);
  });

  it('never falls back to Math.random', () => {
    vi.stubGlobal('crypto', undefined);
    const random = vi.spyOn(Math, 'random');
    expect(() => Address.generateXamanSecretNumbers()).toThrow(/Secure randomness/);
    expect(random).not.toHaveBeenCalled();
  });
});
