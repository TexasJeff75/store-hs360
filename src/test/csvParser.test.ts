import { describe, it, expect } from 'vitest';

// Re-implement the pure functions from ContractPricingImport for testing.
// These are extracted verbatim from the component to verify correctness.

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function normalizeHeader(h: string): string {
  const map: Record<string, string> = {
    type: 'pricing_type',
    pricing_type: 'pricing_type',
    entity: 'entity',
    entity_name: 'entity',
    entity_identifier: 'entity',
    organization: 'entity',
    location: 'entity',
    user: 'entity',
    email: 'entity',
    product_id: 'product_id',
    product: 'product_id',
    contract_price: 'contract_price',
    price: 'contract_price',
    markup_price: 'markup_price',
    markup: 'markup_price',
    min_qty: 'min_quantity',
    min_quantity: 'min_quantity',
    max_qty: 'max_quantity',
    max_quantity: 'max_quantity',
    effective_date: 'effective_date',
    start_date: 'effective_date',
    expiry_date: 'expiry_date',
    end_date: 'expiry_date',
  };
  return map[h] || h;
}

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const csv = 'Name,Price\nWidget,10.99\nGadget,20.50';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['name', 'price']);
    expect(result.rows).toEqual([
      ['Widget', '10.99'],
      ['Gadget', '20.50'],
    ]);
  });

  it('handles quoted fields with commas', () => {
    const csv = 'Name,Description\n"Widget, Deluxe",High quality';
    const result = parseCSV(csv);
    expect(result.rows[0]).toEqual(['Widget, Deluxe', 'High quality']);
  });

  it('handles escaped quotes in quoted fields', () => {
    const csv = 'Name,Note\n"He said ""hello""",Fine';
    const result = parseCSV(csv);
    expect(result.rows[0][0]).toBe('He said "hello"');
  });

  it('handles empty input', () => {
    const result = parseCSV('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('handles Windows-style line endings (CRLF)', () => {
    const csv = 'A,B\r\n1,2\r\n3,4';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toHaveLength(2);
  });

  it('normalizes headers to lowercase with underscores', () => {
    const csv = 'Product ID,Contract Price\n1,9.99';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['product_id', 'contract_price']);
  });

  it('skips blank lines', () => {
    const csv = 'A,B\n\n1,2\n\n3,4\n';
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
  });
});

describe('normalizeHeader', () => {
  it('maps common aliases to canonical names', () => {
    expect(normalizeHeader('type')).toBe('pricing_type');
    expect(normalizeHeader('price')).toBe('contract_price');
    expect(normalizeHeader('markup')).toBe('markup_price');
    expect(normalizeHeader('min_qty')).toBe('min_quantity');
    expect(normalizeHeader('max_qty')).toBe('max_quantity');
    expect(normalizeHeader('start_date')).toBe('effective_date');
    expect(normalizeHeader('end_date')).toBe('expiry_date');
  });

  it('maps entity-related headers', () => {
    expect(normalizeHeader('entity_name')).toBe('entity');
    expect(normalizeHeader('organization')).toBe('entity');
    expect(normalizeHeader('location')).toBe('entity');
    expect(normalizeHeader('email')).toBe('entity');
  });

  it('passes through unknown headers unchanged', () => {
    expect(normalizeHeader('custom_field')).toBe('custom_field');
    expect(normalizeHeader('notes')).toBe('notes');
  });
});
