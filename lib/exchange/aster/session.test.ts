import { beforeEach, describe, expect, it } from "vitest";

import {
  EXPIRY_MARGIN_MS,
  belongsTo,
  clearAgent,
  isUsable,
  loadAgent,
  saveAgent,
  type StoredAgent,
} from "@/lib/exchange/aster/session";
import { PER_USER_STORAGE_KEYS, STORAGE_KEYS } from "@/lib/storageKeys";

const NOW = 1_700_000_000_000;

const agent: StoredAgent = {
  user: "0x014c85ffb0fF2F2972237AA950B452f92C69Ae1D",
  address: "0xC98Fd64eBc39E28b92849d9cCef9495663439014",
  expiresAt: NOW + 90 * 86_400_000,
  network: "mainnet",
  key: { ciphertext: "abc", salt: "def", iv: "ghi", iterations: 600_000 },
};

/** A minimal localStorage, since these tests run under Node. */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return store;
}

describe("isUsable", () => {
  it("accepts an approval with time left", () => {
    expect(isUsable(agent, NOW)).toBe(true);
  });

  it("rejects one that has already lapsed", () => {
    expect(isUsable({ ...agent, expiresAt: NOW - 1 }, NOW)).toBe(false);
  });

  it("rejects one about to lapse, because checking and trading are not simultaneous", () => {
    // Thirty seconds of validity passes a naive check and is gone by the time
    // the order lands.
    expect(isUsable({ ...agent, expiresAt: NOW + 30_000 }, NOW)).toBe(false);
    expect(isUsable({ ...agent, expiresAt: NOW + EXPIRY_MARGIN_MS + 1 }, NOW)).toBe(true);
  });

  it("treats a missing approval as unusable", () => {
    expect(isUsable(null, NOW)).toBe(false);
  });
});

describe("belongsTo", () => {
  it("matches regardless of address casing", () => {
    // A wallet may report a checksummed address where the stored one is
    // lower-cased; treating those as different accounts would discard a valid
    // approval and ask for a pointless re-signature.
    expect(belongsTo(agent, agent.user.toLowerCase())).toBe(true);
    expect(belongsTo(agent, agent.user.toUpperCase())).toBe(true);
  });

  it("rejects a different wallet", () => {
    expect(belongsTo(agent, "0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("rejects when either side is missing", () => {
    expect(belongsTo(null, agent.user)).toBe(false);
    expect(belongsTo(agent, null)).toBe(false);
  });
});

describe("saveAgent and loadAgent", () => {
  beforeEach(() => {
    installStorage();
  });

  it("round-trips an agent", () => {
    saveAgent(agent, "user-1");
    expect(loadAgent("user-1")).toEqual(agent);
  });

  it("scopes storage per account", () => {
    // Two accounts on one browser must not read each other's approvals.
    saveAgent(agent, "user-1");
    expect(loadAgent("user-2")).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(loadAgent("user-1")).toBeNull();
  });

  it("treats an unparseable record as absent", () => {
    const store = installStorage();
    store.set(`${STORAGE_KEYS.asterAgent}:user-1`, "{ not json");
    expect(loadAgent("user-1")).toBeNull();
  });

  it("treats a half-written record as absent rather than repairing it", () => {
    // A partial record surfaces at the venue as a signature failure, which is
    // far harder to diagnose than being asked to approve again.
    const store = installStorage();
    store.set(
      `${STORAGE_KEYS.asterAgent}:user-1`,
      JSON.stringify({ user: agent.user, address: agent.address })
    );
    expect(loadAgent("user-1")).toBeNull();
  });

  it("rejects a record with an unknown network", () => {
    const store = installStorage();
    store.set(
      `${STORAGE_KEYS.asterAgent}:user-1`,
      JSON.stringify({ ...agent, network: "devnet" })
    );
    expect(loadAgent("user-1")).toBeNull();
  });

  it("clears", () => {
    saveAgent(agent, "user-1");
    clearAgent("user-1");
    expect(loadAgent("user-1")).toBeNull();
  });
});

describe("sign-out", () => {
  it("counts the agent among the keys that must not outlive a session", () => {
    // An approval authorises trading on one person's exchange account. Leaving
    // it for the next person on a shared browser is the worst kind of leftover.
    expect(PER_USER_STORAGE_KEYS).toContain(STORAGE_KEYS.asterAgent);
  });
});
