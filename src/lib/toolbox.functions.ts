import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchToolbox, type ToolboxCategory, type ToolboxAsset } from "@/lib/toolbox.server";

const CATEGORIES = ["Models", "Decals", "Audio", "Plugins", "Meshes"] as const;

export const searchToolboxFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        keyword: z.string().min(1).max(120),
        category: z.enum(CATEGORIES).optional(),
        limit: z.number().int().min(1).max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ results: ToolboxAsset[] }> => {
    try {
      const results = await searchToolbox(
        data.keyword,
        (data.category ?? "Models") as ToolboxCategory,
        data.limit ?? 24,
      );
      return { results };
    } catch (e: any) {
      console.error("toolbox search failed", e);
      return { results: [] };
    }
  });
