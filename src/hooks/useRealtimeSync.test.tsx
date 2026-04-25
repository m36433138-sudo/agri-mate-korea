import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// --- Mock supabase client BEFORE importing the hook ---
const unsubscribe = vi.fn();
const subscribe = vi.fn((cb?: (status: string) => void) => {
  cb?.("SUBSCRIBED");
  return { unsubscribe };
});
const on = vi.fn(() => channelObj);
const channelObj = { on, subscribe, unsubscribe } as any;
const channel = vi.fn(() => channelObj);
const removeChannel = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (...args: unknown[]) => channel(...(args as [])),
    removeChannel: (...args: unknown[]) => removeChannel(...(args as [])),
  },
}));

// sonner toast mock — hook imports it
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), dismiss: vi.fn() },
}));

import { useRealtimeSync } from "./useRealtimeSync";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe("useRealtimeSync — cleanup", () => {
  beforeEach(() => {
    channel.mockClear();
    removeChannel.mockClear();
    on.mockClear();
    subscribe.mockClear();
    unsubscribe.mockClear();
  });

  it("creates a channel, subscribes, and registers a postgres_changes callback on mount", () => {
    const { unmount } = renderHook(
      () => useRealtimeSync("machines", [["machines"]]),
      { wrapper }
    );

    expect(channel).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0]).toBe("postgres_changes");
    expect(subscribe).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("calls channel.unsubscribe and supabase.removeChannel on unmount", () => {
    const { unmount } = renderHook(
      () => useRealtimeSync("machines", [["machines"]]),
      { wrapper }
    );

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(removeChannel).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channelObj);
  });

  it("still calls removeChannel even if unsubscribe throws", () => {
    unsubscribe.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const { unmount } = renderHook(
      () => useRealtimeSync("machines", [["machines"]]),
      { wrapper }
    );

    expect(() => unmount()).not.toThrow();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
