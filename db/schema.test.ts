import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { registrations } from "./schema";

describe("registration schema metadata", () => {
  it("allows one participant to register for different workshops", () => {
    const uniqueIndexes = getTableConfig(registrations).indexes.filter((index) => index.config.unique);

    expect(uniqueIndexes).toHaveLength(1);
    expect(uniqueIndexes[0].config.columns.map((column) => "name" in column ? column.name : null))
      .toEqual(["workshop_id", "participant_id"]);
  });
});
