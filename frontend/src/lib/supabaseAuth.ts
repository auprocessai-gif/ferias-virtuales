import { supabase } from "@/lib/supabase";

export const AUTH_CHECK_TIMEOUT_MS = 8000;

export function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function withTimeout<T>(
  promise: PromiseLike<T>,
  message: string,
  timeoutMs = AUTH_CHECK_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export async function getSessionWithTimeout(label = "Session check") {
  return withTimeout(
    supabase.auth.getSession(),
    `${label} timed out`,
    AUTH_CHECK_TIMEOUT_MS
  );
}

export async function getSessionWithRetry(attempts = 2) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await getSessionWithTimeout();
      if (result.data.session?.user || attempt === attempts - 1) return result;
    } catch (error) {
      lastError = error;
      console.warn(`[auth] session attempt ${attempt + 1} failed`, error);
    }

    await wait(500);
  }

  if (lastError) throw lastError;
  return { data: { session: null } };
}
