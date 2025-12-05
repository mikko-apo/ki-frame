export type FetchOptions = RequestInit & {
  timeoutMs?: number;
  assertOk?: boolean | (<T>(response: Response) => T | Promise<T>);
};
export type ErrorResponse = { errorResponse: Response };

export function isErrorResponse<T>(item: any): item is ErrorResponse {
  return "errorResponse" in item;
}
