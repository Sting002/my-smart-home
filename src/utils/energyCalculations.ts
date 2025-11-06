export const wattsToKilowatts = (watts: number): number => {
  return watts / 1000;
};

export const whToKwh = (wh: number): number => {
  return wh / 1000;
};

export const calculateCost = (kwh: number, tariff: number): number => {
  return kwh * tariff;
};

export const formatPower = (watts: number): string => {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`;
  }
  return `${watts.toFixed(0)} W`;
};

export const formatEnergy = (kwh: number): string => {
  if (kwh < 1) {
    return `${(kwh * 1000).toFixed(0)} Wh`;
  }
  return `${kwh.toFixed(2)} kWh`;
};

export const formatCost = (cost: number, currency: string): string => {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    KES: "KSh",
  };

  const symbol = symbols[currency] || currency;
  return `${symbol}${cost.toFixed(2)}`;
};

export const calculateDailyAverage = (readings: number[]): number => {
  if (readings.length === 0) return 0;
  const sum = readings.reduce((acc, val) => acc + val, 0);
  return sum / readings.length;
};

export const projectMonthlyCost = (dailyKwh: number, tariff: number): number => {
  return dailyKwh * 30 * tariff;
};

export const calculateEfficiency = (actualKwh: number, expectedKwh: number): number => {
  if (expectedKwh === 0) return 0;
  return ((expectedKwh - actualKwh) / expectedKwh) * 100;
};
