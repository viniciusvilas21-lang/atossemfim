/** Strips everything but digits. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function checkDigit(digits: string, weightStart: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number.parseInt(digits[i], 10) * (weightStart - i);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

/** Validates a Brazilian CPF using its real check-digit algorithm (not just format). */
export function isValidCPF(rawValue: string): boolean {
  const cpf = onlyDigits(rawValue);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // all same digit, e.g. 111.111.111-11

  const firstCheck = checkDigit(cpf.slice(0, 9), 10);
  if (firstCheck !== Number.parseInt(cpf[9], 10)) return false;

  const secondCheck = checkDigit(cpf.slice(0, 10), 11);
  if (secondCheck !== Number.parseInt(cpf[10], 10)) return false;

  return true;
}

export function formatCPF(rawValue: string): string {
  const cpf = onlyDigits(rawValue).slice(0, 11);
  return cpf
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
