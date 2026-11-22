import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";
import { I18nProvider } from "./i18n/i18n.js";
import ms from "../locales/ms.json";

function renderApp() {
  return render(
    <I18nProvider initial="en">
      <App />
    </I18nProvider>,
  );
}

const tagIds = () => screen.queryAllByRole("button", { expanded: true }).concat(screen.queryAllByRole("button", { expanded: false }))
  .map((b) => b.querySelector(".tag__id")?.textContent)
  .filter(Boolean)
  .sort();

describe("playground", () => {
  it("preloads the workshop draft and tags S003 and S007 on their lines", () => {
    renderApp();
    expect(tagIds()).toEqual(["S003", "S007"]);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("2 errors");
    // The first tag is open: fix and a link to the official docs.
    const docs = screen.getAllByRole("link", { name: /Official docs/ });
    expect(docs).toHaveLength(1);
    expect(docs[0]?.getAttribute("href")).toMatch(/^https:\/\/docs\.qorechain\.io\//);
  });

  it("stamps the fixed vault as cleared", () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("Example"), { target: { value: "workshop-fixed" } });
    expect(tagIds()).toEqual([]);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("No errors");
    expect(status.textContent).toContain("Cleared");
  });

  it("switches every visible text to Malay, including the findings", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Bahasa Melayu" }));
    expect(document.documentElement.lang).toBe("ms");
    expect(screen.getByLabelText("Contoh")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("2 ralat");
    const s007 = screen.getAllByText((_, el) => el?.classList.contains("tag__message") ?? false).map((el) => el.textContent);
    expect(s007.some((m) => m?.startsWith("Mesej yang disemak oleh pqcVerify"))).toBe(true);
    expect(screen.getByRole("link", { name: /Dokumen rasmi/ })).toBeTruthy();
    expect(document.title).toBe(ms.meta.title);
  });

  it("checks pasted source after a pause and tags a parse error on its line", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    const editor = screen.getByLabelText("Solidity source");
    fireEvent.change(editor, { target: { value: "pragma solidity ^0.8.24;\ncontract A {\n  function f( }\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("could not read this file"));
    expect(screen.getByText("Parse error")).toBeTruthy();
    expect(screen.getByText("Line 3, column 15. The parser says:")).toBeTruthy();
  });

  it("refuses a file that is not .sol and inspects one that is", async () => {
    const { container } = renderApp();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect((await screen.findByRole("alert")).textContent).toBe("Choose a .sol file.");
    const bad = "pragma solidity ^0.8.24;\ncontract V { address constant K = 0x0000000000000000000000000000000000000A02; }\n";
    fireEvent.change(input, { target: { files: [new File([bad], "Mine.sol", { type: "text/plain" })] } });
    await waitFor(() => expect(tagIds()).toEqual(["S001"]));
    expect(screen.getAllByText("Mine.sol").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("filters the sheet to one rule from the register", () => {
    renderApp();
    const register = screen.getByRole("complementary");
    fireEvent.click(within(register).getByRole("button", { name: /S003/ }));
    expect(tagIds()).toEqual(["S003"]);
    expect(within(register).getByRole("button", { name: /S001/ }).hasAttribute("disabled")).toBe(true);
  });
});
