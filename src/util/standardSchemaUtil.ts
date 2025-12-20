import {StandardSchemaV1} from "./standardSchema";

export function schemaValidate<Value>(
  schema: StandardSchemaV1<unknown, Value>,
  obj: unknown,
  processValue: (value: Value) => void,
  onValidateFailure?: (failure: StandardSchemaV1.FailureResult) => void
) {
    const checkResult = (result: StandardSchemaV1.Result<Value>) => {
      if (result.issues) {
        onValidateFailure?.(result);
      } else {
        processValue(result.value);
      }
    };
    const maybePromise = schema["~standard"].validate(obj);
    if (maybePromise instanceof Promise) {
      maybePromise.then(checkResult);
    } else {
      checkResult(maybePromise);
    }
}

export function standardSchemaPathToString(
  path?: unknown,
): string {
  if(!Array.isArray(path)) {
    throw new Error(path + " must be an array");
  }
  return path
    .map(segment => {
      const key =
        typeof segment === "object" && segment !== null && "key" in segment
          ? segment.key
          : segment;

      // PropertyKey → string
      if (typeof key === "symbol") {
        return key.description ?? key.toString();
      }

      return String(key);
    })
    .join(".");
}