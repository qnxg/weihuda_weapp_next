export interface TfaChallenge {
  phone: string;
  returnTo: string;
}

const listeners = new Set<() => void>();
let challenge: TfaChallenge | null = null;

export function getTfaChallenge() {
  return challenge;
}

export function setTfaChallenge(next: TfaChallenge | null) {
  challenge = next;
  listeners.forEach((listener) => listener());
}

export function subscribeTfaChallenge(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
