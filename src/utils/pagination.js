// List queries fetch one row more than requested (`take: limit + 1`). If that
// extra row exists there is another page; it is dropped from the response and
// the last returned row becomes the cursor for the next request.
export function paginate(rows, limit) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, pagination: { nextCursor, hasMore } };
}

// Prisma options that continue a query after the row with the given id.
export const cursorOptions = (cursor) => (cursor ? { skip: 1, cursor: { id: cursor } } : {});

// Newest first, with id as a tiebreaker. Two rows can share a createdAt
// (bulk inserts, same millisecond); ordering by createdAt alone would let such
// rows swap places between requests and be skipped or repeated across pages.
export const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }];
