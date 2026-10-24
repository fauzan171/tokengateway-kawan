import { describe, expect, it } from "vitest";
import {
  MAX_IMAGES,
  imageParts,
  messageText,
} from "./content";
import { validateAttachments } from "./attachments";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("validateAttachments", () => {
  it("accepts a png data URL and returns an image part", () => {
    expect(validateAttachments([{ mime: "image/png", dataUrl: PNG }])).toEqual([
      { kind: "image", mime: "image/png", dataUrl: PNG },
    ]);
  });

  it("treats a missing field as no attachments", () => {
    expect(validateAttachments(undefined)).toEqual([]);
    expect(validateAttachments(null)).toEqual([]);
  });

  it("rejects svg, which could carry script", () => {
    expect(() =>
      validateAttachments([{ mime: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,AA==" }]),
    ).toThrow(/tidak didukung/);
  });

  it("rejects a data URL whose prefix disagrees with the claimed mime", () => {
    expect(() => validateAttachments([{ mime: "image/png", dataUrl: "data:image/gif;base64,AA==" }])).toThrow(
      /tidak cocok/,
    );
  });

  it("rejects more than the per-message limit", () => {
    const many = Array.from({ length: MAX_IMAGES + 1 }, () => ({ mime: "image/png", dataUrl: PNG }));
    expect(() => validateAttachments(many)).toThrow(/Maksimal/);
  });

  it("rejects a non-array payload", () => {
    expect(() => validateAttachments("nope")).toThrow(/array/);
  });
});

describe("messageText and imageParts", () => {
  const contentJson = JSON.stringify({
    parts: [{ kind: "text", text: "lihat ini" }, { kind: "image", mime: "image/png", dataUrl: PNG }],
  });

  it("keeps only the text part in the message body", () => {
    expect(messageText(contentJson)).toBe("lihat ini");
  });

  it("extracts the image part for the gateway request", () => {
    expect(imageParts(contentJson)).toEqual([{ kind: "image", mime: "image/png", dataUrl: PNG }]);
  });

  it("survives malformed content", () => {
    expect(messageText("{not json")).toBe("");
    expect(imageParts("{not json")).toEqual([]);
  });
});
