import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRememberedWalletBalance,
  getRememberedWalletBalance,
  rememberWalletBalance,
} from "../app/_lib/wallet-balance";

describe("estimated wallet balance memory", () => {
  beforeEach(() => clearRememberedWalletBalance());

  it("keeps the latest valid balance available while navigating", () => {
    rememberWalletBalance("125.50");
    expect(getRememberedWalletBalance()).toBe("125.50");
  });

  it("ignores missing or invalid amounts", () => {
    rememberWalletBalance("not an amount");
    expect(getRememberedWalletBalance()).toBeNull();
  });

  it("clears the balance when the rider signs out", () => {
    rememberWalletBalance(125.5);
    clearRememberedWalletBalance();
    expect(getRememberedWalletBalance()).toBeNull();
  });
});
