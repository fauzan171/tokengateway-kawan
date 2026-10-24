/**
 * Uji gerbang konfigurasi media (WP-NT-P8-01/03/04).
 *
 * Murni env → objek; tidak menyentuh jaringan maupun DB.
 */

import { describe, expect, it } from "vitest";
import { readMediaConfig } from "./config";

describe("readMediaConfig", () => {
  it("env kosong → tanpa kunci apa pun", () => {
    expect(readMediaConfig({})).toEqual({});
  });

  it("nilai kosong/spasi dianggap absen", () => {
    expect(
      readMediaConfig({ MEDIA_IMAGE_MODEL: "  ", MEDIA_STT_MODEL: "", MEDIA_TTS_MODEL: " " }),
    ).toEqual({});
  });

  it("hanya MEDIA_IMAGE_MODEL → hanya image", () => {
    expect(readMediaConfig({ MEDIA_IMAGE_MODEL: "gpt-image-1" })).toEqual({
      image: { model: "gpt-image-1" },
    });
  });

  it("voice opsional ikut bila ada", () => {
    expect(
      readMediaConfig({ MEDIA_TTS_MODEL: "tts-1", MEDIA_TTS_VOICE: "nova" }),
    ).toEqual({ tts: { model: "tts-1", voice: "nova" } });
    expect(readMediaConfig({ MEDIA_TTS_MODEL: "tts-1" })).toEqual({ tts: { model: "tts-1" } });
  });
});
