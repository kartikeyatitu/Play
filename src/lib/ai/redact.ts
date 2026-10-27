/**
 * Removes contact details from free text before it is sent to an AI provider.
 * Coaches type their own points, which can include a parent's number or email by accident.
 */
export function redactContactDetails(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email removed]")
    .replace(/(?:\+?\d[\d\s-]{8,}\d)/g, (m) => (m.replace(/\D/g, "").length >= 10 ? "[number removed]" : m));
}
