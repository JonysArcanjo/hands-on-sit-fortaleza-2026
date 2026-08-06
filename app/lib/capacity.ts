export type Availability = "available" | "sold-out";

export function availability(capacity: number, registrations: number): Availability {
  return registrations >= capacity ? "sold-out" : "available";
}

export function validateCapacity(capacity: number, registrations: number): { ok: true } | { ok: false; message: string } {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    return { ok: false, message: "A capacidade deve ser maior que zero." };
  }
  if (capacity < registrations) {
    return { ok: false, message: "A capacidade não pode ser menor que as inscrições atuais." };
  }
  return { ok: true };
}
