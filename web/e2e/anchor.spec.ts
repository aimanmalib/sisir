import { expect, test, type Page } from "@playwright/test";
import { createQorexMock } from "@qorechain/qorex-wallet-mock";
import { E2E_LEDGER, installFakeChain } from "./fake-chain.js";

type Profile = "current" | "planned";

async function open(page: Page, profile: Profile, autoApprove = true) {
  const chain = await installFakeChain(page);
  await page.addInitScript({ content: createQorexMock({ profile, autoApprove }).initScript() });
  await page.goto("/?lang=en");
  return chain;
}

/** Step 1: pick the QoreX connector (RainbowKit also lists the mock under its own EIP-6963 name). */
async function connect(page: Page) {
  const ledger = page.getByRole("region", { name: "Anchor this report" });
  await ledger.getByRole("button", { name: "Connect QoreX" }).click();
  await page.getByTestId("rk-wallet-option-qorex").click();
  await expect(ledger.getByRole("button", { name: /^Connected: / })).toBeVisible();
  return ledger;
}

function contains(haystack: Uint8Array, needle: string): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle, "utf8"));
}

test("the report slip shows the hashes the CLI computes, before any wallet", async ({ page }) => {
  await open(page, "current");
  const ledger = page.getByRole("region", { name: "Anchor this report" });
  await expect(ledger.getByText("QDayVault_v0_buggy.sol")).toBeVisible();
  await expect(ledger.locator("code").first()).toHaveAttribute("title", /^0x[0-9a-f]{64}$/);
  await expect(page.getByRole("region", { name: "Recent anchors" }).getByText("No anchors yet.")).toBeVisible();
});

test("QoreX today: the window opens hybrid-signed, and the EVM step says QoreX cannot sign it yet", async ({ page }) => {
  const chain = await open(page, "current");
  const ledger = await connect(page);

  await ledger.getByRole("button", { name: "Open window in QoreX" }).click();
  await expect(ledger.getByText(/^Window open for 0x/)).toBeVisible();
  await expect(ledger.getByText("ML-DSA-87 layer: present", { exact: false })).toBeVisible();
  const windowTx = chain.nativeTxs.at(-1);
  expect(windowTx && contains(windowTx, "/qorechain.pqc.v1.MsgOpenEVMWindow")).toBe(true);
  expect(windowTx && contains(windowTx, E2E_LEDGER)).toBe(true);

  await ledger.getByRole("button", { name: "Anchor this report" }).click();
  await expect(ledger.getByRole("alert")).toContainText("QoreX does not sign EVM transactions yet");
  expect(chain.anchors).toHaveLength(0);
});

test("QoreX as announced: the anchor lands and the recent list shows it", async ({ page }) => {
  const chain = await open(page, "planned");
  const ledger = await connect(page);
  const reportHash = await ledger.locator("code").first().getAttribute("title");

  await ledger.getByRole("button", { name: "Open window in QoreX" }).click();
  await expect(ledger.getByText(/^Window open for 0x/)).toBeVisible();
  await ledger.getByRole("button", { name: "Anchor this report" }).click();
  await expect(ledger.getByText(/^Anchored in block \d+\./)).toBeVisible();

  expect(chain.anchors).toHaveLength(1);
  expect(chain.anchors[0]?.reportHash).toBe(reportHash);
  expect(chain.anchors[0]?.findings).toBe(2);
  const recent = page.getByRole("region", { name: "Recent anchors" });
  await expect(recent.locator("code").first()).toHaveAttribute("title", reportHash ?? "");
  expect(chain.unknown, "JSON-RPC methods the fake chain did not answer").toEqual([]);
});

test("declining in the wallet sends nothing and says so", async ({ page }) => {
  const chain = await open(page, "current", false);
  const ledger = page.getByRole("region", { name: "Anchor this report" });
  await ledger.getByRole("button", { name: "Connect QoreX" }).click();
  await page.getByTestId("rk-wallet-option-qorex").click();
  await page.evaluate(() => (window as unknown as { __qorexMock: { approveNext(): void } }).__qorexMock.approveNext());
  await expect(ledger.getByRole("button", { name: /^Connected: / })).toBeVisible();

  await ledger.getByRole("button", { name: "Open window in QoreX" }).click();
  await page.evaluate(() => (window as unknown as { __qorexMock: { rejectNext(): void } }).__qorexMock.rejectNext());
  await expect(ledger.getByRole("alert")).toContainText("You declined in the wallet");
  expect(chain.nativeTxs).toHaveLength(0);
});

/** Where the dialog box sits against the viewport, and whether the page scrolls sideways. */
async function dialogFit(page: Page) {
  const box = await page.locator('[data-rk] [role="dialog"] [role="document"] > div > div').first().boundingBox();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  return { left: box?.x ?? -1, right: (box?.x ?? 0) + (box?.width ?? 0), overflow };
}

test.describe("on a 320 px window with a desktop browser", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("the wallet dialogs fit the screen", async ({ page }) => {
    await open(page, "current");
    const ledger = page.getByRole("region", { name: "Anchor this report" });
    await ledger.getByRole("button", { name: "Connect QoreX" }).scrollIntoViewIfNeeded();
    await ledger.getByRole("button", { name: "Connect QoreX" }).click();
    await expect(page.getByTestId("rk-wallet-option-qorex")).toBeVisible();
    const connectFit = await dialogFit(page);
    expect(connectFit.left, "connect dialog left edge").toBeGreaterThanOrEqual(0);
    expect(connectFit.right, "connect dialog right edge").toBeLessThanOrEqual(320);
    expect(connectFit.overflow).toBe(0);

    await page.getByTestId("rk-wallet-option-qorex").click();
    await ledger.getByRole("button", { name: /^Connected: / }).click();
    await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
    const accountFit = await dialogFit(page);
    expect(accountFit.left, "account dialog left edge").toBeGreaterThanOrEqual(0);
    expect(accountFit.right, "account dialog right edge").toBeLessThanOrEqual(320);
    expect(accountFit.overflow).toBe(0);
  });
});
