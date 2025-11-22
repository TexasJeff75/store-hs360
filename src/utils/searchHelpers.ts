export function searchByFields<T>(
  items: T[],
  searchTerm: string,
  fields: (keyof T)[]
): T[] {
  if (!searchTerm) return items;

  const term = searchTerm.toLowerCase();
  return items.filter(item =>
    fields.some(field => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(term);
    })
  );
}

export function filterByField<T>(
  items: T[],
  field: keyof T,
  value: any,
  includeAll: boolean = true
): T[] {
  if (includeAll && (value === 'all' || value === null || value === undefined)) {
    return items;
  }
  return items.filter(item => item[field] === value);
}
