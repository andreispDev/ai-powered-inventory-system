import type { Metadata } from "next";

// The same page as an inventory item. It hides everything about stock for records.
export { default } from "../../inventory/[itemId]/page";

export const metadata: Metadata = { title: "Record" };
