import { describe, expect, it } from "vitest";

import {
  ASTER_PATHS,
  asterSide,
  buildApproveAgentRequest,
  buildApproveBuilderRequest,
  buildCloseRequest,
  buildOrderRequest,
} from "@/lib/exchange/aster/requests";
import type { BuilderConfig } from "@/lib/exchange/aster/builder";
import type { AsterAgentAuth, AsterMainAuth } from "@/lib/exchange/aster/signing";

const BUILDER: BuilderConfig = {
  address: "0x1111111111111111111111111111111111111111",
  feeRate: "0.0003",
};

const AGENT: AsterAgentAuth = {
  user: "0x2222222222222222222222222222222222222222",
  signer: "0x3333333333333333333333333333333333333333",
  nonce: 1700000000000,
};

const MAIN: AsterMainAuth = {
  user: "0x2222222222222222222222222222222222222222",
  nonce: 1700000000000,
};

describe("asterSide", () => {
  it("translates the terminal's vocabulary to the venue's", () => {
    expect(asterSide("long")).toBe("BUY");
    expect(asterSide("short")).toBe("SELL");
  });
});

describe("buildOrderRequest", () => {
  it("puts builder attribution inside the signed payload", () => {
    const request = buildOrderRequest(
      { symbol: "BTCUSDT", side: "long", quantity: 0.01 },
      BUILDER,
      AGENT,
      "mainnet"
    );

    // Inside the payload, not alongside it: on Aster these are signed
    // parameters, so attribution that is not here can never be added later.
    expect(request.payloadString).toContain("builder=0x1111111111111111111111111111111111111111");
    expect(request.payloadString).toContain("feeRate=0.0003");
    expect(request.typedData.message.msg).toBe(request.payloadString);
  });

  it("places an ordinary order when no builder is configured", () => {
    const request = buildOrderRequest(
      { symbol: "BTCUSDT", side: "long", quantity: 0.01 },
      null,
      AGENT,
      "mainnet"
    );

    expect(request.payloadString).not.toContain("builder=");
    expect(request.payloadString).not.toContain("feeRate=");
    expect(request.payloadString).toContain("symbol=BTCUSDT");
  });

  it("omits reduceOnly entirely on an opening order", () => {
    const request = buildOrderRequest(
      { symbol: "BTCUSDT", side: "long", quantity: 0.01 },
      BUILDER,
      AGENT,
      "mainnet"
    );
    expect(request.payloadString).not.toContain("reduceOnly");
  });

  it("sends a market order on the requested side", () => {
    const short = buildOrderRequest(
      { symbol: "ETHUSDT", side: "short", quantity: 2 },
      BUILDER,
      AGENT,
      "mainnet"
    );
    expect(short.payloadString).toContain("side=SELL");
    expect(short.payloadString).toContain("type=MARKET");
    expect(short.payloadString).toContain("quantity=2");
  });

  it("carries the auth fields the venue expects", () => {
    const request = buildOrderRequest(
      { symbol: "BTCUSDT", side: "long", quantity: 0.01 },
      BUILDER,
      AGENT,
      "mainnet"
    );
    expect(request.payloadString).toContain("asterChain=Mainnet");
    expect(request.payloadString).toContain(`user=${AGENT.user}`);
    expect(request.payloadString).toContain(`signer=${AGENT.signer}`);
    expect(request.payloadString).toContain(`nonce=${AGENT.nonce}`);
  });
});

describe("buildCloseRequest", () => {
  it("flips the side and marks the order reduce-only", () => {
    const request = buildCloseRequest("BTCUSDT", "long", 0.01, BUILDER, AGENT, "mainnet");
    expect(request.payloadString).toContain("side=SELL");
    expect(request.payloadString).toContain("reduceOnly=true");
  });

  it("closes a short by buying", () => {
    const request = buildCloseRequest("BTCUSDT", "short", 0.01, BUILDER, AGENT, "mainnet");
    expect(request.payloadString).toContain("side=BUY");
  });

  it("still attributes the closing leg", () => {
    const request = buildCloseRequest("BTCUSDT", "long", 0.01, BUILDER, AGENT, "mainnet");
    expect(request.payloadString).toContain("feeRate=0.0003");
  });
});

describe("buildApproveBuilderRequest", () => {
  it("signs the ceiling under the main-wallet chain", () => {
    const request = buildApproveBuilderRequest(BUILDER, "0.0006", MAIN, "mainnet");

    expect(request.typedData.primaryType).toBe("ApproveBuilder");
    // 56, not the network chainId - a main-wallet authorisation is signed on
    // the chain the wallet lives on.
    expect(request.signatureChainId).toBe(56);
    expect(request.typedData.domain.chainId).toBe(56);
  });

  it("carries the address and the ceiling", () => {
    const request = buildApproveBuilderRequest(BUILDER, "0.0006", MAIN, "mainnet");
    const entries = Object.fromEntries(request.entries);
    expect(entries.builder).toBe(BUILDER.address);
    expect(entries.maxFeeRate).toBe("0.0006");
  });

  it("types the fractional ceiling as a string, not a number", () => {
    const request = buildApproveBuilderRequest(BUILDER, "0.0006", MAIN, "mainnet");
    const field = request.typedData.types.ApproveBuilder.find((f) => f.name === "MaxFeeRate");
    expect(field?.type).toBe("string");
  });
});

describe("buildApproveAgentRequest", () => {
  const approval = {
    agentName: "finalboss",
    agentAddress: "0x4444444444444444444444444444444444444444",
    expired: 1800000000,
  };

  it("bundles the builder into the agent approval so there is one prompt", () => {
    const request = buildApproveAgentRequest(approval, BUILDER, "0.0006", MAIN, "mainnet");
    const entries = Object.fromEntries(request.entries);

    expect(entries.agentName).toBe("finalboss");
    expect(entries.builder).toBe(BUILDER.address);
    expect(entries.feeRate).toBe("0.0003");
    expect(entries.maxFeeRate).toBe("0.0006");
    expect(request.typedData.primaryType).toBe("ApproveAgent");
  });

  it("approves the agent alone when no builder is configured", () => {
    const request = buildApproveAgentRequest(approval, null, null, MAIN, "mainnet");
    const entries = Object.fromEntries(request.entries);

    expect(entries.agentName).toBe("finalboss");
    expect(entries.builder).toBeUndefined();
    expect(entries.feeRate).toBeUndefined();
    expect(entries.maxFeeRate).toBeUndefined();
  });

  it("refuses a half-configured builder rather than approving nobody", () => {
    const noCeiling = buildApproveAgentRequest(approval, BUILDER, null, MAIN, "mainnet");
    const noAddress = buildApproveAgentRequest(approval, null, "0.0006", MAIN, "mainnet");

    expect(Object.fromEntries(noCeiling.entries).builder).toBeUndefined();
    expect(Object.fromEntries(noAddress.entries).maxFeeRate).toBeUndefined();
  });

  it("types the integer expiry as uint256 and the name as string", () => {
    const request = buildApproveAgentRequest(approval, null, null, MAIN, "mainnet");
    const fields = request.typedData.types.ApproveAgent;

    expect(fields.find((f) => f.name === "Expired")?.type).toBe("uint256");
    expect(fields.find((f) => f.name === "AgentName")?.type).toBe("string");
  });
});

describe("ASTER_PATHS", () => {
  it("uses the verified V3 order and builder-approval paths", () => {
    expect(ASTER_PATHS.order).toBe("/fapi/v3/order");
    expect(ASTER_PATHS.approveBuilder).toBe("/fapi/v3/approveBuilder");
  });
});
