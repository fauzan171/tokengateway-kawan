import { describe, expect, it } from "vitest";
import { en, format, id, messages, type MessageKey } from "./messages";

describe("kamus i18n", () => {
  it("kunci `en` sama persis dengan `id`", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(id).sort());
  });

  it("tidak ada nilai kosong", () => {
    for (const [key, value] of Object.entries(messages.id)) {
      expect(value.trim(), `id.${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(messages.en)) {
      expect(value.trim(), `en.${key}`).not.toBe("");
    }
  });

  it("tiap placeholder di `id` juga ada di `en`", () => {
    const vars = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(id) as MessageKey[]) {
      expect(vars(en[key]), `en.${key}`).toEqual(vars(id[key]));
    }
  });

  it("format mengisi placeholder dan membiarkan yang tak dikenal", () => {
    expect(format("Ukuran font: {value}%", { value: 110 })).toBe("Ukuran font: 110%");
    expect(format("Ukuran font: {value}%")).toBe("Ukuran font: {value}%");
    expect(format("{a} dan {b}", { a: "x" })).toBe("x dan {b}");
  });
});