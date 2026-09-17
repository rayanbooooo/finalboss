import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

import {
  AGENT_NAME,
  APPROVAL_DAYS,
  approvalQuery,
  buildApproval,
  createAgentWallet,
  defaultExpiry,
} from "@/lib/exchange/aster/agent";

const USER = "0x014c85ffb0fF2F2972237AA950B452f92C69Ae1D";
const AGENT = "0xC98Fd64eBc39E28b92849d9cCef9495663439014";

const params = (payload: string) =>
  Object.fromEntries(payload.split("&").map((pair) => pair.split("=") as [string, string]));

describe("createAgentWallet", () => {
  it("returns a key and the address it controls", () => {
    const wallet = createAgentWallet();
    expect(privateKeyToAccount(wallet.privateKey).address).toBe(wallet.address);
  });

  it("generates a different wallet every time", () => {
    // Reuse would mean two accounts sharing one trading key.
    expect(createAgentWallet().address).not.toBe(createAgentWallet().address);
  });
});

describe("buildApproval", () => {
  const approval = buildApproval({ user: USER, agentAddress: AGENT, nonce: 1, expiresAt: 42 });
  const sent = params(approval.payloadString);

  it("never grants withdrawal", () => {
    // The single most important assertion in this file. Without withdrawal the
    // worst a compromise achieves is unwanted trades; with it, the money is
    // gone. There is deliberately no argument that could flip this.
    expect(sent.canWithdraw).toBe("false");
  });

  it("never grants spot access", () => {
    // A perpetuals terminal never places a spot order, so granting it widens
    // what a leaked key can do in exchange for nothing.
    expect(sent.canSpotTrade).toBe("false");
  });

  it("grants perpetuals trading, which is the entire point", () => {
    expect(sent.canPerpTrade).toBe("true");
  });

  it("names the app so a user can find and revoke it in Aster's own list", () => {
    expect(sent.agentName).toBe(AGENT_NAME);
  });

  it("delegates to the agent wallet, not the user's own", () => {
    expect(sent.agentAddress).toBe(AGENT);
    expect(sent.user).toBe(USER);
  });

  it("sends an empty ipWhitelist, which is legal only because withdrawal is off", () => {
    expect(approval.entries.map(([key]) => key)).toContain("ipWhitelist");
  });

  it("signs under chain 56, as a main-wallet authorisation must", () => {
    expect(approval.signatureChainId).toBe(56);
    expect(approval.typedData.domain.chainId).toBe(56);
  });

  it("uses the flat Message type Aster signs everything with", () => {
    expect(approval.typedData.primaryType).toBe("Message");
    expect(approval.typedData.message.msg).toBe(approval.payloadString);
  });

  it("honours an explicit expiry", () => {
    expect(sent.expired).toBe("42");
  });

  it("defaults the expiry when none is given", () => {
    const withDefault = buildApproval({ user: USER, agentAddress: AGENT, nonce: 1 });
    expect(Number(params(withDefault.payloadString).expired)).toBeGreaterThan(Date.now());
  });
});

describe("defaultExpiry", () => {
  it("lapses on its own rather than lasting forever", () => {
    // An agent key lives in a browser. An indefinitely valid one on an
    // abandoned laptop is nobody's to recover.
    const now = 1_700_000_000_000;
    expect(defaultExpiry(now)).toBe(now + APPROVAL_DAYS * 86_400_000);
    expect(APPROVAL_DAYS).toBeLessThanOrEqual(365);
  });
});

describe("approvalQuery", () => {
  it("appends the signature to the exact string that was signed", () => {
    // Rebuilding the payload here instead of reusing it risks transmitting a
    // string that differs by a byte from the one the wallet signed.
    const approval = buildApproval({ user: USER, agentAddress: AGENT, nonce: 1, expiresAt: 42 });
    const query = approvalQuery(approval, "0xdeadbeef");

    expect(query).toBe(`${approval.payloadString}&signature=0xdeadbeef`);
    expect(query.startsWith(approval.typedData.message.msg as string)).toBe(true);
  });
});
