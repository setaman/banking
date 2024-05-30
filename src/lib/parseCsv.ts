import Papa from "papaparse";

export const parseCsv = (file: string) => {
  // @ts-ignore
  const parsedData = Papa.parse(file).data as string[][];
  const headers = parsedData[0];
  // convert parse data to an array of objects with headers as keys
  return parsedData.slice(1).map((row) =>
    row.reduce((acc: Record<string, unknown>, val, i) => {
      acc[headers[i]] = val;
      return acc;
    }, {})
  );
};
