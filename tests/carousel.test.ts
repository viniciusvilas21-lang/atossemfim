import { describe, expect, it } from "vitest";
import { isEligibleForCarousel } from "@/lib/carousel";

describe("isEligibleForCarousel", () => {
  it("never shows a name just because someone started a checkout", () => {
    expect(
      isEligibleForCarousel({
        allowPublicDisplay: true,
        carouselOverride: "AUTO",
        hasPaidDonation: false,
        hasActiveSubscription: false,
      }),
    ).toBe(false);
  });

  it("requires public-display consent even with a confirmed payment", () => {
    expect(
      isEligibleForCarousel({
        allowPublicDisplay: false,
        carouselOverride: "AUTO",
        hasPaidDonation: true,
        hasActiveSubscription: false,
      }),
    ).toBe(false);
  });

  it("shows the name once a donation is confirmed as paid", () => {
    expect(
      isEligibleForCarousel({
        allowPublicDisplay: true,
        carouselOverride: "AUTO",
        hasPaidDonation: true,
        hasActiveSubscription: false,
      }),
    ).toBe(true);
  });

  it("shows the name while the monthly subscription is active", () => {
    expect(
      isEligibleForCarousel({
        allowPublicDisplay: true,
        carouselOverride: "AUTO",
        hasPaidDonation: false,
        hasActiveSubscription: true,
      }),
    ).toBe(true);
  });

  it("lets an admin force-hide a name regardless of payment state", () => {
    expect(
      isEligibleForCarousel({
        allowPublicDisplay: true,
        carouselOverride: "FORCE_HIDE",
        hasPaidDonation: true,
        hasActiveSubscription: true,
      }),
    ).toBe(false);
  });

  it("lets an admin keep a canceled maintainer listed as a partner", () => {
    expect(
      isEligibleForCarousel({
        allowPublicDisplay: true,
        carouselOverride: "FORCE_SHOW",
        hasPaidDonation: false,
        hasActiveSubscription: false,
      }),
    ).toBe(true);
  });
});
