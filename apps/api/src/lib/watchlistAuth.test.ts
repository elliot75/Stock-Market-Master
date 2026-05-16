import { describe, expect, it } from "vitest";
import { getWatchlistItemOwnershipWhere } from "./watchlistAuth.js";

describe("getWatchlistItemOwnershipWhere", () => {
  it("requires item, watchlist, and user ownership together", () => {
    expect(
      getWatchlistItemOwnershipWhere({
        itemId: "item_a",
        watchlistId: "list_a",
        userId: "user_a",
      })
    ).toEqual({
      id: "item_a",
      watchlistId: "list_a",
      watchlist: { userId: "user_a" },
    });
  });
});
