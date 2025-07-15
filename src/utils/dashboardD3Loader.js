import * as XLSX from 'xlsx';

export default async function loadExcelData(source = '/emissions.xlsx') {
  let arrayBuffer;
  if (typeof source === 'string') {
    const resp = await fetch(source);
    if (!resp.ok) throw new Error(`Failed to fetch ${source}`);
    arrayBuffer = await resp.arrayBuffer();
  } else {
    arrayBuffer = await source.arrayBuffer();
  }

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheet1 = XLSX.utils.sheet_to_json(
    workbook.Sheets[workbook.SheetNames[0]]
  );
  const emissionsByFuel = sheet1.reduce((acc, row) => {
    acc[row.Fuel] = (acc[row.Fuel] || 0) + row.CO2_Gt;
    return acc;
  }, {});

  const phaseoutYears = [];
  workbook.SheetNames.slice(2, 7).forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    rows.forEach((row) => {
      phaseoutYears.push({
        country: row.Country,
        fuel: row.Fuel,
        phaseoutYear: row.PhaseoutYr,
      });
    });
  });

  return { emissionsByFuel, phaseoutYears };
}
