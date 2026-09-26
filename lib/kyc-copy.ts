import type { KycStatus } from "./api/types";

/**
 * One set of words for the six KYC states, shared by the entertainer's own
 * portal and the venue admin's roster so the two never describe the same
 * person differently.
 *
 * The labels are deliberately honest: REVIEW is "Manual review", not
 * "Verified". Someone waiting on a human check should not be shown a badge
 * that says they are done, and a venue deciding who to book should not be
 * shown one either.
 */
export interface KycCopy {
  /** Short label for a badge. */
  label: string;
  /** What it means for the entertainer, addressed to them. */
  entertainerDetail: string;
  /** What it means for the venue looking at their roster. */
  venueDetail: string;
  tone: "positive" | "neutral" | "warning" | "danger";
}

export const KYC_COPY: Record<KycStatus, KycCopy> = {
  NOT_STARTED: {
    label: "Not started",
    entertainerDetail: "Add your bank details to start getting paid.",
    venueDetail: "Hasn't begun onboarding. They can't be paid out yet.",
    tone: "neutral",
  },
  PENDING: {
    label: "In progress",
    entertainerDetail: "You've started. Finish the remaining steps to get paid.",
    venueDetail: "Onboarding started but not finished. They can't be paid out yet.",
    tone: "warning",
  },
  VERIFIED: {
    label: "Verified",
    entertainerDetail: "You're all set. Payouts go to your confirmed account.",
    venueDetail: "Fully verified. Payouts can be sent.",
    tone: "positive",
  },
  FAILED: {
    label: "Failed",
    entertainerDetail: "A check didn't pass. See the reason below and try again.",
    venueDetail: "A check failed. They'll need to correct their details.",
    tone: "danger",
  },
  REVIEW: {
    label: "Manual review",
    entertainerDetail:
      "Your details are saved and a person is checking them. Nothing more for you to do.",
    venueDetail: "Waiting on a manual check by Splitcore. Not yet payable.",
    tone: "warning",
  },
  SUSPENDED: {
    label: "Suspended",
    entertainerDetail: "Payouts are on hold. Contact your venue or Splitcore.",
    venueDetail: "Payouts are on hold for this entertainer.",
    tone: "danger",
  },
};
