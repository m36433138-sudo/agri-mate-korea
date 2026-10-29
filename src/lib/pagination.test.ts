import { describe, it, expect } from 'vitest';
import { fetchAllRows } from './pagination';

describe('machine list completeness', () => {
  it('includes machines after the first 1000 records', async () => {
    const machines = Array.from({ length: 1468 }, (_, id) => ({ id, model: id === 1467 ? 'D4351' : 'other' }));
    const rows = await fetchAllRows(async (from, to) => ({ data: machines.slice(from, to + 1), error: null }));
    expect(rows).toHaveLength(1468);
    expect(rows[1467].model).toBe('D4351');
  });
  it('does not accept incomplete data when a later page fails', async () => {
    await expect(fetchAllRows(async (from) => from === 0
      ? { data: Array.from({ length: 1000 }, (_, id) => id), error: null }
      : { data: null, error: { message: 'failed' } })).rejects.toThrow('failed');
  });
});