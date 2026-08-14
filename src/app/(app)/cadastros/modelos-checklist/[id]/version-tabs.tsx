"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VersionEditor } from "./version-editor";
import type { FaultCategory } from "@/generated/prisma/client";

type QuestionWithRules = {
  id: string;
  order: number;
  title: string;
  type: string;
  required: boolean;
  rules: {
    isCritical: boolean;
    createsNonconformity: boolean;
    blocksEquipment: boolean;
    triggerValue: string;
  }[];
};

type VersionData = {
  id: string;
  versionNumber: number;
  status: string;
  periodicity: string;
  questions: QuestionWithRules[];
};

export function VersionTabs({
  templateId,
  versions,
  faultCategories,
}: {
  templateId: string;
  versions: VersionData[];
  faultCategories: FaultCategory[];
}) {
  if (versions.length === 0) return null;

  return (
    <Tabs defaultValue={versions[0].id}>
      <TabsList>
        {versions.map((v) => (
          <TabsTrigger key={v.id} value={v.id}>
            Versão {v.versionNumber}
          </TabsTrigger>
        ))}
      </TabsList>
      {versions.map((v) => (
        <TabsContent key={v.id} value={v.id}>
          <VersionEditor templateId={templateId} version={v} faultCategories={faultCategories} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
