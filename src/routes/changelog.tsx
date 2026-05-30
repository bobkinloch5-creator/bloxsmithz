import { createFileRoute, Link } from "@tanstack/react-router";
import { Header, Footer } from "@/components/layout";
import {
  Award,
  Bot,
  CheckCircle,
  CreditCard,
  FileCode,
  Flag,
  Gift,
  Globe2,
  Image as ImageIcon,
  Languages,
  Library,
  LayoutDashboard,
  Link2Off,
  Menu,
  MessageSquare,
  Palette,
  Play,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

const tagStyles = {
  ai: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  tools: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  backend: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  security: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  plugin: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ui: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  integrations: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const changelogItems = [
  {
    version: "v3.4.0",
    date: "May 30, 2026",
    title: "UI Generator Reliability, Builder Polish & Fancy Output",
    description:
      "The Roblox UI Generator is faster, more reliable, and much better-looking. Generations now fall back to complete Roblox ScreenGui specs instead of empty output, the page has a cleaner builder workspace, and generated templates now use more premium panels, gradients, badges, strokes, and buttons.",
    updates: [
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Zap,
        title: "No More Empty UI Output",
        detail:
          "Fixed the generator path that could sit on loading and then show \"No output generated.\" Slow or empty AI responses now fall back to a complete deterministic ScreenGui so users still get a usable Roblox UI.",
      },
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Faster UI Generation",
        detail:
          "Replaced long 90-second AI waits with a short timeout and reduced the loading animation timing, so the generator responds faster and fails over cleanly instead of feeling stuck.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: LayoutDashboard,
        title: "Cleaner Generator Workspace",
        detail:
          "The /ui-generator page now has a compact builder header, generation stats, cleaner template tiles, stronger style controls, a better preview toolbar, and a grid-backed device preview frame.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Fancier Generated Roblox UIs",
        detail:
          "Generated fallback templates now look more premium with layered panels, header glow, status badges, gradients, stronger action buttons, thicker strokes, and clearer hierarchy.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Library,
        title: "Manual Save to UI Library",
        detail:
          "Generated previews now have a visible Save to Library action, so users can keep a generated UI even if the automatic save path did not return a saved generation id.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Palette,
        title: "Spin Wheel Template Upgrade",
        detail:
          "Spin Wheel output now renders as a more circular layered wheel with glow, reward badges, pointer marker, prize panel, upgraded spin button, RemoteEvent, LocalScript, and ServerScript.",
      },
    ],
  },
  {
    version: "v3.3.0",
    date: "May 30, 2026",
    title: "Achievements, Perks, Gallery & Community Polish",
    description:
      "Big community update: a full achievements & leveling system with free credits for chatting, a clean image-only Gallery, follow/report on every profile, server-side link blocking, a custom bot avatar, automatic 7-day chat retention, and a mobile-friendly pass across the app.",
    updates: [
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Award,
        title: "Achievements, Badges & Levels",
        detail:
          "New /achievements page with an XP bar, your current level, and badges across Chat, Level, Gallery, and Social categories. Unlocking a badge instantly drops bonus credits + XP into your account.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Gift,
        title: "+2 Free Credits Every 10 Messages",
        detail:
          "Stay active in Community Chat and BloxSmith automatically tops your balance: every 10 messages you send = +2 credits, tracked server-side and logged in your credit history. Mentioned on the dashboard and the achievements page.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: ImageIcon,
        title: "Image-Only Gallery",
        detail:
          "New /gallery feed for sharing Roblox screenshots. Image-only uploads up to 6 MB, caption moderation, likes, and one-click follow on the creator's profile. Clean by default — no links, no NSFW.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Users,
        title: "Follow & Profile Actions",
        detail:
          "Click any name in chat or gallery to open the profile popover with live follower count, Follow / Unfollow, and friend / DM shortcuts.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: Flag,
        title: "Report System",
        detail:
          "Every profile and gallery post can be reported with a reason. Reports queue into the admin moderation panel alongside chat reports.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: Link2Off,
        title: "Link Blocker in Chat",
        detail:
          "Server-side regex blocks http(s)://, www., common TLDs (.com / .gg / .net …) and Discord invites in every channel. A friendly \"Links aren't allowed\" toast replaces the silent failure.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: MessageSquare,
        title: "Channels: Announcements, Help & More",
        detail:
          "Community Chat now has multiple channels (General, Announcements, Help, Showcase, Off-topic) with per-role posting rules and a slim channel sidebar.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Bot,
        title: "BloxBot Got a Face",
        detail:
          "The in-chat assistant now shows a custom BloxBot avatar with a primary-color ring instead of the generic robot icon.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: Trash2,
        title: "7-Day Chat Retention",
        detail:
          "A scheduled job runs hourly to purge global chat messages, reactions, and project chat older than 7 days, keeping the database lean and conversations fresh.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Smartphone,
        title: "Mobile Polish",
        detail:
          "Browse header, stat cards, chat composer and gallery grids all reflow cleanly at 390-430 px. No more overflowing numbers or clipped titles on phones.",
      },
    ],
  },
  {
    version: "v3.2.0",
    date: "May 30, 2026",
    title: "Global Chat 2.0 — Customization, Reactions & Moderation",
    description:
      "A major Global Chat upgrade: per-user preferences, emoji reactions, @mentions with autocomplete, replies, image uploads, markdown, online/typing indicators, pinned messages, and a full moderation suite with reports, blocked words, AI auto-mod, warnings, and an audit log.",
    updates: [
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Fully Customizable Chat",
        detail:
          "New settings panel (gear icon) lets every user pick their font size, density (compact/cozy/comfy), sound on/off, notification mode (off / mentions / all), and a personal accent color. Name color, message gradient, and chat icon are still set from your profile.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Reactions, Replies, Mentions & Markdown",
        detail:
          "Hover any message to react with emoji, reply/quote it, or open the action menu. Type @ to autocomplete people you've seen in chat; mentioning you triggers a ping. Messages support **bold**, *italic*, `code`, and auto-linked URLs.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "Images, Presence & Typing",
        detail:
          "Upload images up to 5 MB straight into chat. See who's online via the Users chip in the header, and watch a live \"typing…\" indicator when others are mid-message. Pinned messages (admin only) sit at the top of the conversation.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Full Moderation Suite",
        detail:
          "Anyone can report a message (admins get a queue). Admins now have a Shield panel with three tabs: Reports, Blocked Words (live profanity list with severity), and an Audit log of every mute, unmute, delete, pin, and warning. New per-message actions: pin, warn, delete, mute (5m/1h/permanent), unmute.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "AI Auto-Moderation & Anti-Spam",
        detail:
          "Every message is screened by an AI moderator (Lovable AI gateway) for slurs, threats, and harassment, plus a server-side duplicate-message check, ALL-CAPS detection, and the admin-managed blocked words list. Slow mode and rate limits still apply.",
      },
    ],
  },
  {
    version: "v3.1.1",
    date: "May 30, 2026",
    title: "Auth Stability & Console Noise Cleanup",
    description:
      "Stops the 401 spam from /auth/v1/user when you're logged out or your session has expired, rotates the AI gateway key behind Sign in with Google to fix the \"Invalid API key\" toast, and keeps audio gesture-gated so Chrome doesn't warn about AudioContext.",
    updates: [
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Clean Session Handling",
        detail:
          "On load we now validate the cached session with the Auth server. If the token is expired, revoked, or the account was removed, we sign you out cleanly instead of letting protected requests 401 in a loop. Logged-out visitors no longer trigger /auth/v1/user calls at all.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: ShieldCheck,
        title: "Google Sign-In API Key Refreshed",
        detail:
          "Rotated the Lovable AI gateway key powering the Google OAuth broker so the \"Invalid API key\" toast that appeared for some users when clicking Sign in with Google is resolved.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Audio Stays Quiet Until You Interact",
        detail:
          "Confirmed sound effects only initialize after a real user gesture (click/tap/key), so Chrome's \"AudioContext was not allowed to start\" warning no longer appears on first load.",
      },
    ],
  },
  {
    version: "v3.1.0",
    date: "May 30, 2026",
    title: "Community Lockdown, Chat Customization & Real UI Previews",
    description:
      "Community and browse areas are now members-only, with proper redirects and a clean login gate. Chat got gradient names, message colors, and preset icons. The UI Generator now renders real AI image previews. Plus a sweep of bug fixes across auth, themes, AI Help, payments, and the Roblox plugin pipeline.",
    updates: [
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Browse & Community Pages Now Require Login",
        detail:
          "Showcase, Showcase detail, Templates, Ideas, Project editor, and Clothing Studio all now require an account. Logged-out visitors see a clean \"Please log in to view and interact with community content\" gate and are redirected to /login with a return path so they land back where they were after signing in. Private projects stay private — only published showcase entries appear in browse, backed by RLS on the database.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Interaction Guardrails",
        detail:
          "Likes, comments, follows, friends, messages, remixing, and publishing are all gated behind authentication on both the UI and the backend. RLS policies remain the source of truth so the data is protected even if the UI is bypassed.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Chat Name & Message Customization",
        detail:
          "Personalize how you appear in Global Chat: choose a solid color or up to a 4-stop gradient for your name and message text, and pick from a curated set of clean preset icons (Sparkles, Crown, Rocket, and more). Live preview in Account → Chat Style.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Real Image Previews in UI Generator",
        detail:
          "The UI Generator now renders a real AI image preview alongside the Luau code, streaming partial images as it generates so you can see the design come together. Regenerate any time from the Image tab.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "AI Help & Global Chat Visibility Fixes",
        detail:
          "Fixed layout issues that hid the AI Help launcher and Global Chat on certain pages. Both now appear consistently across the app once signed in.",
      },
      {
        category: "Backend",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Payments & Manual Verification Improvements",
        detail:
          "Cleaner approval/rejection flow for manual PayPal verification, with credits granted atomically and tracked in the credit ledger.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Auth & OAuth Polish",
        detail:
          "Hardened Google sign-in via the Lovable broker, fixed the OAuth callback route, and tightened login redirect handling so deep links survive a sign-in round trip.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Theme Consistency Sweep",
        detail:
          "Resolved theme inconsistencies on browse, account, and tool pages — every surface now uses the design tokens in both light and dark mode.",
      },
      {
        category: "Plugin",
        tagColor: tagStyles.plugin,
        icon: FileCode,
        title: "Roblox Plugin Insertion Fixes",
        detail:
          "Hardened the Bloxsmith Studio plugin pipeline so UI Generator output and template scripts insert reliably into the active place.",
      },
    ],
  },
  {

    version: "v3.0.0",
    date: "May 29, 2026",
    title: "Toolbox Overhaul, Stay-Signed-In & UI Generator",
    description:
      "A big release focused on the Roblox creator workflow: a rebuilt free-asset Toolbox that pulls real Studio models, a brand-new AI Roblox UI/GUI Generator, smarter session handling with a stay-signed-in option, and account privacy controls.",
    updates: [
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Roblox UI / GUI Generator",
        detail:
          "A new /ui-generator page generates full ScreenGuis (gamepass shops, dev product shops, main menus, loading screens, inventories, trading, daily rewards, codes, leaderboards, HUDs and more) with a live desktop + mobile preview, editable Luau code, and one-click insert into Roblox Studio via the Bloxsmith plugin.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Wrench,
        title: "Toolbox Rebuilt on Real Creator Store Data",
        detail:
          "Free Models now pull directly from the live Roblox Creator Store catalog (not avatar gear), so searches actually return Studio-usable assets. Decals, Audio, Plugins and Meshes use the modern catalog endpoint, every result shows a hi-res thumbnail, and pagination/sort/categories all work end-to-end. Each card links straight to create.roblox.com/store/asset/<id>.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Stay Signed In + 30-Minute Idle Auto-Logout",
        detail:
          "Login now has a Stay signed in toggle. When on, sessions persist across browser restarts. When off, you're automatically signed out after 30 minutes of real inactivity for safety on shared devices.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Hide My Email Privacy Toggle",
        detail:
          "A new account setting masks your email address in the profile UI (showing only the first letter and domain) so screenshots and screen-shares don't leak it.",
      },
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Credit-Aware Model Picker",
        detail:
          "The AI model picker now shows a per-message credit cost for every model and a short description of what it's best at in Roblox workflows, so you can pick cheaper models for routine tweaks and premium ones for hard scripts.",
      },
      {
        category: "UI",
        tagColor: tagStyles.ui,
        icon: Menu,
        title: "Draggable Help Chat",
        detail:
          "The floating AI help chat can now be dragged anywhere on screen and remembers its position.",
      },
    ],
  },
  {
    version: "v2.9.0",
    date: "May 28, 2026",
    title: "Image & Clothing Generator Overhaul",
    description:
      "A focused update fixing and polishing the creative tools: faster, more reliable image and clothing generation on Gemini, correct credit handling, a 3D clothing preview, and better downloads.",
    updates: [
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Palette,
        title: "Clothing Generator Repaired",
        detail:
          "The clothing studio now generates upload-ready Roblox shirt, pants, T-shirt, and accessory textures reliably through the Gemini image pipeline, with clearer upload guidance for each garment type.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Sparkles,
        title: "Image Generator on Gemini",
        detail:
          "The AI image generator now runs entirely on Gemini image models with a single key, defaults to the newest fast model, and adds one-tap Roblox asset presets for thumbnails, game icons, HUD/UI graphics, textures, gamepass banners, and decals.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: Wrench,
        title: "3D Clothing Preview",
        detail:
          "Generated clothing can now be previewed in an interactive 3D view that wraps the texture onto a rotating avatar, alongside the flat texture view, so you can sanity-check colors and placement before uploading.",
      },
      {
        category: "Credits",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Credits Only Charged on Success",
        detail:
          "Clothing and image generations now charge credits only when a generation succeeds. Failed or timed-out generations are automatically refunded, so a failure never costs you credits.",
      },
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Faster, No More Hanging Generations",
        detail:
          "Image requests now have a hard timeout, so a slow or stuck request fails cleanly with a retry message instead of leaving you on an endless spinner. Loading states show real step-by-step progress.",
      },
      {
        category: "Tools",
        tagColor: tagStyles.tools,
        icon: CheckCircle,
        title: "Reliable Downloads",
        detail:
          "Download buttons for generated clothing and images now save the file directly instead of occasionally opening it in a new tab.",
      },
    ],
  },
  {
    version: "v2.8.0",
    date: "May 28, 2026",
    title: "Roblox AI Brain, Mobile Navigation & Stability Upgrade",
    description:
      "A major reliability and AI-quality update focused on making BloxSmith better at building real Roblox games, easier to use on mobile, and safer across important pages.",
    updates: [
      {
        category: "AI Brain",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Roblox Docs Knowledge Mandate",
        detail:
          "Expanded the AI guidance so BloxSmith acts like it knows Roblox Creator Hub, Luau, Engine APIs, DataStores, MarketplaceService, TeleportService, PathfindingService, UI, animation, physics, lighting, terrain, plugins, and secure multiplayer patterns.",
      },
      {
        category: "Game Types",
        tagColor: tagStyles.ai,
        icon: Sparkles,
        title: "Any Roblox Game Type Support",
        detail:
          "Added stronger instructions for tycoons, FPS games, RPGs, simulators, obbies, horror, racing, tower defense, fighting, pet games, roleplay, city games, dungeons, quests, shops, inventories, crafting, vehicles, pets, teams, rounds, and more.",
      },
      {
        category: "Real Assets",
        tagColor: tagStyles.tools,
        icon: Play,
        title: "Real Studio Builds Over Tiny Demos",
        detail:
          "BloxSmith is now guided to build playable vertical slices with real maps/assets, UI, sounds, scripts, RemoteEvents, folders, saving when needed, and Studio edit-mode visibility instead of tiny placeholder builds.",
      },
      {
        category: "Mobile",
        tagColor: tagStyles.ui,
        icon: Menu,
        title: "Hamburger Menu Removed on Mobile",
        detail:
          "Replaced the mobile hamburger menu with a mobile-only horizontal scroll navbar so users can quickly access Home, Build, Plugin, Credits, Templates, Docs, Ideas, MCP, FAQ, 3D, and Discord.",
      },
      {
        category: "Themes",
        tagColor: tagStyles.ui,
        icon: Palette,
        title: "Better Mobile Theme Switcher",
        detail:
          "Theme switching now opens a phone-friendly panel with bigger tap targets, a close button, overlay, scroll lock, and cleaner mobile spacing while keeping desktop controls working normally.",
      },
      {
        category: "Languages",
        tagColor: tagStyles.ui,
        icon: Languages,
        title: "Better Mobile Language Switcher",
        detail:
          "Language switching now opens a mobile-friendly panel with popular languages first, more languages below, bigger tap targets, a close button, overlay, and page scroll lock while choosing a language.",
      },
      {
        category: "Help Chat",
        tagColor: tagStyles.backend,
        icon: Globe2,
        title: "Desktop Help Chat Reliability",
        detail:
          "Improved the public help chat route with model fallbacks, Groq fallback support, safe local answers, timeouts, rate limiting, and better help for plugin setup, credits, MCP, docs, and BloxSmith info.",
      },
      {
        category: "Admin",
        tagColor: tagStyles.backend,
        icon: LayoutDashboard,
        title: "Safer Admin Page",
        detail:
          "Rebuilt the admin page into a safer overview with login/admin messages, safe counts for users/projects/generations/pending payments, recent users, mobile-friendly scrolling tables, and fewer crash points.",
      },
      {
        category: "Stability",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Emergency Assistant Route Recovery",
        detail:
          "Restored the assistant execute route with safe JSON responses and fallback Studio actions so broken AI gateway calls do not crash pages or project sync flows.",
      },
    ],
  },
  {
    version: "v2.7.0",
    date: "May 28, 2026",
    title: "Premium Homepage, Mobile UX & Creator Conversion Upgrade",
    description:
      "A major homepage and mobile-friendly update focused on making BloxSmith easier to understand, more trustworthy for Roblox creators, and stronger at converting visitors into builders.",
    updates: [
      {
        category: "Homepage",
        tagColor: tagStyles.ui,
        icon: Sparkles,
        title: "What BloxSmith Can Make",
        detail:
          "Added clear sections for maps, Luau scripts, game systems, GUIs, VFX, sounds, toolbox assets, NPCs, thumbnails, icons, decals, and Roblox-ready game art.",
      },
      {
        category: "Prompts",
        tagColor: tagStyles.ai,
        icon: Bot,
        title: "Example Prompt Section",
        detail:
          "Added example prompts for tycoons, simulators, obbies, horror systems, racing lobbies, shop GUIs, and other Roblox builds so users know what to ask.",
      },
      {
        category: "Plugin",
        tagColor: tagStyles.plugin,
        icon: Play,
        title: "Roblox Studio Plugin Preview",
        detail:
          "Added plugin preview content explaining account connection, Studio sync, correct service placement, project scans, error fixing, and toolbox asset insertion.",
      },
      {
        category: "Credits",
        tagColor: tagStyles.backend,
        icon: CreditCard,
        title: "Clearer Credit Info",
        detail:
          "Added clearer credit copy explaining starter credits, daily credits, pay-as-you-go packs, and what credits are used for.",
      },
      {
        category: "Mobile",
        tagColor: tagStyles.ui,
        icon: Smartphone,
        title: "Homepage Mobile Improvements",
        detail:
          "Improved mobile hero sizing, button layout, comparison table scrolling, help chat sizing, and phone-friendly navigation spacing.",
      },
    ],
  },
  {
    version: "v2.6.0",
    date: "May 28, 2026",
    title: "Security, Speed & AI Gateway Upgrade",
    description:
      "A stability and safety release for the website, AI chat, model gateway, plugin organizer, and image generation workflow.",
    updates: [
      {
        category: "Performance",
        tagColor: tagStyles.backend,
        icon: Zap,
        title: "Smoother AI Chat Performance",
        detail:
          "Assistant messages were optimized so long chats re-render less and project pages feel smoother.",
      },
      {
        category: "Security",
        tagColor: tagStyles.security,
        icon: ShieldCheck,
        title: "Safer Provider Keys",
        detail:
          "Server AI providers and model tests now rely on environment variables instead of embedded fallback keys.",
      },
      {
        category: "AI Gateway",
        tagColor: tagStyles.integrations,
        icon: Server,
        title: "Cleaner Provider Routing",
        detail:
          "Improved routing and fallback behavior for Groq, Neokens, Gemini, OpenAI-compatible, and Claude-style providers.",
      },
    ],
  },
  {
    version: "v2.5.0",
    date: "May 27, 2026",
    title: "Full Roblox Creation Assistant",
    description:
      "BloxSmith AI evolved from a script generator into a complete Roblox build assistant for maps, GUIs, tools, VFX, systems, and Studio placement.",
    updates: [
      {
        category: "AI",
        tagColor: tagStyles.ai,
        icon: Wrench,
        title: "Build Modes Added",
        detail:
          "Added stronger generation support for animations, VFX, game systems, procedural builds, toolbox finding, and finish-my-game workflows.",
      },
      {
        category: "Placement",
        tagColor: tagStyles.backend,
        icon: FileCode,
        title: "Correct Studio Service Placement",
        detail:
          "Generated items are guided toward Workspace, ServerScriptService, ReplicatedStorage, StarterGui, StarterPack, Lighting, SoundService, Teams, and clean folders.",
      },
    ],
  },
];

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
  head: () => ({
    meta: [
      { title: "Changelog — BloxSmith" },
      {
        name: "description",
        content:
          "Stay updated with the latest BloxSmith releases, AI upgrades, plugin changes, security fixes, mobile improvements, and Roblox builder updates.",
      },
      { property: "og:title", content: "Changelog — BloxSmith" },
      {
        property: "og:description",
        content: "Latest BloxSmith releases, features, security updates, and fixes.",
      },
      { property: "og:url", content: "https://bloxsmith.pro/changelog" },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/changelog" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "BloxSmith Changelog",
          url: "https://bloxsmith.pro/changelog",
          blogPost: changelogItems.slice(0, 4).map((item) => ({
            "@type": "BlogPosting",
            headline: item.title,
            description: item.description,
            datePublished: item.date,
            author: { "@type": "Organization", name: "BloxSmith" },
            url: `https://bloxsmith.pro/changelog#${item.version.replace(/\./g, "-")}`,
          })),
        }),
      },
    ],
  }),
});

function ChangelogPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3 w-3 text-primary-glow" /> BloxSmith updates
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            What's <span className="gradient-text">New</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg">
            Follow the latest website upgrades, AI improvements, Roblox Studio plugin changes,
            mobile fixes, security updates, and platform changelogs.
          </p>
        </div>

        <h2 className="sr-only">Release timeline</h2>
        <div className="space-y-16 relative before:absolute before:inset-0 before:left-4 sm:before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border/60 before:h-full">
          {changelogItems.map((item) => (
            <div
              id={item.version.replace(/\./g, "-")}
              key={item.version}
              className="relative flex flex-col sm:flex-row items-start sm:gap-12 group scroll-mt-24"
            >
              <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-surface border-2 border-primary grid place-items-center z-10 shadow-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>

              <div className="pl-12 sm:pl-0 sm:w-1/2 sm:text-right pt-1.5 flex sm:flex-col items-baseline sm:items-end gap-2 justify-start">
                <span className="text-xl sm:text-2xl font-black text-foreground">
                  {item.version}
                </span>
                <span className="text-xs font-semibold text-muted-foreground/80 bg-surface px-2.5 py-1 rounded-full border border-border">
                  {item.date}
                </span>
              </div>

              <div className="pl-12 sm:pl-0 sm:w-1/2 mt-4 sm:mt-0">
                <div className="glass rounded-2xl p-6 sm:p-8 hover:border-primary/30 transition-all duration-300">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight mb-2 text-foreground/90">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {item.description}
                  </p>

                  <div className="space-y-6">
                    {item.updates.map((upd, uIdx) => {
                      const Icon = upd.icon;
                      return (
                        <div key={uIdx} className="flex gap-4 items-start">
                          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-glow">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">
                                {upd.title}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${upd.tagColor}`}
                              >
                                {upd.category}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {upd.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center glass rounded-2xl p-8 max-w-xl mx-auto">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-glow mb-4">
            <Palette className="h-5 w-5" />
          </div>
          <h4 className="text-lg font-bold">Have suggestions or issues?</h4>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            BloxSmith is updated often to improve Roblox development workflows, plugin reliability,
            AI generation quality, mobile UX, and security.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              to="/plugin"
              className="text-xs font-semibold text-primary hover:text-primary-glow underline"
            >
              Download Latest Plugin
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              to="/docs"
              className="text-xs font-semibold text-primary hover:text-primary-glow underline"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
