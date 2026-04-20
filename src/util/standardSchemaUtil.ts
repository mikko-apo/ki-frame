import { StandardSchemaV1 } from './standardSchema'

export function schemaValidate<Value>(
  schema: StandardSchemaV1<unknown, Value>,
  obj: unknown,
  processValue: (value: Value) => void,
  onValidateFailure?: (failure: StandardSchemaV1.FailureResult) => void
) {
  const checkResult = (result: StandardSchemaV1.Result<Value>) => {
    if (result.issues) {
      onValidateFailure?.(result)
    } else {
      processValue(result.value)
    }
  }
  const maybePromise = schema['~standard'].validate(obj)
  if (maybePromise instanceof Promise) {
    maybePromise.then(checkResult)
  } else {
    checkResult(maybePromise)
  }
}
