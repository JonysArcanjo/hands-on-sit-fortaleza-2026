export type RegistrationExportRow = {
  workshop: string;
  name: string;
  email: string;
  createdAt: string;
};

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildRegistrationsCsv(rows: RegistrationExportRow[]): string {
  const header = ["Hands-on", "Nome", "E-mail", "Data da inscrição"];
  const body = rows.map((row) => [row.workshop, row.name, row.email, row.createdAt]);
  return `\uFEFF${[header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
