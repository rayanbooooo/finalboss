import { describe, expect, it } from "vitest";
import { concat, hashTypedData, keccak256, numberToHex, pad, stringToHex } from "viem";
import {
  buildAgentRequest,
  buildMainWalletRequest,
  encodeEntries,
  inferFieldType,
  nextNonce,
} from "./signing";

const USER = "0x014c85ffb0fF2F2972237AA950B452f92C69Ae1D";
const SIGNER = "0xC98Fd64eBc39E28b92849d9cCef9495663439014";

describe("encodeEntries", () => {
  it("joins raw, without percent-encoding", () => {
    // Aster signs the raw joined string. If this ever starts encoding, every
    // signature silently stops verifying - hence an explicit test for a value
    // URLSearchParams would mangle.
    expect(encodeEntries([["a", "1"], ["b", "x y"]])).toBe("a=1&b=x y");
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

  it("appends asterChain, user, signer and nonce in Aster's order", () => {
    const request = buildAgentRequest(params, { user: USER, signer: SIGNER, nonce: 42 }, "mainnet");

    expect(request.entries.map(([key]) => key)).toEqual([
      "symbol",
      "type",
      "side",
      "quantity",
      "asterChain",
      "user",
      "signer",
      "nonce",
    ]);
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
    expect(mainnet.entries).toContainEqual(["asterChain", "Mainnet"]);
    expect(testnet.entries).toContainEqual(["asterChain", "Testnet"]);
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

describe("buildMainWalletRequest", () => {
  // Taken from Aster's own reference demo (demo/aster-code.py).
  const approveBuilder = {
    builder: USER,
    maxFeeRate: "0.00001",
    builderName: "finalboss",
  };

  it("capitalises field names in the typed message, not on the wire", () => {
    const request = buildMainWalletRequest(
      approveBuilder,
      { user: USER, nonce: 7 },
      "mainnet",
      "ApproveBuilder"
    );

    expect(request.typedData.types.ApproveBuilder.map((field) => field.name)).toEqual([
      "Builder",
      "MaxFeeRate",
      "BuilderName",
      "AsterChain",
      "User",
      "Nonce",
    ]);
    expect(request.entries.map(([key]) => key)).toEqual([
      "builder",
      "maxFeeRate",
      "builderName",
      "asterChain",
      "user",
      "nonce",
    ]);
  });

  it("signs under chain 56 on both networks", () => {
    // Not the network chain id. See SIGNATURE_CHAIN_ID in endpoints.ts.
    const mainnet = buildMainWalletRequest(
      approveBuilder,
      { user: USER, nonce: 1 },
      "mainnet",
      "ApproveBuilder"
    );
    const testnet = buildMainWalletRequest(
      approveBuilder,
      { user: USER, nonce: 1 },
      "testnet",
      "ApproveBuilder"
    );

    expect(mainnet.typedData.domain.chainId).toBe(56);
    expect(testnet.typedData.domain.chainId).toBe(56);
    expect(mainnet.signatureChainId).toBe(56);
  });

  it("keeps original value types in the message", () => {
    const request = buildMainWalletRequest(
      { agentAddress: SIGNER, expired: 1967945395040, canPerpTrade: true, canWithdraw: false },
      { user: USER, nonce: 3 },
      "mainnet",
      "ApproveAgent"
    );

    expect(request.typedData.message.CanWithdraw).toBe(false);
    expect(request.typedData.message.Expired).toBe(1967945395040);

    const types = Object.fromEntries(
      request.typedData.types.ApproveAgent.map((field) => [field.name, field.type])
    );
    expect(types.CanWithdraw).toBe("bool");
    expect(types.Expired).toBe("uint256");
    expect(types.Nonce).toBe("uint256");
  });

  it("uses the caller's primary type", () => {
    const request = buildMainWalletRequest({}, { user: USER, nonce: 1 }, "mainnet", "DelBuilder");
    expect(request.typedData.primaryType).toBe("DelBuilder");
    expect(request.typedData.types.DelBuilder).toBeDefined();
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
