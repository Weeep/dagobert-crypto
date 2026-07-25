export type ReadApiSuccess<T> = { data: T };

export type ReadApiErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export type ReadApiError = {
  error: {
    code: ReadApiErrorCode;
    message: string;
  };
};

export type ReadApiResponse<T> = ReadApiSuccess<T> | ReadApiError;
