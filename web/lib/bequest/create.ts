import { db, schema } from "../db";
import { encrypt } from "../crypto";
import { newWallet } from "../zerion/send";
import { lookupAsset } from "../zerion/assets";
import { newBequestId } from "./ids";
import { isAddress } from "viem";

export type CreateBequestInput = {
  userId: string;
  title?: string;
  beneficiaryAddress: string;
  assetSymbol: string;
  assetChain: string;
  amountDecimal: string;
  checkinWindowSeconds: number;
};

export async function createBequest(input: CreateBequestInput) {
  if (!isAddress(input.beneficiaryAddress)) {
    throw new Error("Invalid beneficiary address.");
  }
  // Validate the asset exists in the registry — surfaces a friendly error
  // before we touch the chain.
  lookupAsset(input.assetSymbol, input.assetChain);

  const amountNum = Number(input.amountDecimal);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  if (input.checkinWindowSeconds < 30) {
    throw new Error("Check-in window must be at least 30 seconds.");
  }

  const id = newBequestId();
  const wallet = newWallet();
  const enc = encrypt(wallet.privateKey, `wallet:${id}`);

  await db.insert(schema.bequests).values({
    id,
    userId: input.userId,
    title: input.title ?? null,
    beneficiaryAddress: input.beneficiaryAddress.toLowerCase(),
    assetSymbol: input.assetSymbol.toUpperCase(),
    assetChain: input.assetChain,
    amountDecimal: input.amountDecimal,
    checkinWindowSeconds: input.checkinWindowSeconds,
    walletAddress: wallet.address.toLowerCase(),
    walletKeyCiphertext: enc.ciphertext,
    walletKeyNonce: enc.nonce,
    status: "draft",
  });

  return { id, walletAddress: wallet.address };
}
