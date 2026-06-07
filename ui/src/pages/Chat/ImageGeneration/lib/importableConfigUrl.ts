export function isImportableConfigUrl(value: string): boolean {
  const url = value.trim();
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has('settings') ||
      parsed.pathname.toLowerCase().endsWith('.json')
    );
  } catch {
    return false;
  }
}
