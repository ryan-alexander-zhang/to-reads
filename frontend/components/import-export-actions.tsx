"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { TransferPayload } from "@/lib/types";

export function ImportExportActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const importData = useMutation({
    mutationFn: api.importData,
    onError: () => {
      toast({ title: "Failed to import data" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds() });
      toast({ title: "Import completed" });
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `to-reads-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready" });
    } catch (error) {
      toast({ title: "Failed to export data" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<TransferPayload>;
      if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.feeds)) {
        throw new Error("Invalid import payload");
      }
      await importData.mutateAsync(parsed as TransferPayload);
    } catch (error) {
      toast({ title: "Failed to import data" });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImport}
      />
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => importInputRef.current?.click()}
        disabled={importData.isPending}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import
      </Button>
    </div>
  );
}
