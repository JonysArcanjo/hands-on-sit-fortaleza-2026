const FORTALEZA_OFFSET = "-03:00";

export function isRegistrationOpen(deadline: string | null | undefined, now = new Date()): boolean {
  if (!deadline) return true;
  const closesAt = new Date(`${deadline}T23:59:59.999${FORTALEZA_OFFSET}`);
  return Number.isNaN(closesAt.getTime()) || now.getTime() <= closesAt.getTime();
}
