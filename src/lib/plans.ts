export const PLAN_LIMITS = {
  pilot: {
    label: "Piloto",
    screens: 5,
    campaigns: 25,
    playlistItems: 20,
    videoBytes: 60 * 1024 * 1024,
    imageBytes: 12 * 1024 * 1024,
    monthlyCredits: 100,
  },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan?: string) {
  return PLAN_LIMITS[(plan as PlanId) in PLAN_LIMITS ? (plan as PlanId) : "pilot"];
}
