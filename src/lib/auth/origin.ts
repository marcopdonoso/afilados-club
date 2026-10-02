const productionOrigin = "https://afilados-club.vercel.app";
const previewHost =
  /^[a-z0-9]+(?:-[a-z0-9]+)*-marco-perez-donosos-projects\.vercel\.app$/;

export function getTrustedOrigin(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.username || url.password) return null;
    if (url.origin === productionOrigin) return url.origin;
    if (
      url.protocol === "https:" &&
      !url.port &&
      previewHost.test(url.hostname)
    ) {
      return url.origin;
    }
    if (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["3000", "3100"].includes(url.port)
    ) {
      return url.origin;
    }
    return null;
  } catch {
    return null;
  }
}
