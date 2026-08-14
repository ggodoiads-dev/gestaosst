"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/label";
import type { Collaborator } from "@/generated/prisma/client";

export function ProductivityCollaboratorPicker({
  collaborators,
  selectedId,
}: {
  collaborators: Collaborator[];
  selectedId?: string;
}) {
  const router = useRouter();

  return (
    <div className="max-w-xs">
      <FormField label="Colaborador">
        <Select
          value={selectedId ?? "none"}
          onValueChange={(id) => router.push(id === "none" ? "/produtividade" : `/produtividade?collaboratorId=${id}`)}
        >
          <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Selecione um colaborador</SelectItem>
            {collaborators.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    </div>
  );
}
