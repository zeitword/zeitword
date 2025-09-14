import { PgSelect } from "drizzle-orm/pg-core"

export interface PaginationOptions {
  offset?: number
  limit?: number
}

export function withPagination<T extends PgSelect>(query: T, options: PaginationOptions = {}) {
  const { offset = 0, limit = 50 } = options
  return query.limit(limit).offset(offset)
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

export function withPaginationDecorator<T>(
  data: T[],
  total: number,
  offset: number,
  limit: number
): PaginationResult<T> {
  const hasNext = offset + limit < total
  const hasPrev = offset > 0

  return {
    data,
    pagination: {
      offset,
      limit,
      total,
      hasNext,
      hasPrev
    }
  }
}
