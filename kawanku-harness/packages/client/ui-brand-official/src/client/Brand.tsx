import { BrandWordmark, FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the Kawanku mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the Kawanku monogram.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <FishLogo size={size} />
}

/**
 * Render the Kawanku name artwork without its independently slotted mark.
 * @returns the Kawanku name wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} />
}
