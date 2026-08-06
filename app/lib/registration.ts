export type RegistrationDecision = "confirmed" | "not-found" | "already-registered" | "unavailable" | "sold-out";

export function decideRegistration(input: {
  participantExists: boolean;
  alreadyRegistered: boolean;
  workshopActive: boolean;
  capacity: number;
  registrations: number;
}): RegistrationDecision {
  if (!input.participantExists) return "not-found";
  if (input.alreadyRegistered) return "already-registered";
  if (!input.workshopActive) return "unavailable";
  if (input.registrations >= input.capacity) return "sold-out";
  return "confirmed";
}
