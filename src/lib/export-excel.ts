/** Zero-dependency Excel (.xls SpreadsheetML) export for accounts ledgers. */

export type ExcelCell = string | number | boolean | null | undefined | Date;

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => ExcelCell;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellXml(value: ExcelCell): string {
  if (value == null || value === "") {
    return `<Cell><Data ss:Type="String"></Data></Cell>`;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return `<Cell><Data ss:Type="String"></Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${escapeXml(value.toISOString())}</Data></Cell>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
}

function sheetNameSafe(name: string): string {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31);
  return cleaned || "Sheet1";
}

export function downloadExcel<T>(input: {
  filename: string;
  sheetName?: string;
  columns: ExcelColumn<T>[];
  rows: T[];
}): void {
  const sheet = sheetNameSafe(input.sheetName || "Ledger");
  const header = `<Row>${input.columns
    .map((c) => cellXml(c.header))
    .join("")}</Row>`;
  const body = input.rows
    .map(
      (row) =>
        `<Row>${input.columns.map((c) => cellXml(c.value(row))).join("")}</Row>`,
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(sheet)}">
  <Table>
${header}
${body}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const base = input.filename.replace(/\.xlsx?$/i, "");
  a.href = url;
  a.download = `${base}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{
    data: T[];
    totalPages?: number;
    total?: number;
  }>,
  opts?: { limit?: number; maxRows?: number },
): Promise<T[]> {
  const limit = opts?.limit ?? 100;
  const maxRows = opts?.maxRows ?? 5000;
  const first = await fetchPage(1, limit);
  const rows = [...(first.data ?? [])];
  const totalPages = Math.max(
    1,
    Number(first.totalPages) ||
      Math.ceil((Number(first.total) || rows.length) / limit) ||
      1,
  );

  for (let page = 2; page <= totalPages && rows.length < maxRows; page += 1) {
    const next = await fetchPage(page, limit);
    rows.push(...(next.data ?? []));
    if (!(next.data ?? []).length) break;
  }
  return rows.slice(0, maxRows);
}

export function excelStamp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
}

export function formatExcelDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return String(iso);
  }
}
