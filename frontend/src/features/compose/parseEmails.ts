const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SINGLE_EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export const isValidEmail = (value: string) => SINGLE_EMAIL_RE.test(value.trim());

/**
 * Pulls every email address out of free-form text: a CSV with any column layout,
 * one-per-line .txt, or a pasted list. Lower-cased and de-duplicated, in first-seen order.
 */
export function extractEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(EMAIL_RE)) seen.add(match[0].toLowerCase());
  return [...seen];
}

export function mergeRecipients(current: string[], incoming: string[]): { merged: string[]; added: number } {
  const set = new Set(current);
  let added = 0;
  for (const email of incoming) {
    if (!set.has(email)) {
      set.add(email);
      added++;
    }
  }
  return { merged: [...set], added };
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}
