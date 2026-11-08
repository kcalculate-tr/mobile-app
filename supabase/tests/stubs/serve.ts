// Test saplaması: std/http serve() — handler'ı yakalar, sunucu açmaz.
type Handler = (req: Request) => Response | Promise<Response>;
const g = globalThis as unknown as { __handlers?: Handler[] };
export function serve(handler: Handler): void {
  (g.__handlers ??= []).push(handler);
}
