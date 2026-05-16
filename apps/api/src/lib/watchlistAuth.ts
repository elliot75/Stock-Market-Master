export function getWatchlistItemOwnershipWhere(params: {
  itemId: string;
  watchlistId: string;
  userId: string;
}) {
  return {
    id: params.itemId,
    watchlistId: params.watchlistId,
    watchlist: { userId: params.userId },
  };
}
