import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { AppearanceSettings } from "@/modules/preferences/appearance-settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Settings" description="Choose how the app looks on this device." />
      <AppearanceSettings />
    </PageContainer>
  );
}
