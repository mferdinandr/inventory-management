import ExcelJS from "exceljs";

const HEADER = [
  "Column 1",
  "NAMA ITEM",
  "MEREK",
  "KONDISI",
  "JUMLAH",
  "Status",
  "Catatan",
  "TANGGAL VERIVIKASI",
];

const INSTRUCTIONS = [
  ["Cara mengisi"],
  [
    'Isi sheet "SET" mulai dari baris 2. Satu sheet boleh berisi banyak set; tambah sheet lain bila perlu.',
  ],
  [
    'Column 1 (atau "ID item"): nama set/barang, mis. MINOR 1. Baris dengan nilai yang sama menjadi satu barang perlu sterilisasi.',
  ],
  ["NAMA ITEM: nama isi (wajib, tidak boleh ganda dalam satu set)."],
  ["MEREK, Catatan: opsional."],
  ["JUMLAH: bilangan bulat; kosong dihitung 1."],
  ['KONDISI: bila memuat kata "rusak", seluruh jumlah dihitung rusak.'],
  ["Status dan TANGGAL VERIVIKASI tidak diimpor."],
  [
    "Sheet tanpa kolom NAMA ITEM (termasuk sheet ini) dilewati. Contoh: MINOR 1 | DOEK KLEM | AESCULAP | BAIK | 6",
  ],
];

/** An empty import workbook: one header-only sheet plus instructions (skipped on import). */
export async function buildImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("SET");
  const header = sheet.addRow(HEADER);
  header.font = { bold: true };
  sheet.columns = [18, 40, 18, 12, 10, 12, 30, 20].map((width) => ({ width }));
  const help = wb.addWorksheet("PETUNJUK");
  help.addRows(INSTRUCTIONS);
  help.getRow(1).font = { bold: true };
  help.getColumn(1).width = 120;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
