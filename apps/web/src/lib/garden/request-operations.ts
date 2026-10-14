type StoredRequest = { path: string; method: string; body: unknown };
const storageKey = 'apple-http-operations-v3';
let memory: Record<string, StoredRequest> = {};
try {
  memory = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
} catch {
  /* 内存仍可重试。 */
}
function persist() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(memory));
  } catch {
    /* 当前页面保留原请求。 */
  }
}
/** Keep the exact wire body, including omitted dates, across unknown-outcome retries. */
export function retainRequest(key: string, request: StoredRequest): StoredRequest {
  if (!memory[key]) {
    memory[key] = request;
    persist();
  }
  return memory[key]!;
}
export function finishOperation(operationId: string) {
  for (const key of Object.keys(memory))
    if (key === operationId || key.startsWith(`${operationId}:`)) delete memory[key];
  persist();
}
