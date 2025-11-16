
import { apiGet, apiPost } from "./client";

export type OnboardingConfig = {
  onboarded: "true" | "false";
  brokerUrl: string;
};

export function fetchOnboardingConfig(): Promise<OnboardingConfig> {
  return apiGet<OnboardingConfig>("/settings/onboarding");
}

export function updateOnboardingConfig(config: Partial<OnboardingConfig>) {
  return apiPost<void, Partial<OnboardingConfig>>("/settings/onboarding", config);
}
