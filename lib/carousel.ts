export type CarouselOverride = "AUTO" | "FORCE_SHOW" | "FORCE_HIDE";

export interface CarouselEligibilityInput {
  allowPublicDisplay: boolean;
  carouselOverride: CarouselOverride;
  hasPaidDonation: boolean;
  hasActiveSubscription: boolean;
}

/**
 * A supporter's name only ever reaches the public carousel after OpenPix has
 * confirmed a real payment (a PAID donation or an ACTIVE subscription) — never
 * just because they started the checkout flow. Admins can still force-show a
 * name (e.g. keep a canceled maintainer listed as "parceiro da missão") or
 * force-hide one, regardless of the automatic rule.
 */
export function isEligibleForCarousel(input: CarouselEligibilityInput): boolean {
  if (!input.allowPublicDisplay) return false;
  if (input.carouselOverride === "FORCE_HIDE") return false;
  if (input.carouselOverride === "FORCE_SHOW") return true;
  return input.hasPaidDonation || input.hasActiveSubscription;
}
