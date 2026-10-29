const wholeRupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const rupeesAndPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

/** Course prices are stored in paise; show "Free" for zero, whole rupees when exact, else two decimals. */
export function formatPrice(paise: number): string {
  if (paise === 0) return "Free";
  return (paise % 100 === 0 ? wholeRupees : rupeesAndPaise).format(paise / 100);
}
