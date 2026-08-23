"use client";

import { useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The spreadsheet (`PLAN/FIX_ADMIN_DASH.md` §2a).
 *
 * A real `<table>` you can type into: click a cell, it becomes an input in
 * place; Tab walks across the row, Enter commits and drops one row down, Esc
 * reverts. Two screens use it — the door table on event night and the
 * cross-event Customers page — so it knows nothing about check-ins, events or
 * fetch: callers hand it rows, describe the columns, and get a callback per
 * committed cell.
 *
 * It stays a table rather than becoming a canvas grid because that is what
 * makes it readable to a screen reader, sortable with real `aria-sort`, and
 * printable — and at cafe scale (a few hundred rows) nothing here needs
 * virtualising.
 */

/** How one column turns into an editable control. Omit for a read-only column. */
export type GridEditor<Row> =
  | {
      kind: "text" | "tel";
      value: (row: Row) => string;
      /** Rejects the edit before it ever reaches the network. */
      validate?: (raw: string) => boolean;
    }
  | {
      kind: "number";
      value: (row: Row) => string;
      min?: number;
      step?: string;
      validate?: (raw: string) => boolean;
    }
  | {
      kind: "select";
      value: (row: Row) => string;
      options: { value: string; label: string }[];
    };

export type GridColumn<Row> = {
  key: string;
  header: string;
  align?: "start" | "end";
  /** Read view. Falls back to the editor's own value, or an em dash. */
  render?: (row: Row) => React.ReactNode;
  editor?: GridEditor<Row>;
  /** Adds a sort toggle to this header. Client-side, on the string in `sortValue`. */
  sortable?: boolean;
  /** What sorting compares. Defaults to the editor value; numbers sort numerically. */
  sortValue?: (row: Row) => string | number;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataGridProps<Row> = {
  rows: Row[];
  columns: GridColumn<Row>[];
  rowId: (row: Row) => string;
  /**
   * Persist one cell. Resolve `true` to keep the typed value, `false` to snap
   * the cell back to what it was — the grid holds no opinion about why.
   */
  onCommit?: (rowId: string, columnKey: string, value: string) => Promise<boolean>;
  onDelete?: (row: Row) => void | Promise<void>;
  /** Rendered in place of the table body when there is nothing to show. */
  empty?: React.ReactNode;
  labels: {
    /** Accessible name for the per-row delete button. */
    delete: string;
    /** Announced while a cell is being saved. */
    saving: string;
    /** Shown under the table when a commit is rejected. */
    error: string;
    /** Hint on a read-mode cell, e.g. "Click to edit". */
    editHint: string;
  };
  className?: string;
};

type Cursor = { row: number; col: number } | null;

const EDGE = "px-3 py-1.5";

export function DataGrid<Row>({
  rows,
  columns,
  rowId,
  onCommit,
  onDelete,
  empty,
  labels,
  className,
}: DataGridProps<Row>) {
  const [cursor, setCursor] = useState<Cursor>(null);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editableCols = useMemo(
    () => columns.map((c, i) => (c.editor ? i : -1)).filter((i) => i >= 0),
    [columns]
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;

    const read = (row: Row): string | number => {
      if (column.sortValue) return column.sortValue(row);
      if (column.editor) return column.editor.value(row);
      return "";
    };

    // Copy first: `rows` belongs to the caller and `sort` must not reorder it.
    return [...rows].sort((a, b) => {
      const x = read(a);
      const y = read(b);
      const cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  /** Next editable column, wrapping onto the next/previous row at either end. */
  function step(from: Cursor, delta: number): Cursor {
    if (!from) return null;
    const at = editableCols.indexOf(from.col);
    const next = at + delta;
    if (next >= 0 && next < editableCols.length) {
      return { row: from.row, col: editableCols[next] };
    }
    const row = from.row + (delta > 0 ? 1 : -1);
    if (row < 0 || row >= sorted.length) return null;
    return {
      row,
      col: delta > 0 ? editableCols[0] : editableCols[editableCols.length - 1],
    };
  }

  async function commit(row: Row, column: GridColumn<Row>, raw: string) {
    const id = rowId(row);
    const cellKey = `${id}:${column.key}`;
    const editor = column.editor;
    if (!editor || !onCommit) return;

    // Nothing typed, or nothing changed: never spend a request on it.
    const original = editor.value(row);
    if (raw === original) return;

    if ("validate" in editor && editor.validate && !editor.validate(raw)) {
      setError(labels.error);
      return;
    }

    setSavingCell(cellKey);
    setError(null);
    try {
      const ok = await onCommit(id, column.key, raw);
      if (!ok) setError(labels.error);
    } catch {
      setError(labels.error);
    } finally {
      setSavingCell((current) => (current === cellKey ? null : current));
    }
  }

  if (rows.length === 0 && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={className}>
      {/* The only scroll container: wide columns scroll here, the page never
          scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead className="dk-thead text-xs uppercase tracking-wider">
            <tr>
              {columns.map((column) => {
                // Narrowed to the object (not a boolean) so `.dir` stays
                // reachable inside the JSX below.
                const active = sort && sort.key === column.key ? sort : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      column.sortable
                        ? active
                          ? active.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      EDGE,
                      "font-semibold",
                      column.align === "end" ? "text-end" : "text-start",
                      column.headerClassName
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex min-h-11 items-center gap-1 uppercase tracking-wider hover:text-ink"
                      >
                        {column.header}
                        <span aria-hidden="true" className="text-[0.65rem]">
                          {active ? (active.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {onDelete ? (
                <th scope="col" className={cn(EDGE, "w-10")}>
                  <span className="sr-only">{labels.delete}</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row, rowIndex) => {
              const id = rowId(row);
              return (
                <tr key={id} className="dk-hairline border-t">
                  {columns.map((column, colIndex) => {
                    const editing =
                      cursor?.row === rowIndex && cursor.col === colIndex && !!column.editor;
                    const cellKey = `${id}:${column.key}`;

                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "p-0 align-middle",
                          column.align === "end" ? "text-end" : "text-start",
                          column.cellClassName
                        )}
                      >
                        {editing && column.editor ? (
                          <CellEditor
                            // Remounting per cell is what gives `autoFocus`
                            // something to do on every move.
                            key={cellKey}
                            editor={column.editor}
                            initial={column.editor.value(row)}
                            align={column.align}
                            onDone={(raw, move) => {
                              setCursor(
                                move === "stay"
                                  ? null
                                  : move === "down"
                                    ? rowIndex + 1 < sorted.length
                                      ? { row: rowIndex + 1, col: colIndex }
                                      : null
                                    : step({ row: rowIndex, col: colIndex }, move === "next" ? 1 : -1)
                              );
                              if (raw !== null) void commit(row, column, raw);
                            }}
                          />
                        ) : column.editor && onCommit ? (
                          <button
                            type="button"
                            title={labels.editHint}
                            onClick={() => setCursor({ row: rowIndex, col: colIndex })}
                            className={cn(
                              // Full-bleed so the whole cell is the target, and
                              // 44px tall so it stays tappable at the door.
                              "flex min-h-11 w-full items-center rounded-[4px] transition-colors hover:bg-gold-wash/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                              EDGE,
                              column.align === "end" ? "justify-end" : "justify-start"
                            )}
                          >
                            <span className="truncate">
                              {column.render?.(row) ?? column.editor.value(row) ?? "—"}
                            </span>
                            {savingCell === cellKey ? (
                              <span className="dk-muted ms-2 text-xs">{labels.saving}</span>
                            ) : null}
                          </button>
                        ) : (
                          <div className={cn("flex min-h-11 items-center", EDGE)}>
                            {column.render?.(row) ?? "—"}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {onDelete ? (
                    <td className={cn(EDGE, "text-end")}>
                      <button
                        type="button"
                        onClick={() => void onDelete(row)}
                        aria-label={labels.delete}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? (
        <p role="alert" className="border-t border-bad/30 bg-bad/5 px-3 py-2 text-sm font-semibold text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Where the cursor goes once this cell is done with. */
type Move = "stay" | "down" | "next" | "prev";

/**
 * One cell's input. Owns its draft text so typing never re-renders the whole
 * grid, and reports exactly once — `settled` guards against the blur that
 * inevitably follows an Enter/Tab commit.
 */
function CellEditor<Row>({
  editor,
  initial,
  align,
  onDone,
}: {
  editor: GridEditor<Row>;
  initial: string;
  align?: "start" | "end";
  onDone: (raw: string | null, move: Move) => void;
}) {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);

  function finish(raw: string | null, move: Move) {
    if (settled.current) return;
    settled.current = true;
    onDone(raw, move);
  }

  const shared = {
    autoFocus: true,
    value,
    onBlur: () => finish(value, "stay"),
    className: cn(
      "dk-field min-h-11 rounded-[4px]",
      align === "end" ? "text-end" : "text-start"
    ),
    // Spreadsheet keys. Tab is intercepted so focus lands on the next *cell*
    // rather than escaping the table entirely.
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null, "stay");
      } else if (event.key === "Enter") {
        event.preventDefault();
        finish(value, "down");
      } else if (event.key === "Tab") {
        event.preventDefault();
        finish(value, event.shiftKey ? "prev" : "next");
      }
    },
  };

  if (editor.kind === "select") {
    return (
      <select
        {...shared}
        onChange={(e) => {
          // A select has no meaningful "typing" state — commit on pick.
          setValue(e.target.value);
          finish(e.target.value, "stay");
        }}
      >
        {editor.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      {...shared}
      type={editor.kind === "number" ? "number" : editor.kind === "tel" ? "tel" : "text"}
      inputMode={editor.kind === "tel" ? "tel" : editor.kind === "number" ? "numeric" : undefined}
      dir={editor.kind === "text" ? undefined : "ltr"}
      min={editor.kind === "number" ? editor.min : undefined}
      step={editor.kind === "number" ? editor.step : undefined}
      style={{ touchAction: "manipulation" }}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
