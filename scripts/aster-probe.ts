/**
 * Answers, against the live venue, the questions the documentation cannot.
 *
 *   1. Does a signature this codebase produces actually verify at Aster?
 *   2. What leverage does Aster really permit on a symbol?
 *
 * Both matter more than any amount of further reading. Aster's docs contradict
 * themselves on parameter sorting, on whether `user` is required and on whether
 * `timestamp` is sent; and they describe the leverage parameter as "int from 1
 * to 125" in wording inherited verbatim from Binance, while Aster advertises
 * 1001x. One real request settles all of it.
 *
 * This is a READ. It places no order, moves no funds and changes nothing on the
 * account. The worst outcome is an error message.
 *
 * WHY THIS IS A SCRIPT YOU RUN, AND NOT SOMETHING THE ASSISTANT RAN
 *
 * Two reasons, and the second is the important one. The sandbox this was
 * written in cannot reach asterdex.com at all - its egress proxy refuses the
 * connection. And signing needs your API wallet's private key, which must never
 * leave your machine, never be pasted into a chat, and never be committed. It
 * is read from the environment here and printed nowhere.
 *
 * USAGE
 *
 *   ASTER_SIGNER_KEY=0x...  \
 *   ASTER_SIGNER=0x...      \
 *   ASTER_USER=0x...        \
 *   npm run aster:probe
 *
 * ASTER_USER is optional - leaving it out is itself part of the experiment,
 * since the order example sends `signer` alone while the overview says `user`
 * is required. If a run fails to verify, try it the other way before changing
 * anything else.
 */

import { privateKeyToAccount } from "viem/accounts";

import { asterNetwork, type AsterNetwork } from "@/lib/exchange/aster/endpoints";
import { leverageBracketCall } from "@/lib/exchange/aster/requests";
import { SORT_KEYS_ASCII, nextNonce } from "@/lib/exchange/aster/signing";

/**
 * Aster's deposit gate. Since 1 September 2026 its authenticated V3 endpoints
 * require the linked main wallet to have deposited at least once, so this code
 * is proof the request authenticated - it is reached only after the signature
 * has been read and the account identified.
 */
const DEPOSIT_REQUIRED = -5050;

/** Codes that genuinely indicate a malformed or mis-signed request. */
const SIGNATURE_ERRORS = new Set([-1021, -1022, -1099, -2014, -2015, -4056]);

const SYMBOL = process.env.ASTER_SYMBOL ?? "BTCUSDT";
const NETWORK = (process.env.ASTER_NETWORK ?? "mainnet") as AsterNetwork;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. See the usage block at the top of this file.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const key = required("ASTER_SIGNER_KEY");
  const signer = required("ASTER_SIGNER");
  const user = process.env.ASTER_USER?.trim() || undefined;

  if (!key.startsWith("0x") || key.length !== 66) {
    console.error("ASTER_SIGNER_KEY should be 0x followed by 64 hex characters.");
    process.exit(1);
  }

  const account = privateKeyToAccount(key as `0x${string}`);

  // A mismatch here is the single most common cause of an "unauthorised"
  // response, and it is worth catching before the network is involved: the
  // signature would recover to a real address that simply is not the one Aster
  // has on file for this account.
  if (account.address.toLowerCase() !== signer.toLowerCase()) {
    console.error(
      `ASTER_SIGNER_KEY belongs to ${account.address}, but ASTER_SIGNER is ${signer}.\n` +
        "These must be the same wallet - the key signs, the address identifies."
    );
    process.exit(1);
  }

  const call = leverageBracketCall({ signer, user, nonce: nextNonce() }, NETWORK, SYMBOL);
  const signature = await account.signTypedData({
    domain: call.request.typedData.domain,
    types: { Message: call.request.typedData.types.Message },
    primaryType: "Message",
    message: call.request.typedData.message as { msg: string },
  });

  const host = asterNetwork(NETWORK).host;
  const url = `${host}${call.path}?${call.request.payloadString}&signature=${signature}`;

  console.log("--- what is being sent ------------------------------------");
  console.log(`network        ${NETWORK}  (${host})`);
  console.log(`path           ${call.method} ${call.path}`);
  console.log(`sorted keys    ${SORT_KEYS_ASCII}`);
  console.log(`user sent      ${user ? "yes" : "no"}`);
  console.log(`signed string  ${call.request.payloadString}`);
  console.log("");

  const response = await fetch(url, { method: call.method });
  const text = await response.text();

  console.log("--- what came back ----------------------------------------");
  console.log(`HTTP ${response.status}`);
  console.log(text.slice(0, 2000));
  console.log("");

  if (!response.ok) {
    // Not every rejection is a signing problem, and treating them alike is
    // actively harmful: this block used to advise flipping SORT_KEYS_ASCII on
    // any failure, which would have broken a correct implementation on the
    // strength of an error that proved it was correct.
    let code: number | undefined;
    try {
      code = (JSON.parse(text) as { code?: number }).code;
    } catch {
      // Not JSON; fall through to the generic advice below.
    }

    console.log("--- read this ---------------------------------------------");

    if (code === DEPOSIT_REQUIRED) {
      console.log("The signature VERIFIED. Do not change any signing code.");
      console.log("");
      console.log("-5050 is Aster's deposit gate, not an auth failure: since");
      console.log("1 September 2026 their authenticated V3 endpoints require the");
      console.log("linked main wallet to have deposited at least once. Reaching");
      console.log("this error means Aster read the signature, identified the");
      console.log("account, and then applied a business rule.");
      console.log("");
      console.log("Next: deposit into the Aster account this wallet is linked to,");
      console.log("then run this again. Public market data needs no deposit.");
      return;
    }

    if (code !== undefined && SIGNATURE_ERRORS.has(code)) {
      console.log("This one does look like signing. Try, one at a time:");
      console.log("  1. flip SORT_KEYS_ASCII in lib/exchange/aster/signing.ts");
      console.log("  2. add or remove ASTER_USER");
      console.log("  3. check the clock - nonce must be within 10s of server time");
      return;
    }

    console.log("Not a known signing error - read the venue's message above.");
    console.log("Change signing code only if the message actually names the");
    console.log("signature; a business rejection means signing already worked.");
    return;
  }

  // The answer this script exists for.
  try {
    const parsed = JSON.parse(text) as Array<{
      symbol?: string;
      brackets?: Array<{ initialLeverage?: number; notionalCap?: number }>;
    }>;

    const leverages = parsed
      .flatMap((entry) => entry.brackets ?? [])
      .map((bracket) => bracket.initialLeverage)
      .filter((value): value is number => typeof value === "number");

    if (leverages.length > 0) {
      const max = Math.max(...leverages);
      console.log("--- the answer --------------------------------------------");
      console.log(`Max leverage Aster permits on ${SYMBOL} via the API: ${max}x`);
      console.log(
        max > 125
          ? "Above 125 - the docs' \"1 to 125\" is inherited Binance wording. Carry on."
          : "125 or below - high leverage is not reachable through this API. Stop and rethink."
      );
    }
  } catch {
    console.log("Response was not the JSON shape expected; the raw body is above.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
