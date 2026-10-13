"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface PaginatedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchKeys?: string[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export function PaginatedTable<T extends Record<string, any>>({
  data, columns, pageSize = 15, searchKeys = [], searchPlaceholder = "Search...", emptyMessage = "No data found", actions
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Search filter
  let filtered = data;
  if (search && searchKeys.length > 0) {
    const q = search.toLowerCase();
    filtered = data.filter(item =>
      searchKeys.some(key => {
        const val = key.split(".").reduce((o: any, k) => o?.[k], item);
        return String(val || "").toLowerCase().includes(q);
      })
    );
  }

  // Sort
  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      const aVal = sortKey.split(".").reduce((o: any, k) => o?.[k], a);
      const bVal = sortKey.split(".").reduce((o: any, k) => o?.[k], b);
      const cmp = String(aVal || "").localeCompare(String(bVal || ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  // Paginate
  const totalPages = Math.ceil(filtered.length / pageSize);
  const start = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  return (
    <div className="space-y-3">
      {searchKeys.length > 0 && (
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500"
        />
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">{emptyMessage}</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                {columns.map(col => (
                  <TableHead
                    key={col.key}
                    className={`text-zinc-400 ${col.sortable ? "cursor-pointer hover:text-zinc-200" : ""}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                  </TableHead>
                ))}
                {actions && <TableHead className="text-zinc-400">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((item, i) => (
                <TableRow key={(item as any).id || i} className="border-zinc-800/50">
                  {columns.map(col => (
                    <TableCell key={col.key} className="text-zinc-300">
                      {col.render ? col.render(item) : String(col.key.split(".").reduce((o: any, k) => o?.[k], item) ?? "")}
                    </TableCell>
                  ))}
                  {actions && <TableCell>{actions(item)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500">
                Showing {start + 1}-{Math.min(start + pageSize, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="border-zinc-700 text-zinc-400 h-8 px-3">
                  ← Prev
                </Button>
                <span className="text-xs text-zinc-500 flex items-center px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="border-zinc-700 text-zinc-400 h-8 px-3">
                  Next →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
