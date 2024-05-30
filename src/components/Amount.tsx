import { EURO } from "@/src/lib/utils";

export default function Amount({
  value,
  colored = true,
}: {
  value: string | number;
  colored?: boolean;
}) {
  const formatted = EURO(value).format();
  const isNegative = formatted.includes("-");
  const coloredAmount = () => (
    <>
      {isNegative ? (
        <span className="text-red-500">{formatted}</span>
      ) : (
        <span className="text-green-500">{formatted}</span>
      )}
    </>
  );
  return (
    <>
      {colored ? (
        coloredAmount()
      ) : (
        <span className="text-foreground">{formatted}</span>
      )}
    </>
  );
}
