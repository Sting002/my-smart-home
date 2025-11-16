import { useEffect, useRef } from "react";
import type { Device } from "@/utils/energyContextTypes";
import { toast } from "@/hooks/use-toast";

type Args = {
  devices: Device[];
  tariff: number;
  monthlyBudget: number;
  touEnabled: boolean;
  touPeakPrice: number;
  touOffpeakPrice: number;
  touOffpeakStart: string;
  touOffpeakEnd: string;
};

type BudgetLevel = "none" | "75" | "90" | "100";

function currentBudgetLevel(ratio: number): BudgetLevel {
  if (ratio >= 1) return "100";
  if (ratio >= 0.9) return "90";
  if (ratio >= 0.75) return "75";
  return "none";
}

const toMinutes = (value: string) => {
  const [hh, mm] = value.split(":").map((x) => Number(x));
  return hh * 60 + (mm || 0);
};

export function useBudgetAlerts({
  devices,
  tariff,
  monthlyBudget,
  touEnabled,
  touPeakPrice,
  touOffpeakPrice,
  touOffpeakStart,
  touOffpeakEnd,
}: Args) {
  const lastLevelRef = useRef<BudgetLevel>("none");
  const lastDayRef = useRef<string>(new Date().toDateString());

  useEffect(() => {
    if (!monthlyBudget) return undefined;

    const timer = setInterval(() => {
      const today = new Date().toDateString();
      if (today !== lastDayRef.current) {
        lastDayRef.current = today;
        lastLevelRef.current = "none";
      }

      const budgetDaily = monthlyBudget / 30;

      const priceNow = (() => {
        if (!touEnabled) return tariff;
        const startMinutes = toMinutes(touOffpeakStart);
        const endMinutes = toMinutes(touOffpeakEnd);
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const inOffPeak =
          startMinutes < endMinutes
            ? nowMinutes >= startMinutes && nowMinutes < endMinutes
            : nowMinutes >= startMinutes || nowMinutes < endMinutes;
        return inOffPeak ? touOffpeakPrice : touPeakPrice;
      })();

      const todayKwh = devices.reduce(
        (sum, device) => sum + Number(device.kwhToday || 0),
        0
      );
      const todayCost = todayKwh * priceNow;
      const level = currentBudgetLevel(todayCost / budgetDaily);

      if (level !== "none" && level !== lastLevelRef.current) {
        const label =
          level === "100"
            ? "Budget reached"
            : level === "90"
            ? "Budget 90%"
            : "Budget 75%";
        const description =
          level === "100"
            ? `Today's usage ~${todayCost.toFixed(2)} over daily budget`
            : `Today's usage ~${todayCost.toFixed(2)}`;
        toast({ title: label, description });
        lastLevelRef.current = level;
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, [
    devices,
    tariff,
    monthlyBudget,
    touEnabled,
    touPeakPrice,
    touOffpeakPrice,
    touOffpeakStart,
    touOffpeakEnd,
  ]);
}
