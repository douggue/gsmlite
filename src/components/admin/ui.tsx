import { Children, Fragment, cloneElement, isValidElement } from "react";
export function PageTitle({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="display text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** What an empty list is for, and how to fill it. */
export function Empty({ title, hint, action }: { title: string; hint?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Adds each column's header as a data-label on its cells, so phones can show rows as labeled cards. */
function labelCells(children: React.ReactNode, head: string[]): React.ReactNode {
  return Children.map(children, (row) => {
    if (!isValidElement<{ children?: React.ReactNode }>(row)) return row;
    if (row.type === Fragment) return cloneElement(row, {}, labelCells(row.props.children, head));
    let i = 0;
    const cells = Children.map(row.props.children, (cell) => {
      if (!isValidElement(cell)) return cell;
      const label = head[i++] ?? "";
      return cloneElement(cell as React.ReactElement<Record<string, unknown>>, { "data-label": label });
    });
    return cloneElement(row, {}, cells);
  });
}

/** Table on wide screens; on phones each row becomes a card with "Label · value" lines. */
export function Table({ head, children, empty, emptyText }: { head: string[]; children: React.ReactNode; empty?: boolean; emptyText?: React.ReactNode }) {
  return (
    <div className="card rtable overflow-x-auto">
      <table className={`w-full text-left text-sm ${head.length > 4 ? "sm:min-w-[640px]" : ""}`}>
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{labelCells(children, head)}</tbody>
      </table>
      {empty && (emptyText ? <div>{emptyText}</div> : <p className="p-8 text-center text-sm text-muted">Nothing here yet.</p>)}
    </div>
  );
}

/** Number card (same style everywhere): label, big number, optional note and link. */
export function Stat({ label, value, tone, delta, note, href }: { label: string; value: React.ReactNode; tone?: "warn" | "danger" | "good"; delta?: { text: string; good: boolean }; note?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className={`display mt-1.5 min-w-0 break-words text-[28px] font-bold leading-none tracking-tight tabular-nums ${tone === "warn" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "good" ? "text-primary" : ""}`}>{value}</p>
      {(note || delta) && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {delta && <span className={`badge ${delta.good ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{delta.text}</span>}
          {note}
        </p>
      )}
    </>
  );
  return href ? <a href={href} className="card block p-4 transition-colors hover:border-primary">{body}</a> : <div className="card p-4">{body}</div>;
}

/** Save row for long forms: stays in view while scrolling, above the phone bottom bar, on its own solid strip so it never covers a field. */
export function SaveBar({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
      {note && <p className="mr-auto text-xs text-muted">{note}</p>}
      {children}
    </div>
  );
}
