import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { setSession } from "./session";

afterEach(() => setSession(null));

describe("AuthProvider", () => {
  it("clears user query data when a session expires outside the UI", async () => {
    const client = new QueryClient();
    client.setQueryData(["me"], { name: "上一账号" });
    setSession({ access_token: "active", refresh_token: "refresh" });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <div>content</div>
        </AuthProvider>
      </QueryClientProvider>,
    );

    setSession(null);
    await waitFor(() => expect(client.getQueryData(["me"])).toBeUndefined());
  });
});
