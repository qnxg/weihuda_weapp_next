// @vitest-environment node
import { describe, expect, it } from "vitest";
import { endpointCatalog } from "./endpoints";
// The mock server intentionally remains a dependency-free JavaScript package.
// @ts-expect-error no declaration file is needed for its route metadata.
import { publicRouteKeys, routes } from "../../mock-server/src/server.js";

describe("endpoint catalog", () => {
  it("contains all 58 unique Apifox operations", () => {
    const keys = endpointCatalog.map(({ method, path }) => `${method} ${path}`);
    expect(keys).toHaveLength(58);
    expect(new Set(keys).size).toBe(58);
  });

  it("matches every mock server route", () => {
    const clientKeys = endpointCatalog.map(({ method, path }) => `${method} ${path}`).toSorted();
    const mockKeys = routes
      .map(({ method, path }: { method: string; path: string }) => `${method} ${path}`)
      .toSorted();
    expect(clientKeys).toEqual(mockKeys);
  });

  it("declares a consumer and auth mode for every operation", () => {
    endpointCatalog.forEach((endpoint) => {
      expect(endpoint.consumer).not.toBe("");
      expect(["public", "required"]).toContain(endpoint.auth);
    });

    const clientPublicKeys = endpointCatalog
      .filter(({ auth }) => auth === "public")
      .map(({ method, path }) => `${method} ${path}`)
      .toSorted();
    expect(clientPublicKeys).toEqual([...publicRouteKeys].toSorted());
  });
});
