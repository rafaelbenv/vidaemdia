const STORAGE_PREFIX = 'vidaemdia_primeiros_passos_';

export function ativarPrimeirosPassos(userId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, 'ativo');
  } catch {
    // localStorage pode falhar
  }
}

export function dispensarPrimeirosPassos(userId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, 'dispensado');
  } catch {
    // localStorage pode falhar
  }
}

export function primeirosPassosAtivo(userId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) === 'ativo';
  } catch {
    return false;
  }
}
