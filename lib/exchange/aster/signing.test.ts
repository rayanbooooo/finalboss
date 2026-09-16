import { describe, expect, it } from "vitest";
import { concat, hashTypedData, keccak256, numberToHex, pad, stringToHex } from "viem";
import {
  buildAgentRequest,
  buildRegisterAgentRequest,
  encodeEntries,
  inferFieldType,
  nextNonce,
  SORT_KEYS_ASCII,
} from "./signing";

const USER = "0x014c85ffb0fF2F2972237AA950B452f92C69Ae1D";
const SIGNER = "0xC98Fd64eBc39E28b92849d9cCef9495663439014";

describe("encodeEntries", () => {
  it("percent-encodes the way urlencode does", () => {
    // Aster's reference signs `urllib.parse.urlencode(...)`, so a space is a
    // plus and anything unsafe is escaped. This file previously asserted the
    // opposite.
    expect(encodeEntries([["a", "1"], ["b", "x y"]])).toBe("a=1&b=x+y");
  });

  it("leaves Python's safe characters alone", () => {
    // quote_plus does not escape these; URLSearchParams escapes `~`, which is
    // why this is hand-rolled.
    expect(encodeEntries([["k", "a_b.c-d~e"]])).toBe("k=a_b.c-d~e");
  });

  it("does not disturb the values this terminal actually sends", () => {
    // Symbols, decimals and 0x addresses encode to themselves, which is why
    // the old raw join passed its tests while being wrong.
    expect(encodeEntries([["symbol", "BTCUSDT"], ["quantity", "0.03"]])).toBe(
      "symbol=BTCUSDT&quantity=0.03"
    );
  });

  it("is empty for no entries", () => {
    expect(encodeEntries([])).toBe("");
  });
});

describe("buildAgentRequest", () => {
  const params = {
    symbol: "BTCUSDT",
    type: "MARKET",
    side: "BUY",
    quantity: "0.03",
  };

  it("appends nonce then signer, the order an order is documented to use", () => {
    const request = buildAgentRequest(params, { signer: SIGNER, nonce: 42 }, "mainnet");

    expect(request.entries.map(([key]) => key)).toEqual([
      "symbol",
      "type",
      "side",
      "quantity",
      "nonce",
      "signer",
    ]);
  });

  it("puts user between nonce and signer when the endpoint needs it", () => {
    const request = buildAgentRequest(
      params,
      { user: USER, signer: SIGNER, nonce: 42 },
      "mainnet"
    );

    expect(request.entries.map(([key]) => key)).toEqual([
      "symbol",
      "type",
      "side",
      "quantity",
      "nonce",
      "user",
      "signer",
    ]);
  });

  it("never sends asterChain", () => {
    // It appears nowhere in Aster's documentation, and it was previously added
    // to every signed string this module produced.
    const withUser = buildAgentRequest(params, { user: USER, signer: SIGNER, nonce: 1 }, "mainnet");
    const without = buildAgentRequest(params, { signer: SIGNER, nonce: 1 }, "testnet");

    expect(withUser.payloadString).not.toContain("asterChain");
    expect(without.payloadString).not.toContain("asterChain");
  });

  it("signs exactly the string it transmits", () => {
    const request = buildAgentRequest(params, { user: USER, signer: SIGNER, nonce: 42 }, "mainnet");

    // The invariant the whole module exists to protect.
    expect(request.typedData.message.msg).toBe(request.payloadString);
    expect(request.payloadString).toBe(encodeEntries(request.entries));
  });

  it("uses the Message type and the network's chain id", () => {
    const mainnet = buildAgentRequest(params, { user: USER, signer: SIGNER, nonce: 1 }, "mainnet");
    const testnet = buildAgentRequest(params, { user: USER, signer: SIGNER, nonce: 1 }, "testnet");

    expect(mainnet.typedData.primaryType).toBe("Message");
    expect(mainnet.typedData.domain.chainId).toBe(1666);
    expect(testnet.typedData.domain.chainId).toBe(714);
    // The network shows up in the chainId alone. There is no parameter
    // carrying it - the entries are identical across networks.
    expect(mainnet.entries).toEqual(testnet.entries);
  });

  it("drops null and undefined parameters", () => {
    const request = buildAgentRequest(
      { symbol: "BTCUSDT", reduceOnly: undefined, positionSide: null },
      { user: USER, signer: SIGNER, nonce: 1 },
      "mainnet"
    );

    expect(request.payloadString).not.toContain("reduceOnly");
    expect(request.payloadString).not.toContain("positionSide");
  });

  it("serialises booleans and numbers the way Aster expects", () => {
    const request = buildAgentRequest(
      { reduceOnly: true, feeRate: 0.00001 },
      { user: USER, signer: SIGNER, nonce: 1 },
      "mainnet"
    );

    expect(request.entries).toContainEqual(["reduceOnly", "true"]);
    // Not "1e-5" - an exponential form is rejected upstream.
    expect(request.entries).toContainEqual(["feeRate", "0.00001"]);
  });
});

describe("inferFieldType", () => {
  it("checks booleans before integers", () => {
    // Load-bearing: Aster's reference is Python, where bool subclasses int, so
    // the check order is part of the spec. Typed as uint256, `false` hashes
    // differently and the approval is rejected as unauthorised.
    expect(inferFieldType(false)).toBe("bool");
    expect(inferFieldType(true)).toBe("bool");
  });

  it("types integers as uint256 and everything else as string", () => {
    expect(inferFieldType(1967945395040)).toBe("uint256");
    expect(inferFieldType(0)).toBe("uint256");
    expect(inferFieldType(0.00001)).toBe("string");
    expect(inferFieldType("0.00001")).toBe("string");
  });
});

describe("buildRegisterAgentRequest", () => {
  const base = {
    user: USER,
    nonce: 1_700_000_000_000_000,
    agentName: "finalboss",
    agentAddress: SIGNER,
    expired: 1_800_000_000_000,
    canSpotTrade: false,
    canPerpTrade: true,
    canWithdraw: false,
    ipWhitelist: "",
  };

  it("uses the documented field order", () => {
    // Fixed by Aster's message template, not the caller's to vary: a different
    // order is a different signed string and an invalid signature.
    expect(buildRegisterAgentRequest(base).entries.map(([key]) => key)).toEqual([
      "user",
      "nonce",
      "agentName",
      "agentAddress",
      "expired",
      "signatureChainId",
      "canSpotTrade",
      "canPerpTrade",
      "canWithdraw",
      "ipWhitelist",
    ]);
  });

  it("uses the same flat Message type as an agent request", () => {
    // The replaced builder derived a per-field type with capitalised names.
    // Aster documents one type for everything it signs.
    const request = buildRegisterAgentRequest(base);

    expect(request.typedData.primaryType).toBe("Message");
    expect(request.typedData.types.Message).toEqual([{ name: "msg", type: "string" }]);
    expect(request.typedData.message.msg).toBe(request.payloadString);
  });

  it("signs under chain 56, not the network's 1666", () => {
    const request = buildRegisterAgentRequest(base);

    expect(request.signatureChainId).toBe(56);
    expect(request.typedData.domain.chainId).toBe(56);
  });

  it("serialises booleans as Aster expects", () => {
    expect(buildRegisterAgentRequest(base).payloadString).toContain("canPerpTrade=true");
    expect(buildRegisterAgentRequest(base).payloadString).toContain("canWithdraw=false");
  });

  it("keeps an empty ipWhitelist in the payload", () => {
    // Empty is only legal because canWithdraw is false, but the field is still
    // part of the documented message - dropping it changes what is signed.
    expect(buildRegisterAgentRequest(base).entries.map(([key]) => key)).toContain("ipWhitelist");
  });
});

describe("EIP-712 digest", () => {
  it("hashes identically to Aster's own reference construction", () => {
    // The check that matters most in this file, and the one unit tests of
    // shape cannot make: a correctly-shaped typed-data object that hashes
    // differently produces a signature recovering to the wrong address, and
    // every order is rejected as unauthorised with nothing naming the cause.
    //
    // The right-hand side below is Aster's construction rebuilt by hand -
    // domain separator, Message(string msg) type hash, 0x1901 prefix - exactly
    // as their reference client does it. If viem's interpretation of our typed
    // data ever diverges from it, this fails here rather than in production.
    const request = buildAgentRequest(
      { symbol: "BTCUSDT", type: "MARKET", side: "BUY", quantity: "0.03" },
      { user: USER, signer: SIGNER, nonce: 1_700_000_000_000_000 },
      "mainnet"
    );

    const { EIP712Domain: _domain, ...types } = request.typedData.types;
    const viemDigest = hashTypedData({
      domain: request.typedData.domain,
      types,
      primaryType: request.typedData.primaryType,
      message: request.typedData.message,
    });

    const domainTypeHash = keccak256(
      stringToHex(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      )
    );
    const domainSeparator = keccak256(
      concat([
        domainTypeHash,
        keccak256(stringToHex("AsterSignTransaction")),
        keccak256(stringToHex("1")),
        pad(numberToHex(1666), { size: 32 }),
        pad("0x", { size: 32 }),
      ])
    );
    const messageHash = keccak256(
      concat([
        keccak256(stringToHex("Message(string msg)")),
        keccak256(stringToHex(request.payloadString)),
      ])
    );
    const referenceDigest = keccak256(concat(["0x1901", domainSeparator, messageHash]));

    expect(viemDigest).toBe(referenceDigest);
  });
});

describe("nextNonce", () => {
  it("increments within the same millisecond", () => {
    const first = nextNonce(1_700_000_000_000);
    const second = nextNonce(1_700_000_000_000);
    expect(second).toBe(first + 1);
  });

  it("stays a safe integer", () => {
    expect(Number.isSafeInteger(nextNonce(Date.now()))).toBe(true);
  });

  it("is microsecond-scale", () => {
    const now = 1_700_000_000_000;
    expect(nextNonce(now)).toBeGreaterThanOrEqual(now * 1000);
  });
});

describe("SORT_KEYS_ASCII", () => {
  it("is false, matching Aster's runnable example rather than its prose", () => {
    // Recorded as a test so that flipping it is a deliberate act with a visible
    // consequence, not a silent change to every signature the app produces.
    expect(SORT_KEYS_ASCII).toBe(false);
  });

  it("produces the example's own unsorted order while false", () => {
    // symbol, type, side is what Aster's place_order dict contains, and it is
    // not ASCII order - s, t, s.
    const request = buildAgentRequest(
      { symbol: "BTCUSDT", type: "MARKET", side: "BUY" },
      { signer: SIGNER, nonce: 1 },
      "mainnet"
    );

    expect(request.entries.map(([key]) => key)).toEqual([
      "symbol",
      "type",
      "side",
      "nonce",
      "signer",
    ]);
  });
});
