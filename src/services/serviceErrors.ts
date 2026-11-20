/**
 * Avencis Workforce Management (WFM)
 * Standardized Service Error Model
 *
 * Provides typed, actionable error categories for authentication,
 * RLS authorization, validation, network, and database failures.
 */

export type ServiceErrorCode =
  | 'AUTH_ERROR'         // Authentication failure, session expired, or bad credentials
  | 'PERMISSION_ERROR'   // RLS denial, role restriction, or cross-tenant access attempt
  | 'VALIDATION_ERROR'   // Invalid input parameters, constraints, or date ranges
  | 'NOT_FOUND'          // Requested entity or record does not exist
  | 'NETWORK_ERROR'      // Connectivity failure or unreachable endpoint
  | 'DATABASE_ERROR'     // PostgreSQL constraint, trigger rejection, or query error
  | 'UNEXPECTED_ERROR';  // Unhandled runtime exceptions

export class ServiceError extends Error {
  public readonly code: ServiceErrorCode;
  public readonly details?: unknown;
  public readonly status?: number;
  public readonly field?: string;
  public readonly timestamp: string;

  constructor(params: {
    code: ServiceErrorCode;
    message: string;
    details?: unknown;
    status?: number;
    field?: string;
  }) {
    super(params.message);
    this.name = 'ServiceError';
    this.code = params.code;
    this.details = params.details;
    this.status = params.status;
    this.field = params.field;
    this.timestamp = new Date().toISOString();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ServiceError.prototype);
  }

  /**
   * Returns a clean JSON representation of the service error.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      field: this.field,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Parses and categorizes raw errors returned by Supabase PostgREST, GoTrue, or network clients.
 */
export function handleSupabaseError(error: unknown, context?: string): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  const errObj = error as Record<string, unknown> | null;
  const rawMessage = (errObj?.message as string) || (errObj?.error_description as string) || 'An unknown database error occurred.';
  const code = (errObj?.code as string) || '';
  const status = typeof errObj?.status === 'number' ? errObj.status : undefined;
  const contextPrefix = context ? `[${context}] ` : '';

  // 401 / Authentication failure / Session expiry
  if (
    status === 401 ||
    code === 'PGRST301' ||
    rawMessage.toLowerCase().includes('jwt expired') ||
    rawMessage.toLowerCase().includes('token is expired') ||
    rawMessage.toLowerCase().includes('invalid login credentials') ||
    rawMessage.toLowerCase().includes('invalid token')
  ) {
    return new ServiceError({
      code: 'AUTH_ERROR',
      message: `${contextPrefix}Authentication session expired or invalid credentials. Please sign in again.`,
      status: 401,
      details: error,
    });
  }

  // PostgreSQL / PostgREST Error Code Mapping:
  // 42501: insufficient_privilege (Row Level Security rejection)
  if (code === '42501' || rawMessage.toLowerCase().includes('permission denied') || rawMessage.toLowerCase().includes('row-level security')) {
    return new ServiceError({
      code: 'PERMISSION_ERROR',
      message: `${contextPrefix}Access denied: You do not have permission to view or modify this record.`,
      status: 403,
      details: error,
    });
  }

  // PGRST116: The result contains 0 rows (when single() is requested)
  if (code === 'PGRST116' || rawMessage.toLowerCase().includes('contains 0 rows')) {
    return new ServiceError({
      code: 'NOT_FOUND',
      message: `${contextPrefix}Requested record was not found.`,
      status: 404,
      details: error,
    });
  }

  // 23505: unique_violation
  if (code === '23505') {
    return new ServiceError({
      code: 'VALIDATION_ERROR',
      message: `${contextPrefix}A record with this identifier already exists (unique constraint violation).`,
      status: 409,
      details: error,
    });
  }

  // 23503: foreign_key_violation
  if (code === '23503') {
    return new ServiceError({
      code: 'VALIDATION_ERROR',
      message: `${contextPrefix}Referenced entity does not exist (foreign key constraint violation).`,
      status: 400,
      details: error,
    });
  }

  // 22003: numeric_value_out_of_range (numeric field overflow)
  if (code === '22003') {
    return new ServiceError({
      code: 'VALIDATION_ERROR',
      message: `${contextPrefix}Numeric value exceeds column precision or scale limits.`,
      status: 400,
      details: error,
    });
  }

  // P0001: raise_exception (Custom database trigger exception, e.g. locked payroll or immutable events)
  if (code === 'P0001') {
    return new ServiceError({
      code: 'DATABASE_ERROR',
      message: `${contextPrefix}Database business rule violation: ${rawMessage}`,
      status: 400,
      details: error,
    });
  }

  // Network / Fetch failures
  if (rawMessage.toLowerCase().includes('failed to fetch') || rawMessage.toLowerCase().includes('networkerror')) {
    return new ServiceError({
      code: 'NETWORK_ERROR',
      message: `${contextPrefix}Network connection error. Please verify your internet connection or backend availability.`,
      status: 503,
      details: error,
    });
  }

  // Fallback to general Database Error
  return new ServiceError({
    code: 'DATABASE_ERROR',
    message: `${contextPrefix}${rawMessage}`,
    status: status || 500,
    details: error,
  });
}

// Convenience Factory Helpers
export function createValidationError(message: string, field?: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'VALIDATION_ERROR', message, field, status: 400, details });
}

export function createNotFoundError(resource: string, id: string): ServiceError {
  return new ServiceError({ code: 'NOT_FOUND', message: `${resource} with ID '${id}' was not found.`, status: 404 });
}

export function createPermissionError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'PERMISSION_ERROR', message, status: 403, details });
}

export function createAuthError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'AUTH_ERROR', message, status: 401, details });
}

export function createNetworkError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'NETWORK_ERROR', message, status: 503, details });
}

export function formatErrorMessage(err: ServiceError): string {
  switch (err.code) {
    case 'PERMISSION_ERROR':
      return `Permission Denied: ${err.message}`;
    case 'NOT_FOUND':
      return `Not Found: ${err.message}`;
    case 'VALIDATION_ERROR':
      return `Validation Error: ${err.message}${err.field ? ` (${err.field})` : ''}`;
    case 'AUTH_ERROR':
      return `Authentication Required: ${err.message}`;
    case 'NETWORK_ERROR':
      return `Network Error: ${err.message}`;
    case 'DATABASE_ERROR':
      return `Database Error: ${err.message}`;
    default:
      return err.message;
  }
}
