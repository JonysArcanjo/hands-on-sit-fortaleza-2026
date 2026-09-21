export function participantNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").normalize("NFKC").toLocaleLowerCase("pt-BR");
}
