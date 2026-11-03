type Node = { id: string; parentId: string | null };

/** This category and everything under it, so a parent's table includes its subcategories. */
export function withDescendants(rows: readonly Node[], id: string): string[] {
  const found = [id];
  for (let index = 0; index < found.length; index++) {
    for (const row of rows) if (row.parentId === found[index] && !found.includes(row.id)) found.push(row.id);
  }
  return found;
}

/** "Network / Monitors / Asus", for picking a table without opening each folder */
export function pathLabel(rows: readonly (Node & { name: string })[], id: string): string {
  const row = rows.find((other) => other.id === id);
  return [...ancestorsOf(rows, id), ...(row ? [row] : [])].map((part) => part.name).join(" / ");
}

/** From the top level down to this category's parent. */
export function ancestorsOf<T extends Node>(rows: readonly T[], id: string): T[] {
  const path: T[] = [];
  let current = rows.find((row) => row.id === id);
  while (current?.parentId && path.length < 10) {
    const parentId: string = current.parentId;
    current = rows.find((row) => row.id === parentId);
    if (current) path.unshift(current);
  }
  return path;
}
