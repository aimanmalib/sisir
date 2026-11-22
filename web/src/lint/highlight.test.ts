import { describe, expect, it } from "vitest";
import { highlight } from "./highlight.js";

const kinds = (line: ReturnType<typeof highlight>[number]) => line.filter((t) => t.kind !== "plain").map((t) => [t.kind, t.text]);

describe("highlight", () => {
  it("keeps one entry per source line, empty lines included", () => {
    expect(highlight("a\n\nb")).toHaveLength(3);
  });

  it("does not count the newline at the end of a file as a line", () => {
    expect(highlight("a\nb\n")).toHaveLength(2);
    expect(highlight("")).toHaveLength(1);
  });

  it("colours keywords, types, strings, numbers and whole addresses", () => {
    const [line] = highlight('address constant K = 0x0000000000000000000000000000000000000a02; uint256 n = 42; string s = "hi";');
    expect(kinds(line!)).toEqual([
      ["type", "address"],
      ["keyword", "constant"],
      ["address", "0x0000000000000000000000000000000000000a02"],
      ["type", "uint256"],
      ["number", "42"],
      ["type", "string"],
      ["string", '"hi"'],
    ]);
  });

  it("carries a block comment across lines and stops at its end", () => {
    const lines = highlight("x /* one\ntwo */ return");
    expect(kinds(lines[0]!)).toEqual([["comment", "/* one"]]);
    expect(kinds(lines[1]!)).toEqual([["comment", "two */"], ["keyword", "return"]]);
  });

  it("joins the source back to the same text", () => {
    const src = 'pragma solidity ^0.8.24; // note\ncontract A { bytes x = hex"00"; }';
    expect(highlight(src).map((l) => l.map((t) => t.text).join("")).join("\n")).toBe(src);
  });
});
