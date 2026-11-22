import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n/i18n.js";
import { HashRow } from "./AnchorPanel.js";

const HASH = `0x${"ab".repeat(32)}`;

function renderRow(lang: "en" | "ms" = "en") {
  return render(
    <I18nProvider initial={lang}>
      <dl>
        <HashRow label="Report hash" value={HASH} />
      </dl>
    </I18nProvider>,
  );
}

function stubClipboard(writeText: (v: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("report slip copy button", () => {
  it("says Copied when the browser takes the hash", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Copy: Report hash" }));
    expect(await screen.findByText("Copied")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(HASH);
  });

  it("says the clipboard was blocked and shows the full hash to select, instead of failing silently", async () => {
    stubClipboard(() => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")));
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Copy: Report hash" }));
    const note = await screen.findByRole("status");
    expect(note.textContent).toContain("blocked the clipboard");
    expect(note.querySelector("code")?.textContent).toBe(HASH);
    expect(screen.getByRole("button").textContent).toBe("Not copied");
  });

  it("handles a browser with no clipboard at all, in Malay", async () => {
    renderRow("ms");
    fireEvent.click(screen.getByRole("button", { name: "Salin: Report hash" }));
    expect((await screen.findByRole("status")).textContent).toContain("menyekat papan keratan");
  });
});
