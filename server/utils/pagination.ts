import { SQL, asc, eq, count } from "drizzle-orm"
import { PgColumn, PgSelectBase } from "drizzle-orm/pg-core"

export interface PaginationOptions {
  offset?: number
  limit?: number
  orderByColumn?: PgColumn | SQL | SQL.Aliased
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    offset: number
    limit: number
    total: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Simple pagination utility that adds limit and offset to a query
 * @param qb - The query builder
 * @param options - Pagination options
 * @returns Paginated query builder
 */
export function withPagination<T extends any>(qb: T, options: PaginationOptions = {}) {
  const { offset = 0, limit = 50, orderByColumn } = options

  if (orderByColumn) {
    qb = (qb as any).orderBy(orderByColumn)
  }

  return (qb as any).limit(limit).offset(offset)
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMeta(offset: number, limit: number, total: number) {
  const hasNext = offset + limit < total
  const hasPrev = offset > 0

  return {
    offset,
    limit,
    total,
    hasNext,
    hasPrev
  }
}

/**
 * Simple decorator that takes an array and adds pagination metadata
 * @param data - Array of data
 * @param total - Total count of items
 * @param offset - Current offset
 * @param limit - Current limit
 * @returns Object with data and pagination metadata
 */
export function withPaginationDecorator<T>(
  data: T[],
  total: number,
  offset: number,
  limit: number
): PaginationResult<T> {
  const pagination = calculatePaginationMeta(offset, limit, total)

  return {
    data,
    pagination
  }
}
