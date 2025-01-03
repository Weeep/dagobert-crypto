export const formatDate = (epoch: number): string => {
  const date = new Date(epoch);
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric", //2-digit", //numeric
    month: "short",
    day: "2-digit",
    /*hour: "2-digit",
    minute: "2-digit",*/
    hour12: false, // Use 24-hour format
  }).format(date);
};

export function stringToRoundedFloat(
  strNum: any,
  fixedTo: number = 0,
  multiplier: number = 1
) {
  const num = parseFloat(strNum as unknown as string);
  let fixed = fixedTo;
  if (fixed == 0) {
    fixed = 3;
    if (num <= 1) fixed = 4;
    if (num <= 0.0001) fixed = 8;

    if (num >= 10) fixed = 2;
    if (num >= 100) fixed = 2; //1
    if (num >= 1000) fixed = 2; //0
    if (num >= 10000) fixed = 0;
  }

  return parseFloat((num * multiplier).toFixed(fixed));
}

export function getTargetPrices(initialNumber: number, targets: number[]) {
  return targets.map((target) => {
    return stringToRoundedFloat(
      parseFloat(((initialNumber * (100 + target)) / 100) as unknown as string)
    );
  });
}

export function getPrice(cummulativeQuoteQty: string, executedQty: string) {
  return (executedQty as unknown as number) != 0
    ? (cummulativeQuoteQty as unknown as number) /
        (executedQty as unknown as number)
    : 0;
}
