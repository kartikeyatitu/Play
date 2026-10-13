export function paginate<T>(items: T[], page: number, pageSize: number = 20) {
  const totalPages = Math.ceil(items.length / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);
  return {
    items: paginatedItems,
    page,
    pageSize,
    totalPages,
    totalItems: items.length,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
