import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useUi } from '../lib/ui-context';

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  sortValue?: (row: Row) => number | string;
  numeric?: boolean;
}

/** Semantic table; becomes a stacked list on phones. Sortable columns announce their state. */
export function DataTable<Row>({ rows, columns, rowKey, caption, empty }: { rows: Row[]; columns: Column<Row>[]; rowKey: (r: Row) => string; caption: string; empty?: ReactNode }) {
  const { t } = useUi();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    return [...rows].sort((a, b) => (col.sortValue!(a) > col.sortValue!(b) ? sort.dir : -sort.dir));
  }, [rows, columns, sort]);
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-start">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined} className={cn('p-3 text-label font-medium uppercase text-fg-secondary', c.numeric ? 'text-end' : 'text-start')}>
                {c.sortValue ? (
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))} aria-label={`${c.header}: ${sort?.key === c.key && sort.dir === 1 ? t.sortDesc : t.sortAsc}`}>
                    {c.header}
                    {sort?.key === c.key ? sort.dir === 1 ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" /> : null}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className="flex flex-col border-b border-border p-3 last:border-0 md:table-row md:p-0">
              {columns.map((c) => (
                <td key={c.key} className={cn('flex justify-between gap-4 py-1 md:table-cell md:p-3', c.numeric && 'ag-tabular md:text-end')}>
                  <span className="text-caption text-fg-secondary md:hidden">{c.header}</span>
                  <span>{c.cell(r)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatTile({ label, value, hint, trend }: { label: string; value: string; hint?: string; trend?: 'up' | 'down' | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <p className="text-label uppercase text-fg-secondary">{label}</p>
      <p className="ag-tabular font-display text-h1">
        {value}
        {trend ? <span aria-hidden className={cn('ms-2 text-caption', trend === 'up' ? 'text-available' : 'text-danger')}>{trend === 'up' ? '▲' : '▼'}</span> : null}
      </p>
      {hint ? <p className="text-caption text-fg-secondary">{hint}</p> : null}
    </div>
  );
}
