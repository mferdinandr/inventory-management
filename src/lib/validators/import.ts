export const IMPORT_TEMPLATE_COLUMNS = [
  { header: "Nama Aset", key: "name" },
  { header: "Kategori", key: "category" },
  { header: "Ruangan", key: "room" },
  { header: "Kondisi (GOOD/MINOR_ISSUE/NEEDS_REPAIR/UNUSABLE)", key: "condition" },
  { header: "Tanggal Perolehan (YYYY-MM-DD)", key: "acquisitionDate" },
  { header: "Merek", key: "brand" },
  { header: "Model", key: "model" },
  { header: "Nomor Seri", key: "serialNumber" },
  { header: "Tahun Pembuatan", key: "yearManufactured" },
  { header: "Sumber Dana (APBD/APBN/BLUD/HIBAH/KSO/LAINNYA)", key: "fundingSource" },
  { header: "Nilai Perolehan", key: "acquisitionCost" },
  { header: "Nomor Dokumen Perolehan", key: "acquisitionDocumentNo" },
  { header: "Garansi Berakhir (YYYY-MM-DD)", key: "warrantyUntil" },
  { header: "Umur Ekonomis (Tahun)", key: "economicLifeYears" },
  { header: "Catatan", key: "notes" },
] as const

export type ImportRawRow = Record<string, string>

export type ImportRowError = { row: number; message: string }
