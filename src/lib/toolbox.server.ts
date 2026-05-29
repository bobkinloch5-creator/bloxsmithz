// Free Roblox asset browse/search via public catalog API.
// Server-only: avoids browser CORS.

const CATALOG = "https://catalog.roblox.com/v1/search/items/details";
const THUMBS = "https://thumbnails.roblox.com/v1/assets";

// Roblox catalog "Category" values
// 11 = Decals, 12 = Models, 13 = Plugins, 14 = Audio, 39 = Meshes
export type ToolboxCategory = "Models" | "Decals" | "Audio" | "Plugins" | "Meshes";

const CATEGORY_MAP: Record<ToolboxCategory, number> = {
  Models: 12,
  Decals: 11,
  Audio: 14,
  Plugins: 13,
  Meshes: 39,
};

export type ToolboxAsset = {
  id: number;
  name: string;
  creator: string;
  assetType: string;
  price: number;
  thumbnail: string | null;
  url: string;
};

export type ToolboxPage = {
  results: ToolboxAsset[];
  cursor: string | null;
};

async function fetchThumbnails(ids: number[]): Promise<Record<number, string>> {
  if (!ids.length) return {};
  try {
    // 420x420 gives crisp images like the official catalog grid
    const url = `${THUMBS}?assetIds=${ids.join(",")}&size=420x420&format=Png&isCircular=false`;
    const res = await fetch(url, { headers: { "User-Agent": "BloxSmith/1.0" } });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      data?: Array<{ targetId: number; imageUrl: string | null; state: string }>;
    };
    const map: Record<number, string> = {};
    for (const t of json.data ?? []) {
      if (t.imageUrl && t.state === "Completed") map[t.targetId] = t.imageUrl;
    }
    return map;
  } catch {
    return {};
  }
}

export type SortType = "Relevance" | "MostFavorited" | "Bestselling" | "RecentlyUpdated";
const SORT_MAP: Record<SortType, string> = {
  Relevance: "3",
  MostFavorited: "1",
  Bestselling: "2",
  RecentlyUpdated: "5",
};

export async function searchToolbox(opts: {
  keyword?: string;
  category?: ToolboxCategory;
  limit?: number;
  cursor?: string;
  sort?: SortType;
}): Promise<ToolboxPage> {
  const category = opts.category ?? "Models";
  const cat = CATEGORY_MAP[category] ?? 12;
  const params = new URLSearchParams({
    Category: String(cat),
    Limit: String(Math.min(Math.max(opts.limit ?? 30, 1), 30)),
    SortType: SORT_MAP[opts.sort ?? (opts.keyword ? "Relevance" : "MostFavorited")],
    IncludeNotForSale: "false",
  });
  const kw = opts.keyword?.trim();
  if (kw) params.set("Keyword", kw);
  if (opts.cursor) params.set("Cursor", opts.cursor);

  const res = await fetch(`${CATALOG}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "BloxSmith/1.0" },
  });
  if (!res.ok) throw new Error(`Catalog search failed: ${res.status}`);

  const json = (await res.json()) as {
    data?: Array<{
      id: number;
      name: string;
      creatorName: string;
      assetType: number;
      itemType: string;
      price: number | null;
      priceStatus?: string;
    }>;
    nextPageCursor?: string | null;
  };
  const raw = (json.data ?? []).filter(
    (a) => (a.price ?? 0) === 0 || a.priceStatus === "Free",
  );
  const ids = raw.map((a) => a.id);
  const thumbs = await fetchThumbnails(ids);
  return {
    results: raw.map((a) => ({
      id: a.id,
      name: a.name,
      creator: a.creatorName,
      assetType: a.itemType ?? String(a.assetType),
      price: 0,
      thumbnail: thumbs[a.id] ?? null,
      url: `https://www.roblox.com/library/${a.id}`,
    })),
    cursor: json.nextPageCursor ?? null,
  };
}
