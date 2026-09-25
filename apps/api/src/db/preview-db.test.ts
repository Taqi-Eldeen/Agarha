import { previewDbName, withDatabase } from './preview-db';

describe('preview database helpers', () => {
  it('only accepts numeric PR ids (safe as an identifier)', () => {
    expect(previewDbName(123)).toBe('agarha_pr_123');
    expect(() => previewDbName('1; drop database agarha')).toThrow();
  });
  it('swaps the database in a connection string', () => {
    expect(withDatabase('postgres://u:p@db:5432/agarha?sslmode=require', 'agarha_pr_7')).toBe(
      'postgres://u:p@db:5432/agarha_pr_7?sslmode=require',
    );
  });
});
