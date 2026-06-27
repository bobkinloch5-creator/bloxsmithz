import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profile.functions";
import { getPluginSession } from "@/lib/chat.functions";
import { Download, Plug, CheckCircle2, CircleSlash, Clock, Server, RefreshCw } from "lucide-react";

const PLUGIN_VERSION = "2.1.0";

export const Route = createFileRoute("/_authenticated/plugin")({
  head: () => ({ meta: [{ title: `Studio Plugin v${PLUGIN_VERSION} — BloxSmith` }] }),
  component: PluginPage,
});

function timeAgo(iso?: string | null) {
  if (!iso) return "never";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function PluginPage() {
  const profileFn = useServerFn(getMyProfile);
  const sessionFn = useServerFn(getPluginSession);
  useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const { data: session } = useQuery({
    queryKey: ["plugin-session"],
    queryFn: () => sessionFn(),
    refetchInterval: 5000,
  });

  const online = !!session?.online && !!session?.last_seen
    && (Date.now() - new Date(session.last_seen).getTime()) < 30_000;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-bold">Roblox Studio Plugin <span className="text-sm text-muted-foreground font-normal">v{PLUGIN_VERSION}</span></h1>
          <p className="text-sm text-muted-foreground">One-click connect — no tokens, no copy-paste.</p>
        </div>
      </div>

      {/* Status */}
      <div className="glass mt-8 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {online ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Plugin Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-zinc-500/15 px-3 py-1 text-sm text-zinc-300">
                <CircleSlash className="h-4 w-4" /> Offline
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last seen {timeAgo(session?.last_seen)}</span>
            {session?.studio_version && (
              <span className="inline-flex items-center gap-1"><Server className="h-3.5 w-3.5" /> Studio {session.studio_version}</span>
            )}
          </div>
        </div>
        {session?.place_id && (
          <p className="mt-2 text-xs text-muted-foreground">Linked place: <span className="font-mono text-foreground">{session.place_id}</span></p>
        )}
        {!online && (
          <p className="mt-3 text-sm text-muted-foreground">
            Open the BloxSmith plugin in Roblox Studio and click <b>Connect</b>. A one-click approval link will bring you back here.
          </p>
        )}
      </div>

      {/* Download */}
      <div className="glass mt-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">1. Download the plugin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A single Luau file — BloxSmith Ultimate v{PLUGIN_VERSION}. One file, everything included.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/BloxSmithPlugin.lua"
            download="BloxSmithPlugin.lua"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Download BloxSmithPlugin.lua
          </a>
          <a
            href="/BloxSmithPlugin.lua"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            View source
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Already have an older version? Replace the old file with this one and reload plugins.
        </p>
      </div>

      {/* Install */}
      <div className="glass mt-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">2. Install in Studio</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          <li>Open Roblox Studio.</li>
          <li><span className="font-mono text-foreground">Plugins</span> tab → <span className="font-mono text-foreground">Plugins Folder</span> to open the folder.</li>
          <li>Drop <span className="font-mono text-foreground">BloxSmithPlugin.lua</span> directly into that folder (not a sub-folder). Default paths:
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              <li><span className="font-mono">Windows:</span> <span className="font-mono text-foreground">%LOCALAPPDATA%\Roblox\Plugins</span></li>
              <li><span className="font-mono">macOS:</span> <span className="font-mono text-foreground">~/Documents/Roblox/Plugins</span></li>
            </ul>
          </li>
          <li>Back in Studio: <span className="font-mono text-foreground">Plugins → Reload Plugins</span> (or restart Studio).</li>
          <li>A <span className="font-mono text-foreground">BloxSmith</span> button appears in the Plugins toolbar. Click it to open the panel.</li>
          <li>If prompted: tick <span className="font-mono text-foreground">Allow HTTP Requests</span> in Game Settings → Security. The plugin only ever talks to <span className="font-mono text-foreground">bloxsmith.pro</span>.</li>
        </ol>
      </div>

      {/* Connect */}
      <div className="glass mt-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">3. One-click connect</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          <li>Click the <span className="font-mono text-foreground">BloxSmith</span> button in the Plugins tab to open the panel.</li>
          <li>Click <span className="font-mono text-foreground">Connect</span>. The plugin requests a pairing code from bloxsmith.pro.</li>
          <li>A link appears in the plugin panel — copy it and open it in your browser (or it may open automatically).</li>
          <li>Sign in to BloxSmith if prompted, then click <b>Approve &amp; connect</b>.</li>
          <li>Switch back to Studio. The status pill turns <span className="text-emerald-400">Connected</span> within a few seconds.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          No tokens to copy or paste. Your plugin token is saved automatically and reconnects on the next Studio launch.
        </p>
      </div>

      {/* What it does */}
      <div className="glass mt-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">What the plugin does</h2>
        <p className="mt-1 text-sm text-muted-foreground">It's the execution bridge — the AI plans, the plugin builds.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Folders, Scripts, LocalScripts, ModuleScripts</li>
          <li>ScreenGuis, Frames, Buttons, Labels, Images</li>
          <li>RemoteEvents, RemoteFunctions, BindableEvents</li>
          <li>Parts, Models, Tools, Sounds, Teams</li>
          <li>leaderstats injector (Cash, XP, etc.)</li>
          <li>Toolbox asset import via real asset IDs</li>
          <li>Rename, move, set properties, safe delete</li>
          <li>Routes everything into the correct Roblox service</li>
        </ul>
      </div>

      {/* Plugin controls reference */}
      <div className="glass mt-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Plugin controls</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground list-disc pl-5">
          <li><b className="text-foreground">Connect / Disconnect</b> — start pairing or end the session</li>
          <li><b className="text-foreground">Reconnect</b> — re-use saved token without re-pairing</li>
          <li><b className="text-foreground">Sync Now</b> — pull pending actions + re-scan instantly</li>
          <li><b className="text-foreground">Scan Project</b> — upload a fresh workspace snapshot</li>
          <li><b className="text-foreground">Clear Queue</b> — drop stuck pending/sent actions safely</li>
          <li><b className="text-foreground">Organize</b> — auto-sort loose Workspace objects into folders</li>
          <li><b className="text-foreground">Auto-Fix</b> — organize + anchor unanchored parts</li>
          <li><b className="text-foreground">Pause / Resume</b> — stop pulling new actions temporarily</li>
          <li><b className="text-foreground">Preview Mode</b> — review every action before it runs</li>
          <li><b className="text-foreground">Verbose / Copy log</b> — debug or share logs in Discord</li>
        </ul>
      </div>

      {/* Troubleshooting */}
      <div className="glass mt-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Troubleshooting</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li><b className="text-foreground">Button missing in Studio?</b> File must end in <span className="font-mono">.lua</span> and sit directly in the Plugins folder. Then Reload Plugins.</li>
          <li><b className="text-foreground">"Allow HTTP Requests" prompt?</b> Approve it — the plugin only talks to BloxSmith.</li>
          <li><b className="text-foreground">Approval link asks me to sign in?</b> Sign in to BloxSmith first, then click Connect again in the plugin.</li>
          <li><b className="text-foreground">Queue stuck?</b> Click <span className="font-mono">Clear Queue</span> in the plugin and ask the AI to retry.</li>
          <li><b className="text-foreground">Toolbox asset failed?</b> The asset may be private or removed. Pick another and try again.</li>
          <li><b className="text-foreground">Still stuck?</b> Tap <span className="font-mono">Verbose</span>, then <span className="font-mono">Copy log</span>, and share in the <a className="text-primary underline" href="https://discord.gg/6QDYT3RUkv" target="_blank" rel="noreferrer">Discord</a>.</li>
        </ul>
      </div>
    </div>
  );
}
