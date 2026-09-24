import type { LocationType } from "../../generated/prisma/enums"

export type { LocationType }

export const TYPE_LABELS: Record<LocationType, string> = {
  BUILDING: "Gedung",
  FLOOR: "Lantai",
  DEPARTMENT: "Instalasi/Departemen",
  ROOM: "Ruangan",
}

/** Jenis lokasi yang sah untuk langsung berada di bawah setiap jenis induk (docs/03-erd.md §3.4). */
export const CHILD_TYPES: Record<LocationType, readonly LocationType[]> = {
  BUILDING: ["FLOOR"],
  FLOOR: ["DEPARTMENT"],
  DEPARTMENT: ["ROOM"],
  ROOM: [],
}

/** Jenis induk yang disyaratkan untuk setiap jenis lokasi. */
export const PARENT_TYPES: Record<LocationType, LocationType | null> = {
  BUILDING: null,
  FLOOR: "BUILDING",
  DEPARTMENT: "FLOOR",
  ROOM: "DEPARTMENT",
}

/**
 * Awalan path yang menandai seluruh keturunan sebuah node.
 *
 * Konvensi path (docs/03-erd.md §3.4): kolom `path` menyimpan rantai id
 * leluhur (TANPA id sendiri), dipisah `/`. Node akar (Gedung) ber-path
 * kosong. Dengan awalan ini, kueri "seluruh aset di Instalasi Radiologi"
 * menjadi `location_id IN (WHERE path = :prefix OR path LIKE :prefix || '/%')`
 * tanpa rekursi.
 *
 * @example subtreePrefix("a1/a2", "a3") → "a1/a2/a3"
 * @example subtreePrefix("", "a1") → "a1"
 */
export function subtreePrefix(path: string, id: string): string {
  return path === "" ? id : `${path}/${id}`
}

/** Path untuk sebuah node baru di bawah `parent` (atau kosong bila akar). */
export function childPath(parent: { path: string; id: string } | null): string {
  return parent ? subtreePrefix(parent.path, parent.id) : ""
}

/**
 * Aturan konsistensi induk—jenis. Mengembalikan pesan galat berbahasa
 * Indonesia, atau null bila sah.

 * @param childType  jenis lokasi yang diuji
 * @param parentType  jenis lokasi induk (null untuk akar)
 */
export function assertParentType(
  childType: LocationType,
  parentType: LocationType | null,
): string | null {
  if (parentType === null) {
    return childType === "BUILDING"
      ? null
      : "Lokasi tanpa induk hanya boleh bertipe Gedung (BUILDING.)."
  }
  if (!CHILD_TYPES[parentType].includes(childType)) {
    return `Lokasi bertipe ${TYPE_LABELS[childType]} tidak dapat berada langsung di bawah ${TYPE_LABELS[parentType]}.`
  }
  return null
}
