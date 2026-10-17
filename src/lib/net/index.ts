/**
 * Titik masuk modul kebijakan keluar (SDD-5.3, WP-NT-P2-04).
 *
 * Pemanggil lain (mis. klien gateway WP-NT-P2-05) sebaiknya mengimpor dari
 * sini supaya permukaan modul tetap satu pintu.
 */

export {
  assertOutboundAllowed,
  assertRedirectAllowed,
  isBlockedAddress,
  DEFAULT_OUTBOUND_OPTIONS,
  OUTBOUND_LIMITS,
} from "./policy";

export type { HostResolver, OutboundPolicyOptions, ResolvedAddress } from "./policy";
