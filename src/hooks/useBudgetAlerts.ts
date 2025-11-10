import { useEffect, useRef } from "react";
import type { Device } from "@/utils/energyContextTypes";
import { toast } from "@/hooks/use-toast";

type Args = {
  devices: Device[];
  tariff: number;
};

type BudgetLevel = "none" | "75" | "90" | "100";

function currentBudgetLevel(ratio: number): BudgetLevel {
  if (ratio >= 1) return "100";
  if (ratio >= 0.9) return "90";
  if (ratio >= 0.75) return "75";
  return "none";
}

export function useBudgetAlerts({ devices, tariff }: Args) {
  const lastLevelRef = useRef<BudgetLevel>("none");
  const lastDayRef = useRef<string>(new Date().toDateString());

  useEffect(() => {
    const timer = setInterval(() => {
      const today = new Date().toDateString();
      if (today !== lastDayRef.current) {
        lastDayRef.current = today;
        lastLevelRef.current = "none";
      }

      const budgetMonthly = Number(localStorage.getItem("monthlyBudget") || 0) || 0;
      if (!budgetMonthly) return;
      const budgetDaily = budgetMonthly / 30;

      const touEnabled = localStorage.getItem("touEnabled") === "true";
      const priceNow = (() => {
        if (!touEnabled) return tariff;
        const peak = Number(localStorage.getItem("touPeakPrice") || tariff) || tariff;
        const offPeak = Number(localStorage.getItem("touOffpeakPrice") || tariff) || tariff;
        const start = String(localStorage.getItem("touOffpeakStart") || "22:00");
        const end = String(localStorage.getItem("touOffpeakEnd") || "06:00");
        const toMinutes = (value: string) => {
          const [hh, mm] = value.split(":").map((x) => Number(x));
          return hh * 60 + (mm || 0);
        };
        const startMinutes = toMinutes(start);
        const endMinutes = toMinutes(end);
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const inOffPeak =
          startMinutes < endMinutes
            ? nowMinutes >= startMinutes && nowMinutes < endMinutes
            : nowMinutes >= startMinutes || nowMinutes < endMinutes;
        return inOffPeak ? offPeak : peak;
      })();

      const todayKwh = devices.reduce((sum, device) => sum + Number(device.kwhToday || 0), 0);
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
  }, [devices, tariff]);
}
