-- ============================================================
-- BloxSmith Ultimate Plugin v2.1.0
-- Fully connected to bloxsmith.pro backend API.
--
-- API endpoints used:
--   POST /api/public/plugin/pair/start  → get pairing code + link
--   POST /api/public/plugin/pair/poll   → poll until user approves
--   POST /api/public/plugin/poll        → heartbeat + fetch actions
--   POST /api/public/plugin/scan        → upload workspace snapshot
--   POST /api/public/plugin/complete    → report action results
--   POST /api/public/plugin/clear       → clear stuck queue
--
-- Install: Plugins > Open Plugins Folder, drop this file in, restart Studio.
-- ============================================================

local HttpService          = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local Selection            = game:GetService("Selection")
local Lighting             = game:GetService("Lighting")
local Workspace            = game:GetService("Workspace")
local ServerScriptService  = game:GetService("ServerScriptService")
local ServerStorage        = game:GetService("ServerStorage")
local ReplicatedStorage    = game:GetService("ReplicatedStorage")
local ReplicatedFirst      = game:GetService("ReplicatedFirst")
local StarterPlayer        = game:GetService("StarterPlayer")
local StarterGui           = game:GetService("StarterGui")
local StarterPack          = game:GetService("StarterPack")
local SoundService         = game:GetService("SoundService")
local Teams                = game:GetService("Teams")
local RunService           = game:GetService("RunService")
local TweenService         = game:GetService("TweenService")
local InsertService        = game:GetService("InsertService")
local CollectionService    = game:GetService("CollectionService")
local Terrain              = Workspace.Terrain

if plugin == nil then
	warn("[BloxSmith] Must be installed as a Local Plugin.")
	return
end

----------------------------------------------------------------
-- CONFIG
----------------------------------------------------------------
local PLUGIN_VERSION  = "2.1.0"
local API_BASE        = "https://bloxsmith.pro"
local POLL_SECONDS    = 1        -- how often to call /poll for actions
local PAIR_POLL_SEC   = 2        -- how often to poll for pair approval
local PAIR_TIMEOUT    = 180      -- seconds before giving up on pair
local SCAN_TIMEOUT    = 30
local MAX_INSTANCES   = 1200
local MAX_DEPTH       = 8
local APPLY_YIELD_N   = 6
local REPORT_FLUSH_N  = 8
local LIVE_FOCUS_N    = 10

print(string.format("[BloxSmith] Loading Ultimate v%s — check the PLUGINS tab.", PLUGIN_VERSION))

----------------------------------------------------------------
-- SETTINGS helpers
----------------------------------------------------------------
local function getSetting(k)      return plugin:GetSetting(k) end
local function setSetting(k, v)   plugin:SetSetting(k, v) end
local function getToken()         return getSetting("bs_token") or "" end
local function setToken(v)        setSetting("bs_token", v) end
local function getProjectId()     return getSetting("bs_project_id") or "" end
local function setProjectId(v)    setSetting("bs_project_id", v) end
local function getPaused()        return getSetting("bs_paused") == true end
local function setPaused(v)       setSetting("bs_paused", v) end
local function getPreviewMode()   return getSetting("bs_preview") == true end
local function setPreviewMode(v)  setSetting("bs_preview", v) end
local function getIgnoresRaw()    return getSetting("bs_ignores") or "" end
local function setIgnoresRaw(v)   setSetting("bs_ignores", tostring(v or "")) end

local function getIgnoreList()
	local out = {}
	for token in string.gmatch(getIgnoresRaw(), "([^,]+)") do
		local t = token:gsub("^%s+", ""):gsub("%s+$", "")
		if t ~= "" then table.insert(out, string.lower(t)) end
	end
	return out
end
local function pathIsIgnored(path)
	if not path or path == "" then return false end
	local list = getIgnoreList()
	if #list == 0 then return false end
	local lower = string.lower(path)
	for _, pat in ipairs(list) do
		if string.find(lower, pat, 1, true) then return true end
	end
	return false
end

----------------------------------------------------------------
-- STATE
----------------------------------------------------------------
local connected           = false
local shouldBeConnected   = false
local pairingInProgress   = false
local pairingCancelled    = false
local activeProjectId     = nil    -- set after pair approval
local statsApplied        = 0
local statsSkipped        = 0
local statsErrors         = 0
local lastSyncAt          = 0
local pendingPreview      = {}
local previewSeenIds      = {}
local scanInProgress      = false
local scanCancelRequested = false

-- forward declarations
local appendLog; local logLine
local setPill;   local updateButtonState
local refreshStatsInfo; local refreshHealthInfo
local postPlugin; local postPluginRaw
local openPreviewOverlay; local closePreviewOverlay
local refreshReviewBtnLabel
local resolvePath; local dispatch; local applyActions
local instancePath; local fullPath; local focusOn
local buildSnapshot; local pushSnapshot
local doPairing; local doReconnect; local disconnect

----------------------------------------------------------------
-- TOOLBAR / WIDGET
----------------------------------------------------------------
local toolbar = plugin:CreateToolbar("BloxSmith AI")
local button  = toolbar:CreateButton(
	"BloxSmith_Open",
	"Open / close BloxSmith AI",
	"rbxasset://textures/StudioToolbox/Search.png",
	"BloxSmith"
)
button.Enabled = true
pcall(function() button.ClickableWhenViewportHidden = true end)

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right, false, false, 380, 600, 300, 460
)
local widget = plugin:CreateDockWidgetPluginGui("BloxSmith_Ultimate_v210", widgetInfo)
widget.Title = "BloxSmith AI v" .. PLUGIN_VERSION

local function toggleWidget()
	widget.Enabled = not widget.Enabled
	pcall(function() button:SetActive(widget.Enabled) end)
end
button.Click:Connect(toggleWidget)
widget:GetPropertyChangedSignal("Enabled"):Connect(function()
	pcall(function() button:SetActive(widget.Enabled) end)
end)

----------------------------------------------------------------
-- UI COLORS
----------------------------------------------------------------
local C = {
	bg        = Color3.fromRGB(10, 11, 16),
	panel     = Color3.fromRGB(18, 19, 26),
	panelHi   = Color3.fromRGB(24, 26, 36),
	stroke    = Color3.fromRGB(30, 32, 44),
	strokeHi  = Color3.fromRGB(56, 58, 78),
	primary   = Color3.fromRGB(124, 110, 248),
	primaryHi = Color3.fromRGB(146, 132, 255),
	disconnect= Color3.fromRGB(34, 36, 46),
	text      = Color3.fromRGB(245, 246, 252),
	textDim   = Color3.fromRGB(170, 174, 192),
	textMute  = Color3.fromRGB(110, 114, 132),
	accent    = Color3.fromRGB(180, 170, 255),
	success   = Color3.fromRGB(16, 185, 129),
	warn      = Color3.fromRGB(245, 158, 11),
	idle      = Color3.fromRGB(100, 116, 139),
	error     = Color3.fromRGB(239, 68, 68),
}

----------------------------------------------------------------
-- UI HELPERS
----------------------------------------------------------------
local function corner(p, r)
	local c = Instance.new("UICorner", p); c.CornerRadius = UDim.new(0, r or 6); return c
end
local function uiStroke(p, col, t)
	local s = Instance.new("UIStroke", p)
	s.Color = col or C.stroke; s.Thickness = t or 1
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	return s
end
local function padAll(p, n)
	local u = Instance.new("UIPadding", p)
	u.PaddingTop = UDim.new(0,n); u.PaddingBottom = UDim.new(0,n)
	u.PaddingLeft = UDim.new(0,n); u.PaddingRight = UDim.new(0,n)
end
local function tweenStroke(s, color, thickness)
	TweenService:Create(s, TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{ Color = color, Thickness = thickness or 1 }):Play()
end

----------------------------------------------------------------
-- BUILD SCROLLABLE ROOT
----------------------------------------------------------------
local scroll = Instance.new("ScrollingFrame", widget)
scroll.Size = UDim2.fromScale(1,1)
scroll.BackgroundColor3 = C.bg
scroll.BorderSizePixel = 0
scroll.ScrollBarThickness = 3
scroll.ScrollBarImageColor3 = C.strokeHi
scroll.ScrollBarImageTransparency = 0.3
scroll.CanvasSize = UDim2.fromScale(0,0)
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
padAll(scroll, 12)

local root = Instance.new("Frame", scroll)
root.Size = UDim2.new(1,0,0,0)
root.AutomaticSize = Enum.AutomaticSize.Y
root.BackgroundTransparency = 1
local rootList = Instance.new("UIListLayout", root)
rootList.Padding = UDim.new(0,8)
rootList.SortOrder = Enum.SortOrder.LayoutOrder

-- ---- Header row ----
local header = Instance.new("Frame", root)
header.LayoutOrder = 1; header.BackgroundTransparency = 1; header.Size = UDim2.new(1,0,0,32)

local titleLabel = Instance.new("TextLabel", header)
titleLabel.BackgroundTransparency = 1; titleLabel.Position = UDim2.new(0,0,0,0)
titleLabel.Size = UDim2.new(1,-110,1,0)
titleLabel.Font = Enum.Font.BuilderSansBold; titleLabel.TextSize = 15
titleLabel.TextColor3 = C.text; titleLabel.Text = "BloxSmith AI"
titleLabel.TextXAlignment = Enum.TextXAlignment.Left

-- Status pill
local pill = Instance.new("Frame", header)
pill.AnchorPoint = Vector2.new(1,0.5); pill.Position = UDim2.new(1,0,0.5,0)
pill.Size = UDim2.fromOffset(104,24); pill.BackgroundColor3 = C.panel; pill.BorderSizePixel = 0
corner(pill, 12)
local pillStroke = uiStroke(pill, C.stroke, 1)

local pillDot = Instance.new("Frame", pill)
pillDot.Size = UDim2.fromOffset(6,6); pillDot.Position = UDim2.new(0,12,0.5,-3)
pillDot.BackgroundColor3 = C.idle; pillDot.BorderSizePixel = 0; corner(pillDot, 3)
local pillDotGlow = uiStroke(pillDot, C.idle, 2)
pillDotGlow.Transparency = 0.55

local pillText = Instance.new("TextLabel", pill)
pillText.BackgroundTransparency = 1; pillText.Position = UDim2.new(0,24,0,0)
pillText.Size = UDim2.new(1,-30,1,0); pillText.Font = Enum.Font.BuilderSansMedium; pillText.TextSize = 11
pillText.TextColor3 = C.textDim; pillText.Text = "Offline"
pillText.TextXAlignment = Enum.TextXAlignment.Left

local activePulse = nil
local function stopPulse()
	if activePulse then task.cancel(activePulse); activePulse = nil end
	pillDot.BackgroundTransparency = 0; pillDotGlow.Transparency = 0.55; pillStroke.Transparency = 0
end
local function startPulse()
	stopPulse()
	activePulse = task.spawn(function()
		while true do
			TweenService:Create(pillDot, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { BackgroundTransparency = 0.6 }):Play()
			task.wait(0.6)
			TweenService:Create(pillDot, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { BackgroundTransparency = 0 }):Play()
			task.wait(0.6)
		end
	end)
end

setPill = function(state)
	stopPulse()
	if state == "connected" then
		pillDot.BackgroundColor3 = C.success; pillDotGlow.Color = C.success
		pillStroke.Color = C.success; pillText.Text = "Connected"; pillText.TextColor3 = C.success
		startPulse()
	elseif state == "pairing" then
		pillDot.BackgroundColor3 = C.primary; pillDotGlow.Color = C.primary
		pillStroke.Color = C.primary; pillText.Text = "Pairing…"; pillText.TextColor3 = C.primary
		startPulse()
	elseif state == "connecting" then
		pillDot.BackgroundColor3 = C.warn; pillDotGlow.Color = C.warn
		pillStroke.Color = C.warn; pillText.Text = "Connecting…"; pillText.TextColor3 = C.warn
		startPulse()
	elseif state == "scanning" then
		pillDot.BackgroundColor3 = C.warn; pillDotGlow.Color = C.warn
		pillStroke.Color = C.warn; pillText.Text = "Scanning…"; pillText.TextColor3 = C.warn
		startPulse()
	elseif state == "executing" then
		pillDot.BackgroundColor3 = C.warn; pillDotGlow.Color = C.warn
		pillStroke.Color = C.warn; pillText.Text = "Building…"; pillText.TextColor3 = C.warn
		startPulse()
	elseif state == "error" then
		pillDot.BackgroundColor3 = C.error; pillDotGlow.Color = C.error
		pillStroke.Color = C.error; pillText.Text = "Error"; pillText.TextColor3 = C.error
	elseif state == "complete" then
		pillDot.BackgroundColor3 = C.success; pillStroke.Color = C.success
		pillText.Text = "Done ✓"; pillText.TextColor3 = C.success
	elseif state == "idle" then
		pillDot.BackgroundColor3 = C.primary; pillStroke.Color = C.primary
		pillText.Text = "Pending"; pillText.TextColor3 = C.primary
	else -- offline
		pillDot.BackgroundColor3 = C.idle; pillDotGlow.Color = C.idle
		pillStroke.Color = C.stroke; pillText.Text = "Offline"; pillText.TextColor3 = C.textDim
	end
end

-- ---- Version subtitle ----
local sub = Instance.new("TextLabel", root)
sub.LayoutOrder = 2; sub.BackgroundTransparency = 1; sub.Size = UDim2.new(1,0,0,13)
sub.Font = Enum.Font.BuilderSans; sub.TextSize = 10; sub.TextColor3 = C.textMute
sub.Text = "Build anything in Roblox with AI  ·  v" .. PLUGIN_VERSION
sub.TextXAlignment = Enum.TextXAlignment.Left

-- ---- Pairing link box (hidden until pairing) ----
local pairCard = Instance.new("Frame", root)
pairCard.LayoutOrder = 3; pairCard.AutomaticSize = Enum.AutomaticSize.Y
pairCard.Size = UDim2.new(1,0,0,0); pairCard.BackgroundColor3 = C.panelHi
pairCard.BorderSizePixel = 0; pairCard.Visible = false
corner(pairCard, 10); uiStroke(pairCard, C.primary, 1.5); padAll(pairCard, 10)
local pairList = Instance.new("UIListLayout", pairCard)
pairList.Padding = UDim.new(0,6); pairList.SortOrder = Enum.SortOrder.LayoutOrder

local pairInstr = Instance.new("TextLabel", pairCard)
pairInstr.LayoutOrder = 1; pairInstr.BackgroundTransparency = 1
pairInstr.Size = UDim2.new(1,0,0,0); pairInstr.AutomaticSize = Enum.AutomaticSize.Y
pairInstr.Font = Enum.Font.BuilderSansBold; pairInstr.TextSize = 11
pairInstr.TextColor3 = C.accent; pairInstr.TextWrapped = true
pairInstr.Text = "1. Copy the link below and open it in your browser.\n2. Sign in to BloxSmith and click \"Approve & connect\".\n3. Come back here — status flips to Connected automatically."
pairInstr.TextXAlignment = Enum.TextXAlignment.Left

local pairLinkBox = Instance.new("TextBox", pairCard)
pairLinkBox.LayoutOrder = 2; pairLinkBox.Size = UDim2.new(1,0,0,26)
pairLinkBox.BackgroundColor3 = C.bg; pairLinkBox.TextColor3 = C.text
pairLinkBox.Font = Enum.Font.Code; pairLinkBox.TextSize = 10
pairLinkBox.Text = ""; pairLinkBox.ClearTextOnFocus = false
pairLinkBox.TextXAlignment = Enum.TextXAlignment.Left
corner(pairLinkBox, 6); uiStroke(pairLinkBox, C.strokeHi, 1)
local pairLinkPad = Instance.new("UIPadding", pairLinkBox)
pairLinkPad.PaddingLeft = UDim.new(0,8); pairLinkPad.PaddingRight = UDim.new(0,8)

local pairCodeLabel = Instance.new("TextLabel", pairCard)
pairCodeLabel.LayoutOrder = 3; pairCodeLabel.BackgroundTransparency = 1
pairCodeLabel.Size = UDim2.new(1,0,0,14)
pairCodeLabel.Font = Enum.Font.BuilderSansMedium; pairCodeLabel.TextSize = 10
pairCodeLabel.TextColor3 = C.textMute; pairCodeLabel.Text = "Code: —"
pairCodeLabel.TextXAlignment = Enum.TextXAlignment.Left

local cancelPairBtn = Instance.new("TextButton", pairCard)
cancelPairBtn.LayoutOrder = 4; cancelPairBtn.Size = UDim2.new(1,0,0,24)
cancelPairBtn.BackgroundColor3 = C.disconnect; cancelPairBtn.TextColor3 = C.error
cancelPairBtn.Font = Enum.Font.BuilderSansMedium; cancelPairBtn.TextSize = 11
cancelPairBtn.Text = "Cancel pairing"; cancelPairBtn.BorderSizePixel = 0
corner(cancelPairBtn, 6); uiStroke(cancelPairBtn, C.error, 1)

-- ---- Info card ----
local infoCard = Instance.new("Frame", root)
infoCard.LayoutOrder = 4; infoCard.AutomaticSize = Enum.AutomaticSize.Y
infoCard.Size = UDim2.new(1,0,0,0); infoCard.BackgroundColor3 = C.panel
infoCard.BorderSizePixel = 0
corner(infoCard, 10); uiStroke(infoCard, C.stroke, 1); padAll(infoCard, 12)
local infoList = Instance.new("UIListLayout", infoCard)
infoList.Padding = UDim.new(0,6); infoList.SortOrder = Enum.SortOrder.LayoutOrder

local function infoRow(order, lbl)
	local row = Instance.new("Frame", infoCard)
	row.LayoutOrder = order; row.BackgroundTransparency = 1; row.Size = UDim2.new(1,0,0,18)
	local lt = Instance.new("TextLabel", row); lt.BackgroundTransparency = 1
	lt.Size = UDim2.new(0,68,1,0); lt.Font = Enum.Font.BuilderSansBold; lt.TextSize = 9
	lt.TextColor3 = C.textMute; lt.Text = lbl; lt.TextXAlignment = Enum.TextXAlignment.Left
	local vt = Instance.new("TextLabel", row); vt.BackgroundTransparency = 1
	vt.Position = UDim2.new(0,72,0,0); vt.Size = UDim2.new(1,-72,1,0)
	vt.Font = Enum.Font.BuilderSans; vt.TextSize = 10; vt.TextColor3 = C.text
	vt.Text = "—"; vt.TextXAlignment = Enum.TextXAlignment.Left
	vt.TextTruncate = Enum.TextTruncate.AtEnd
	return vt
end

local statusVal   = infoRow(1, "STATUS")
local projectVal  = infoRow(2, "PROJECT")
local syncVal     = infoRow(3, "BUILDS")
local statsVal    = infoRow(4, "STATS")
local healthVal   = infoRow(5, "HEALTH")

refreshStatsInfo = function()
	local agoText
	if lastSyncAt == 0 then agoText = "never"
	else
		local d = os.time() - lastSyncAt
		if d < 2 then agoText = "just now"
		elseif d < 60 then agoText = d .. "s ago"
		elseif d < 3600 then agoText = math.floor(d/60) .. "m ago"
		else agoText = math.floor(d/3600) .. "h ago" end
	end
	statsVal.Text = ("Applied %d · Skipped %d · Errors %d · Last: %s"):format(
		statsApplied, statsSkipped, statsErrors, agoText)
end
refreshStatsInfo()

refreshHealthInfo = function(extra)
	local conn = connected and "online" or (pairingInProgress and "pairing" or (shouldBeConnected and "reconnecting" or "offline"))
	healthVal.Text = conn .. (extra and (" · " .. extra) or "")
end
refreshHealthInfo()

task.spawn(function()
	while true do task.wait(2); pcall(refreshStatsInfo); pcall(refreshHealthInfo) end
end)

-- ---- Connect button ----
local connectBtn = Instance.new("TextButton", root)
connectBtn.LayoutOrder = 5; connectBtn.Size = UDim2.new(1,0,0,36)
connectBtn.BackgroundColor3 = C.primary; connectBtn.TextColor3 = Color3.new(1,1,1)
connectBtn.Font = Enum.Font.BuilderSansBold; connectBtn.TextSize = 14
connectBtn.Text = "Connect"; connectBtn.BorderSizePixel = 0; connectBtn.AutoButtonColor = false
corner(connectBtn, 10)
local connectStroke = uiStroke(connectBtn, C.stroke, 1)

updateButtonState = function()
	if connected or pairingInProgress then
		connectBtn.Text = "Disconnect"; connectBtn.BackgroundColor3 = C.disconnect
		connectStroke.Color = C.error; connectBtn.TextColor3 = C.error
	else
		connectBtn.Text = "Connect"; connectBtn.BackgroundColor3 = C.primary
		connectStroke.Color = C.stroke; connectBtn.TextColor3 = Color3.new(1,1,1)
	end
end

-- ---- Utility buttons grid ----
local function makeBtnGrid()
	local grid = Instance.new("Frame", root)
	grid.LayoutOrder = 6; grid.Size = UDim2.new(1,0,0,0); grid.AutomaticSize = Enum.AutomaticSize.Y
	grid.BackgroundTransparency = 1
	local gl = Instance.new("UIGridLayout", grid)
	gl.CellPadding = UDim2.new(0,5,0,5)
	gl.CellSize = UDim2.new(0.5,-3,0,28)
	gl.SortOrder = Enum.SortOrder.LayoutOrder

	local function btn(text, order)
		local b = Instance.new("TextButton")
		b.BackgroundColor3 = C.panel; b.TextColor3 = C.textDim
		b.Font = Enum.Font.BuilderSansMedium; b.TextSize = 11
		b.Text = text; b.BorderSizePixel = 0; b.LayoutOrder = order; b.Parent = grid
		corner(b, 6); uiStroke(b, C.stroke, 1)
		return b
	end
	return grid,
		btn("Sync Now",    1),
		btn("Scan Project",2),
		btn("Clear Queue", 3),
		btn("Reconnect",   4),
		btn("Organize",    5),
		btn("Auto-Fix",    6)
end

local btnGrid, syncNowBtn, scanBtn, clearQueueBtn, reconnectBtn, organizeBtn, autoFixBtn = makeBtnGrid()

-- ---- Toggles ----
local function makeToggleBtn(order, label)
	local b = Instance.new("TextButton", root)
	b.LayoutOrder = order; b.Size = UDim2.new(1,0,0,28)
	b.BackgroundColor3 = C.panel; b.TextColor3 = C.textDim
	b.Font = Enum.Font.BuilderSansMedium; b.TextSize = 11
	b.Text = label; b.BorderSizePixel = 0; b.AutoButtonColor = false
	corner(b, 8); uiStroke(b, C.stroke, 1)
	return b
end

local pauseBtn   = makeToggleBtn(7, getPaused()      and "▶  Resume sync"       or "⏸  Pause sync")
local previewBtn = makeToggleBtn(8, getPreviewMode() and "🔍  Preview Mode: ON" or "🔍  Preview Mode: OFF")
local reviewBtn  = makeToggleBtn(9, "Review Pending (0)")

refreshReviewBtnLabel = function()
	reviewBtn.Text = ("Review Pending (%d)"):format(#pendingPreview)
end

-- ---- Ignore filters ----
local igLabel = Instance.new("TextLabel", root)
igLabel.LayoutOrder = 10; igLabel.BackgroundTransparency = 1; igLabel.Size = UDim2.new(1,0,0,13)
igLabel.Font = Enum.Font.BuilderSansBold; igLabel.TextSize = 9; igLabel.TextColor3 = C.textMute
igLabel.Text = "Ignore filters (comma-separated folder names to exclude from scans)"
igLabel.TextXAlignment = Enum.TextXAlignment.Left

local igWrap = Instance.new("Frame", root)
igWrap.LayoutOrder = 11; igWrap.Size = UDim2.new(1,0,0,28); igWrap.BackgroundColor3 = C.panel
igWrap.BorderSizePixel = 0; corner(igWrap, 8)
local igStroke = uiStroke(igWrap, C.stroke, 1)
local igBox = Instance.new("TextBox", igWrap)
igBox.Size = UDim2.new(1,-24,1,0); igBox.Position = UDim2.new(0,12,0,0)
igBox.BackgroundTransparency = 1; igBox.TextColor3 = C.textDim
igBox.Font = Enum.Font.Code; igBox.TextSize = 10; igBox.ClearTextOnFocus = false
igBox.Text = getIgnoresRaw(); igBox.PlaceholderText = "StarterPlayer, Archive, _wip"
igBox.PlaceholderColor3 = C.textMute; igBox.TextXAlignment = Enum.TextXAlignment.Left
igBox.Focused:Connect(function() tweenStroke(igStroke, C.primary, 1.5) end)
igBox.FocusLost:Connect(function() tweenStroke(igStroke, C.stroke, 1); setIgnoresRaw(igBox.Text or "") end)

-- ---- Footer ----
local footer = Instance.new("TextLabel", root)
footer.LayoutOrder = 12; footer.BackgroundTransparency = 1; footer.Size = UDim2.new(1,0,0,30)
footer.Font = Enum.Font.BuilderSans; footer.TextSize = 9; footer.TextColor3 = C.textMute
footer.TextWrapped = true; footer.TextXAlignment = Enum.TextXAlignment.Left
footer.Text = "bloxsmith.pro · Sends script source + workspace snapshot to BloxSmith AI. All changes are undoable (Ctrl+Z)."

-- ---- Activity Log ----
local logHeaderRow = Instance.new("Frame", root)
logHeaderRow.LayoutOrder = 13; logHeaderRow.BackgroundTransparency = 1; logHeaderRow.Size = UDim2.new(1,0,0,20)
local logTitle2 = Instance.new("TextLabel", logHeaderRow)
logTitle2.BackgroundTransparency = 1; logTitle2.Size = UDim2.new(1,-130,1,0)
logTitle2.Font = Enum.Font.BuilderSansBold; logTitle2.TextSize = 11; logTitle2.TextColor3 = C.textDim
logTitle2.Text = "Activity Log"; logTitle2.TextXAlignment = Enum.TextXAlignment.Left

local function miniBtn2(text, xOff)
	local b = Instance.new("TextButton")
	b.AnchorPoint = Vector2.new(1,0.5); b.Position = UDim2.new(1,xOff,0.5,0)
	b.Size = UDim2.new(0,58,0,18); b.BackgroundColor3 = C.panel; b.TextColor3 = C.textDim
	b.Font = Enum.Font.BuilderSans; b.TextSize = 10; b.Text = text; b.BorderSizePixel = 0
	b.Parent = logHeaderRow; corner(b, 4); return b
end
local clearLogBtn  = miniBtn2("Clear",   0)
local copyLogBtn   = miniBtn2("Copy", -64)
local verboseBtn   = miniBtn2("Verbose", -128)

local logFrame = Instance.new("ScrollingFrame", root)
logFrame.LayoutOrder = 14; logFrame.Size = UDim2.new(1,0,0,130); logFrame.BackgroundColor3 = C.bg
logFrame.BorderSizePixel = 0; logFrame.CanvasSize = UDim2.new(0,0,0,0)
logFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y; logFrame.ScrollBarThickness = 3
corner(logFrame, 6)
local lp = Instance.new("UIPadding", logFrame)
lp.PaddingTop = UDim.new(0,4); lp.PaddingBottom = UDim.new(0,4)
lp.PaddingLeft = UDim.new(0,6); lp.PaddingRight = UDim.new(0,6)
local lll = Instance.new("UIListLayout", logFrame)
lll.SortOrder = Enum.SortOrder.LayoutOrder; lll.Padding = UDim.new(0,1)

local LOG_COLORS = {
	info    = Color3.fromRGB(160,200,255),
	success = Color3.fromRGB(140,220,160),
	warn    = Color3.fromRGB(255,200,120),
	error   = Color3.fromRGB(255,120,120),
	action  = Color3.fromRGB(190,175,255),
	debug   = Color3.fromRGB(140,145,160),
}
local logLines = {}
local logLineCount = 0
local VERBOSE = false

logLine = function(text, level)
	local color = LOG_COLORS[level or "info"] or LOG_COLORS.info
	local ts = os.date("%H:%M:%S")
	local prefix = (level == "error" and "ERR " or level == "warn" and "WARN" or level == "action" and "ACT " or "INFO")
	local full = ("[%s] %s | %s"):format(ts, prefix, tostring(text))
	if level == "debug" and not VERBOSE then return end
	logLineCount += 1
	local lbl = Instance.new("TextLabel", logFrame)
	lbl.AutomaticSize = Enum.AutomaticSize.Y; lbl.Size = UDim2.new(1,-4,0,0)
	lbl.BackgroundTransparency = 1; lbl.Font = Enum.Font.Code; lbl.TextSize = 10
	lbl.TextColor3 = color; lbl.TextXAlignment = Enum.TextXAlignment.Left
	lbl.TextYAlignment = Enum.TextYAlignment.Top; lbl.TextWrapped = true
	lbl.Text = full; lbl.LayoutOrder = logLineCount
	lbl.Parent = logFrame
	table.insert(logLines, lbl)
	if #logLines > 300 then
		local old = table.remove(logLines, 1)
		if old then old:Destroy() end
	end
	if level == "error" or level == "warn" then warn("[BloxSmith] " .. tostring(text))
	else print("[BloxSmith] " .. tostring(text)) end
end

appendLog = function(msg)
	logLine(tostring(msg), "info")
end

clearLogBtn.MouseButton1Click:Connect(function()
	for _, c in ipairs(logLines) do c:Destroy() end
	table.clear(logLines); logLine("Log cleared.", "debug")
end)
copyLogBtn.MouseButton1Click:Connect(function()
	pcall(function()
		local lines = {}
		for _, l in ipairs(logLines) do table.insert(lines, l.Text) end
		;(setclipboard or function() end)(table.concat(lines, "\n"))
		logLine("Copied log to clipboard.", "info")
	end)
end)
verboseBtn.MouseButton1Click:Connect(function()
	VERBOSE = not VERBOSE
	verboseBtn.BackgroundColor3 = VERBOSE and C.primary or C.panel
	logLine("Verbose " .. (VERBOSE and "ON" or "OFF"), "debug")
end)

----------------------------------------------------------------
-- HTTP — all calls route through /api/public/plugin/* endpoints
----------------------------------------------------------------

-- Helper to POST to a plugin endpoint with the token in the header
postPlugin = function(path, body)
	local url = API_BASE .. path
	local tok = getToken()
	if tok == "" then return nil, "no token" end
	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = url, Method = "POST",
			Headers = {
				["Content-Type"]        = "application/json",
				["x-bloxsmith-token"]   = tok,
				["authorization"]       = "Bearer " .. tok,
			},
			Body = HttpService:JSONEncode(body or {}),
		})
	end)
	if not ok then
		local e = tostring(res)
		logLine("Network error (" .. path .. "): " .. e, "warn")
		return nil, e
	end
	if not res.Success then
		local e = "HTTP " .. tostring(res.StatusCode)
		if res.StatusCode == 401 or res.StatusCode == 403 then
			connected = false; shouldBeConnected = false
			setPill("offline"); updateButtonState()
			statusVal.Text = "Token rejected — reconnect"
			pairCard.Visible = false; pairingInProgress = false
			logLine("Token invalid (HTTP " .. res.StatusCode .. ") — use Connect to re-pair.", "error")
			return nil, e
		end
		logLine("Server error (" .. path .. "): " .. e, "warn")
		return nil, e
	end
	local okJ, decoded = pcall(function() return HttpService:JSONDecode(res.Body) end)
	if not okJ then return nil, "Bad JSON from " .. path end
	return decoded
end

-- Variant without auth header for pair/start (no token yet)
postPluginRaw = function(path, body)
	local url = API_BASE .. path
	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = url, Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode(body or {}),
		})
	end)
	if not ok then return nil, tostring(res) end
	if not res.Success then return nil, "HTTP " .. tostring(res.StatusCode) end
	local okJ, decoded = pcall(function() return HttpService:JSONDecode(res.Body) end)
	if not okJ then return nil, "Bad JSON" end
	return decoded
end

----------------------------------------------------------------
-- SERVICE RESOLVER
----------------------------------------------------------------
local SERVICE_MAP = {
	workspace               = "Workspace",
	replicatedstorage       = "ReplicatedStorage",
	replicatedfirst         = "ReplicatedFirst",
	serverscriptservice     = "ServerScriptService",
	serverstorage           = "ServerStorage",
	startergui              = "StarterGui",
	starterpack             = "StarterPack",
	starterplayer           = "StarterPlayer",
	starterplayerscripts    = "StarterPlayer/StarterPlayerScripts",
	startercharacterscripts = "StarterPlayer/StarterCharacterScripts",
	lighting                = "Lighting",
	soundservice            = "SoundService",
	teams                   = "Teams",
}
local function getService(name)
	local ok, svc = pcall(function() return game:GetService(name) end)
	if ok and svc then return svc end
	return nil
end

resolvePath = function(path, create)
	if not path or path == "" then return nil end
	path = tostring(path):gsub("%.", "/")
	local segments = string.split(path, "/")
	local alias = SERVICE_MAP[string.lower(segments[1])]
	if alias then
		local aliasSegs = string.split(alias, "/")
		local rest = {}
		for i = 2, #segments do rest[#rest+1] = segments[i] end
		segments = {}
		for _, s in ipairs(aliasSegs) do segments[#segments+1] = s end
		for _, s in ipairs(rest)      do segments[#segments+1] = s end
	end
	local node = getService(segments[1]) or game:FindFirstChild(segments[1])
	if not node then return nil end
	for i = 2, #segments do
		local seg = segments[i]
		if seg ~= "" then
			local child = node:FindFirstChild(seg)
			if not child then
				if not create then return nil end
				if node == StarterPlayer and (seg == "StarterPlayerScripts" or seg == "StarterCharacterScripts") then
					local ok2, w = pcall(function() return node:WaitForChild(seg, 5) end)
					if ok2 and w then child = w else child = node:FindFirstChild(seg) end
				end
				if not child then
					child = Instance.new("Folder"); child.Name = seg; child.Parent = node
				end
			end
			node = child
		end
	end
	return node
end

instancePath = function(inst)
	local parts = {}; local cur = inst
	while cur and cur ~= game do
		table.insert(parts, 1, cur.Name); cur = cur.Parent
	end
	return "game." .. table.concat(parts, ".")
end

fullPath = function(inst)
	local ok, p = pcall(function() return inst:GetFullName() end)
	return ok and p or tostring(inst)
end

local function instanceId(inst)
	local ok, id = pcall(function() return inst:GetDebugId(0) end)
	return (ok and id) or instancePath(inst)
end

local function ensureFolder(parent, name)
	local ex = parent:FindFirstChild(name)
	if ex and ex:IsA("Folder") then return ex end
	local f = Instance.new("Folder"); f.Name = name; f.Parent = parent; return f
end

----------------------------------------------------------------
-- PROPERTY COERCION
----------------------------------------------------------------
local function tableLooksLikeXYZ(t)
	return type(t) == "table" and (t.x ~= nil or t.X ~= nil or t[1] ~= nil)
end
local function toVector3(v, def)
	if typeof(v) == "Vector3" then return v end
	if type(v) == "table" then
		return Vector3.new(v.x or v.X or v[1] or 0, v.y or v.Y or v[2] or 0, v.z or v.Z or v[3] or 0)
	end
	return def or Vector3.zero
end
local function toColor3(v, def)
	if typeof(v) == "Color3" then return v end
	if type(v) == "table" then
		local r = v.r or v.R or v[1] or 255
		local g = v.g or v.G or v[2] or 255
		local b = v.b or v.B or v[3] or 255
		if r > 1 or g > 1 or b > 1 then
			return Color3.fromRGB(math.floor(r), math.floor(g), math.floor(b))
		end
		return Color3.new(r, g, b)
	end
	return def or Color3.fromRGB(200,200,200)
end

local VECTOR3_PROPS = { Size=true, Position=true, Velocity=true, Orientation=true }
local COLOR3_PROPS  = { Color=true, BackgroundColor3=true, TextColor3=true, BorderColor3=true, ImageColor3=true }

local function coerceValue(raw)
	if type(raw) ~= "table" then return raw end
	local t = raw.__t or raw.type or raw.Type
	if t == "Vector3" or tableLooksLikeXYZ(raw) then return toVector3(raw) end
	if t == "Color3" then return toColor3(raw) end
	if t == "CFrame" then
		local p = toVector3(raw)
		if raw.rx ~= nil or raw.RX ~= nil then
			return CFrame.new(p) * CFrame.Angles(raw.rx or raw.RX or 0, raw.ry or raw.RY or 0, raw.rz or raw.RZ or 0)
		end
		return CFrame.new(p)
	end
	if t == "UDim2" then
		return UDim2.new(raw.xs or 0, raw.xo or 0, raw.ys or 0, raw.yo or 0)
	end
	if t == "UDim" then return UDim.new(raw.Scale or 0, raw.Offset or 0) end
	if t == "BrickColor" then return BrickColor.new(raw.name or "Medium stone grey") end
	if t == "Enum" and raw.enum and raw.value then
		local ok, e = pcall(function() return Enum[raw.enum][raw.value] end)
		if ok then return e end
	end
	return raw
end

local function applyProps(inst, props)
	if not props then return end
	for k, raw in pairs(props) do
		if k == "Parent" and type(raw) == "string" then
			local p = resolvePath(raw, true)
			if p then pcall(function() inst.Parent = p end) end
		else
			local ok, val = pcall(coerceValue, raw)
			if not ok then val = raw end
			if type(val) == "table" then
				if VECTOR3_PROPS[k] and tableLooksLikeXYZ(val) then val = toVector3(val)
				elseif COLOR3_PROPS[k] then val = toColor3(val)
				elseif k == "CFrame" and tableLooksLikeXYZ(val) then val = CFrame.new(toVector3(val)) end
			end
			pcall(function() inst[k] = val end)
		end
	end
end

local function applyVisibleDefaults(inst, props)
	if not inst:IsA("BasePart") then return end
	local p = props or {}
	if p.Anchored == nil and not inst.Anchored then inst.Anchored = true end
	if p.Transparency == nil and inst.Transparency >= 1 then inst.Transparency = 0 end
	if p.CanCollide == nil then inst.CanCollide = true end
	if p.Size == nil and inst.Size.Magnitude < 0.5 then inst.Size = Vector3.new(4,4,4) end
	if p.Position == nil and p.CFrame == nil and inst.Position.Magnitude < 0.01 then
		inst.CFrame = CFrame.new(0, 10, 0)
	end
end

----------------------------------------------------------------
-- ACTION HANDLERS
-- The website sends actions with these kinds (from plugin-actions.ts):
-- script, localscript, modulescript, gui, screengui, frame, textlabel,
-- textbutton, imagelabel, part, model, terrain, tool, sound, team,
-- remoteevent, remotefunction, bindableevent, leaderstats, insert_asset,
-- set_properties, rename, move, delete, setting, run, run_lua,
-- organize_project, autofix_project, scan_project
-- Each action has: kind, name, parent_path, payload, position
----------------------------------------------------------------
local Actions = {}

local function normParent(kind, parentPath, payload)
	-- honour the server's already-normalized parent_path first
	if parentPath and parentPath ~= "" then return parentPath end
	-- sensible fallbacks
	if kind == "script"          then return "ServerScriptService" end
	if kind == "localscript"     then return "StarterPlayer/StarterPlayerScripts" end
	if kind == "modulescript"    then return "ReplicatedStorage/Modules" end
	if kind == "remoteevent" or kind == "remotefunction" or kind == "bindableevent" then
		return "ReplicatedStorage/Remotes"
	end
	if kind == "screengui" or kind == "gui" or kind == "frame"
		or kind == "textlabel" or kind == "textbutton" or kind == "imagelabel" then
		return "StarterGui"
	end
	if kind == "tool"  then return "StarterPack" end
	if kind == "sound" then return "SoundService" end
	if kind == "team"  then return "Teams" end
	return "Workspace"
end

-- Build a unified action table from the server's format
local function normalizeAction(a)
	-- server sends: { kind, name, parent_path, payload, position }
	local kind    = tostring(a.kind or ""):lower():gsub("[%s%-]+", "_")
	local name    = tostring(a.name or "BloxSmithAction")
	local parent  = normParent(kind, tostring(a.parent_path or ""), a.payload or {})
	local payload = type(a.payload) == "table" and a.payload or {}
	return kind, name, parent, payload
end

function Actions.script(a)
	local kind, name, parent, payload = normalizeAction(a)
	local scriptParent = resolvePath(parent, true)
	if not scriptParent then return false, "bad parent: " .. parent end
	local className = "Script"
	if kind == "localscript" then className = "LocalScript"
	elseif kind == "modulescript" then className = "ModuleScript" end
	local existing = scriptParent:FindFirstChild(name)
	if existing and not existing:IsA(className) then existing:Destroy(); existing = nil end
	if not existing then
		existing = Instance.new(className); existing.Name = name; existing.Parent = scriptParent
	end
	existing.Source = tostring(payload.source or payload.content or a.source or "")
	return true, nil, existing
end
Actions.localscript   = Actions.script
Actions.modulescript  = Actions.script

function Actions.part(a)
	local _, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local part = p:FindFirstChild(name) or Instance.new("Part")
	part.Name = name
	if payload.size     then part.Size     = toVector3(payload.size, Vector3.new(4,4,4)) end
	if payload.position then part.Position = toVector3(payload.position, Vector3.new(0,5,0)) end
	if payload.color    then part.Color    = toColor3(payload.color) end
	if payload.material then pcall(function() part.Material = Enum.Material[payload.material] end) end
	part.Anchored = payload.anchored ~= false
	part.CanCollide = true; part.Transparency = 0
	applyProps(part, payload.properties or {})
	applyVisibleDefaults(part, payload)
	part.Parent = p
	return true, nil, part
end
Actions.create_part = Actions.part

function Actions.model(a)
	local _, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local model = p:FindFirstChild(name)
	if not model or not model:IsA("Model") then
		model = Instance.new("Model"); model.Name = name
	end
	applyProps(model, payload.properties or {})
	model.Parent = p
	return true, nil, model
end
Actions.create_model = Actions.model

function Actions.screengui(a)
	local _, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local gui = p:FindFirstChild(name)
	if not gui or not gui:IsA("ScreenGui") then
		gui = Instance.new("ScreenGui"); gui.Name = name
	end
	applyProps(gui, payload.properties or {})
	gui.Parent = p
	return true, nil, gui
end
Actions.gui = Actions.screengui

function Actions.frame(a)
	local kind, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local cls = "Frame"
	if kind == "textlabel"  then cls = "TextLabel" end
	if kind == "textbutton" then cls = "TextButton" end
	if kind == "imagelabel" then cls = "ImageLabel" end
	local inst = p:FindFirstChild(name)
	if not inst or not inst:IsA(cls) then
		inst = Instance.new(cls); inst.Name = name
	end
	applyProps(inst, payload.properties or {})
	inst.Parent = p
	return true, nil, inst
end
Actions.textlabel  = Actions.frame
Actions.textbutton = Actions.frame
Actions.imagelabel = Actions.frame

function Actions.remoteevent(a)
	local kind, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local cls = "RemoteEvent"
	if kind == "remotefunction"  then cls = "RemoteFunction" end
	if kind == "bindableevent"   then cls = "BindableEvent" end
	local inst = p:FindFirstChild(name)
	if not inst or not inst:IsA(cls) then
		inst = Instance.new(cls); inst.Name = name
	end
	applyProps(inst, payload.properties or {})
	inst.Parent = p
	return true, nil, inst
end
Actions.remotefunction = Actions.remoteevent
Actions.bindableevent  = Actions.remoteevent

function Actions.tool(a)
	local _, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local t = p:FindFirstChild(name)
	if not t or not t:IsA("Tool") then
		t = Instance.new("Tool"); t.Name = name
	end
	applyProps(t, payload.properties or {})
	t.Parent = p
	return true, nil, t
end

function Actions.sound(a)
	local _, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local s = p:FindFirstChild(name)
	if not s or not s:IsA("Sound") then
		s = Instance.new("Sound"); s.Name = name
	end
	if payload.assetId then s.SoundId = "rbxassetid://" .. tostring(payload.assetId) end
	s.Volume = payload.volume or 0.5
	s.Looped = payload.looped == true
	applyProps(s, payload.properties or {})
	s.Parent = p
	return true, nil, s
end

function Actions.team(a)
	local _, name, _, payload = normalizeAction(a)
	local t = Teams:FindFirstChild(name)
	if not t or not t:IsA("Team") then
		t = Instance.new("Team"); t.Name = name
	end
	if payload.teamColor then pcall(function() t.TeamColor = BrickColor.new(payload.teamColor) end) end
	applyProps(t, payload.properties or {})
	t.Parent = Teams
	return true, nil, t
end

function Actions.leaderstats(a)
	local _, name, _, payload = normalizeAction(a)
	-- Inject leaderstats via a Script in ServerScriptService
	local sss = ServerScriptService
	local scriptName = "LeaderstatsSetup_" .. (name or "Stats")
	local existing = sss:FindFirstChild(scriptName)
	if not existing then
		existing = Instance.new("Script"); existing.Name = scriptName
	end
	local stats = payload.stats or payload.items or { "Cash", "XP" }
	local lines = { "local Players = game:GetService('Players')" }
	lines[#lines+1] = "Players.PlayerAdded:Connect(function(player)"
	lines[#lines+1] = "\tlocal ls = Instance.new('Folder')"
	lines[#lines+1] = "\tls.Name = 'leaderstats'; ls.Parent = player"
	for _, stat in ipairs(stats) do
		local statName = type(stat) == "string" and stat or tostring(stat.name or "Stat")
		local startVal = type(stat) == "table" and (stat.default or stat.value or 0) or 0
		lines[#lines+1] = ("\tlocal %s = Instance.new('IntValue')"):format(statName)
		lines[#lines+1] = ("\t%s.Name = '%s'"):format(statName, statName)
		lines[#lines+1] = ("\t%s.Value = %d"):format(statName, startVal)
		lines[#lines+1] = ("\t%s.Parent = ls"):format(statName)
	end
	lines[#lines+1] = "end)"
	existing.Source = table.concat(lines, "\n")
	existing.Parent = sss
	return true, nil, existing
end

function Actions.insert_asset(a)
	local _, name, parent, payload = normalizeAction(a)
	local p = resolvePath(parent, true)
	if not p then return false, "bad parent" end
	local assetId = tostring(payload.asset_id or payload.assetId or "")
	if assetId == "" then return false, "missing assetId" end
	local numId = tonumber(assetId:match("%d+"))
	if not numId then return false, "bad assetId" end
	local ok, model = pcall(function() return InsertService:LoadAsset(numId) end)
	if not ok or not model then return false, "InsertService failed: " .. tostring(model) end
	local children = model:GetChildren()
	local placed
	for _, c in ipairs(children) do
		if name and #children == 1 then c.Name = name end
		c.Parent = p
		if c:IsA("BasePart") then c.Anchored = true end
		if not placed then placed = c end
	end
	model:Destroy()
	if placed then appendLog(("Inserted asset %s → %s"):format(assetId, fullPath(placed))) end
	return true, nil, placed
end

function Actions.set_properties(a)
	local _, _, _, payload = normalizeAction(a)
	local path = tostring(payload.path or a.name or "")
	local inst = resolvePath(path, false)
	if not inst then return true, "skipped (not found): " .. path end
	applyProps(inst, payload.properties or {})
	return true
end

function Actions.rename(a)
	local _, _, _, payload = normalizeAction(a)
	local inst = resolvePath(tostring(payload.path or a.name or ""), false)
	if not inst then return true, "skipped" end
	local n = tostring(payload.new_name or payload.newName or "")
	if n == "" then return false, "missing name" end
	inst.Name = n
	return true
end

function Actions.move(a)
	local _, _, _, payload = normalizeAction(a)
	local inst = resolvePath(tostring(payload.path or a.name or ""), false)
	if not inst then return true, "skipped" end
	local par = resolvePath(tostring(payload.new_parent or payload.parent or "Workspace"), true)
	if not par then return false, "bad target" end
	inst.Parent = par
	return true
end

function Actions.delete(a)
	local _, _, _, payload = normalizeAction(a)
	local inst = resolvePath(tostring(payload.path or a.name or ""), false)
	if not inst then return true, "skipped" end
	appendLog("Deleting " .. fullPath(inst))
	inst:Destroy()
	return true
end

function Actions.terrain(a)
	local _, _, _, payload = normalizeAction(a)
	local subKind = tostring(payload.sub or "fill")
	if subKind == "clear" then
		Terrain:Clear(); return true
	end
	local matName = tostring(payload.material or "Grass")
	local mat = Enum.Material[matName] or Enum.Material.Grass
	local cf = CFrame.new(toVector3(payload.cframe or {}))
	local sz = toVector3(payload.size or {x=512,y=8,z=512}, Vector3.new(512,8,512))
	Terrain:FillBlock(cf, sz, mat)
	return true
end

function Actions.setting(a)
	local _, _, _, payload = normalizeAction(a)
	-- Apply a service-level setting (e.g. Workspace.Gravity)
	local svcName = tostring(payload.service or "Workspace")
	local svc = getService(svcName)
	if not svc then return false, "no service: " .. svcName end
	applyProps(svc, payload.properties or {})
	return true
end

function Actions.run_lua(a)
	-- Execute arbitrary Lua via loadstring (Studio only)
	local _, _, _, payload = normalizeAction(a)
	local src = tostring(payload.source or payload.code or "")
	if src == "" then return false, "empty source" end
	local fn, err = loadstring(src)
	if not fn then return false, "syntax error: " .. tostring(err) end
	local ok2, e2 = pcall(fn)
	if not ok2 then return false, "runtime error: " .. tostring(e2) end
	return true
end
Actions.run = Actions.run_lua

function Actions.organize_project(a)
	-- Move Workspace loose parts into organised folders
	local moved = {}
	local protected = { Terrain=true, Camera=true, Map=true, NPCs=true, Props=true, Vehicles=true, Gameplay=true }
	local function wf(n) return ensureFolder(Workspace, n) end
	for _, inst in ipairs(Workspace:GetChildren()) do
		if not protected[inst.Name] then
			local lname = inst.Name:lower()
			local target
			if inst:IsA("SpawnLocation") or lname:find("checkpoint") then target = wf("Gameplay")
			elseif inst:FindFirstChildOfClass("Humanoid") or lname:find("npc") or lname:find("enemy") then target = wf("NPCs")
			elseif lname:find("car") or lname:find("vehicle") or lname:find("boat") then target = wf("Vehicles")
			elseif inst:IsA("Model") or inst:IsA("Folder") then target = wf("Map")
			elseif inst:IsA("BasePart") then target = wf("Props")
			end
			if target then local from = fullPath(inst); inst.Parent = target; table.insert(moved, from) end
		end
	end
	appendLog(("Organized: moved %d items"):format(#moved))
	return true
end

function Actions.autofix_project(a)
	Actions.organize_project(a)
	local fixed = 0
	for _, inst in ipairs(game:GetDescendants()) do
		if inst:IsA("BasePart") and inst.Parent == Workspace and not inst.Anchored then
			inst.Anchored = true; fixed += 1
		end
	end
	appendLog(("Auto-fix: anchored %d loose parts"):format(fixed))
	return true
end

function Actions.scan_project()
	task.spawn(pushSnapshot)
	return true
end

----------------------------------------------------------------
-- DISPATCH
----------------------------------------------------------------
dispatch = function(action)
	-- action from server: { id, kind, name, parent_path, payload }
	local kind = tostring(action.kind or ""):lower():gsub("[%s%-]+", "_")
	if pathIsIgnored(tostring(action.parent_path or "")) then
		statsSkipped += 1; appendLog("Skipped " .. kind .. " (ignore filter)")
		return true
	end
	local fn = Actions[kind]
	if not fn then
		appendLog("Unknown action kind: " .. kind, "warn")
		return false, "unknown: " .. kind
	end
	return fn(action)
end

----------------------------------------------------------------
-- FOCUS CAMERA
----------------------------------------------------------------
focusOn = function(instances)
	if not instances or #instances == 0 then return end
	pcall(function() Selection:Set(instances) end)
	local target
	for _, inst in ipairs(instances) do
		if inst and inst.Parent and (inst:IsA("Model") or inst:IsA("BasePart")) then
			target = inst; break
		end
	end
	if not target then return end
	pcall(function()
		local cam = Workspace.CurrentCamera
		if not cam then return end
		local cf
		if target:IsA("Model") then
			local ok, piv = pcall(function() return target:GetPivot() end)
			if ok then cf = piv end
		else cf = target.CFrame end
		if cf then cam.CFrame = CFrame.new(cf.Position + Vector3.new(20,15,20), cf.Position) end
	end)
end

----------------------------------------------------------------
-- APPLY ACTIONS (build engine)
----------------------------------------------------------------
applyActions = function(actions, sourceLabel)
	if #actions == 0 then return end

	if not RunService:IsEdit() then
		syncVal.Text = "Stop Play mode to apply BloxSmith builds permanently."
		setPill("error"); warn("[BloxSmith] Play mode active — stop it first.")
		-- Report all as failed
		local reports = {}
		for _, a in ipairs(actions) do
			if a.id then table.insert(reports, { action_id=a.id, status="failed", error="Play mode active" }) end
		end
		if #reports > 0 then
			pcall(function() postPlugin("/api/public/plugin/complete", { token=getToken(), results=reports }) end)
		end
		statsErrors += #actions
		return
	end

	setPill("executing")
	local recId
	if ChangeHistoryService.TryBeginRecording then
		recId = ChangeHistoryService:TryBeginRecording("BloxSmith " .. (sourceLabel or "build"), "AI generation")
	else
		ChangeHistoryService:SetWaypoint("BloxSmith pre-build")
	end

	local ok, fail = 0, 0
	local reports, created = {}, {}

	local function flushReports()
		if #reports == 0 then return end
		local payload = reports; reports = {}
		pcall(function()
			postPlugin("/api/public/plugin/complete", {
				token   = getToken(),
				results = payload,
			})
		end)
	end

	local total = #actions
	appendLog(("Applying %d action(s)…"):format(total))
	syncVal.Text = ("Applying 0/%d…"):format(total)

	for idx, a in ipairs(actions) do
		if idx == 1 or idx % APPLY_YIELD_N == 0 or idx == total then
			syncVal.Text = ("Applying %d/%d: %s"):format(idx, total,
				tostring(a.kind or "?") .. " " .. tostring(a.name or a.parent_path or ""))
		end
		local pcOk, success, errOrInst = pcall(dispatch, a)
		local executed = pcOk and success and success ~= false
		local createdInst, errMsg = nil, nil
		if executed then
			if typeof(errOrInst) == "Instance" then createdInst = errOrInst end
		else
			errMsg = pcOk and tostring(errOrInst or "failed") or tostring(success or "error")
		end
		if executed then
			ok += 1
			if createdInst then
				table.insert(created, createdInst)
				if idx == 1 or idx % LIVE_FOCUS_N == 0 then pcall(focusOn, {createdInst}) end
			end
			if a.id then
				local r = { action_id=a.id, status="done" }
				if createdInst then r.result = { path=instancePath(createdInst), name=createdInst.Name } end
				table.insert(reports, r)
			end
		else
			fail += 1
			logLine(("Action failed [%s %s]: %s"):format(tostring(a.kind or "?"), tostring(a.name or ""), tostring(errMsg or "")), "error")
			if a.id then
				table.insert(reports, { action_id=a.id, status="failed", error=errMsg })
			end
		end
		if #reports >= REPORT_FLUSH_N then flushReports() end
		if idx % APPLY_YIELD_N == 0 then task.wait(0.03) end
	end

	flushReports()

	if recId then
		pcall(function() ChangeHistoryService:FinishRecording(recId, Enum.FinishRecordingOperation.Commit) end)
	else
		ChangeHistoryService:SetWaypoint(("BloxSmith built %d (%d failed)"):format(ok, fail))
	end

	if #created > 0 then pcall(focusOn, created) end

	statsApplied += ok; statsErrors += fail; lastSyncAt = os.time()
	pcall(refreshStatsInfo)

	if fail > 0 then setPill("error") else setPill("complete") end
	appendLog(("Build done: %d ok, %d failed"):format(ok, fail))

	syncVal.Text = (("[%s] Built %d action(s)%s — undoable (Ctrl+Z)")):format(
		activeProjectId and "proj" or "?", ok, (fail>0 and (", "..fail.." failed") or ""))

	task.delay(3, function() if connected then setPill("connected") end end)
end

----------------------------------------------------------------
-- WORKSPACE SNAPSHOT
----------------------------------------------------------------
local function snapshotInst(inst)
	local node = {
		id = instanceId(inst), name = inst.Name, className = inst.ClassName,
		path = instancePath(inst),
	}
	if inst:IsA("BasePart") then
		node.size     = { x = inst.Size.X,     y = inst.Size.Y,     z = inst.Size.Z }
		node.position = { x = inst.Position.X, y = inst.Position.Y, z = inst.Position.Z }
		node.material = inst.Material.Name; node.anchored = inst.Anchored
		node.color    = { r = math.floor(inst.Color.R*255), g = math.floor(inst.Color.G*255), b = math.floor(inst.Color.B*255) }
	elseif inst:IsA("LuaSourceContainer") then
		local src = inst.Source or ""
		node.sourcePreview = string.sub(src, 1, 2000); node.sourceLength = #src
	end
	return node
end

local function snapshotChildren(parent, depth, counter)
	local out = {}
	if depth > MAX_DEPTH then return out end
	for _, child in ipairs(parent:GetChildren()) do
		if counter[1] >= MAX_INSTANCES then break end
		counter[1] += 1
		local node = snapshotInst(child)
		local kids = snapshotChildren(child, depth+1, counter)
		if #kids > 0 then node.children = kids end
		table.insert(out, node)
	end
	return out
end

local function computeHash(str)
	local h = 5381
	for i = 1, #str do h = ((h*33) + string.byte(str,i)) % 2147483648 end
	return string.format("%08x", h)
end

local function scanFiles(timeout)
	local files = {}; local deadline = os.clock() + (timeout or SCAN_TIMEOUT)
	local scanned = 0; local timedOut, cancelled = false, false
	local function shouldStop()
		if scanCancelRequested then cancelled = true; return true end
		if os.clock() > deadline then timedOut = true; return true end
		return false
	end
	local function traverse(inst, parentPath)
		if shouldStop() then return end
		scanned += 1
		local curPath = parentPath == "" and inst.Name or (parentPath .. "/" .. inst.Name)
		if pathIsIgnored(curPath) then return end
		local include = inst:IsA("LuaSourceContainer") or inst:IsA("Folder") or inst:IsA("Model")
			or inst:IsA("BasePart") or inst:IsA("Sound") or inst:IsA("RemoteEvent")
			or inst:IsA("RemoteFunction") or inst:IsA("GuiObject") or inst:IsA("Tool")
		if include then
			local node = {
				id = instanceId(inst), name = inst.Name, className = inst.ClassName, path = curPath,
				studioPath = instancePath(inst),
			}
			if inst:IsA("LuaSourceContainer") then
				node.source = inst.Source or ""; node.hash = computeHash(node.source)
			end
			table.insert(files, node)
		end
		for _, child in ipairs(inst:GetChildren()) do
			traverse(child, curPath)
			if timedOut or cancelled then break end
		end
	end
	for _, svcName in ipairs({ "Workspace","ServerScriptService","ServerStorage","ReplicatedStorage","ReplicatedFirst","StarterGui","StarterPack","StarterPlayer","Lighting","Teams" }) do
		if shouldStop() then break end
		local svc = getService(svcName)
		if svc then
			for _, child in ipairs(svc:GetChildren()) do
				traverse(child, svcName)
				if timedOut or cancelled then break end
			end
		end
	end
	return files, { count = scanned, timedOut = timedOut, cancelled = cancelled }
end

pushSnapshot = function()
	if not connected then return end
	if scanInProgress then syncVal.Text = "Scan already running…"; return end
	scanInProgress = true; scanCancelRequested = false
	setPill("scanning"); syncVal.Text = "Scanning project…"; appendLog("Scan started")
	local started = os.clock()
	local files, scan = scanFiles(SCAN_TIMEOUT)
	scanInProgress = false
	if scan.cancelled then
		setPill("connected"); syncVal.Text = "Scan cancelled"; appendLog("Scan cancelled"); return
	end
	if scan.timedOut then
		setPill("connected"); syncVal.Text = ("Paused at %d objects"):format(scan.count)
		appendLog("Scan timed out at " .. scan.count); return
	end
	-- POST to /api/public/plugin/scan
	local data, err = postPlugin("/api/public/plugin/scan", {
		token    = getToken(),
		place_id = tostring(game.PlaceId or 0),
		scan     = files,
	})
	if err then
		setPill("error"); syncVal.Text = "Snapshot error: " .. tostring(err)
		appendLog("Snapshot error: " .. tostring(err))
	else
		setPill("connected")
		syncVal.Text = ("Scanned %d objects in %.1fs"):format(#files, os.clock()-started)
		appendLog("Scan finished: " .. #files .. " objects")
	end
end

----------------------------------------------------------------
-- PREVIEW OVERLAY
----------------------------------------------------------------
local previewOverlay = nil
closePreviewOverlay = function()
	if previewOverlay then previewOverlay:Destroy(); previewOverlay = nil end
end

openPreviewOverlay = function()
	closePreviewOverlay()
	if #pendingPreview == 0 then syncVal.Text = "Nothing pending."; return end
	previewOverlay = Instance.new("Frame", widget)
	previewOverlay.Size = UDim2.fromScale(1,1); previewOverlay.BackgroundColor3 = Color3.new(0,0,0)
	previewOverlay.BackgroundTransparency = 0.25; previewOverlay.BorderSizePixel = 0; previewOverlay.ZIndex = 60

	local box = Instance.new("Frame", previewOverlay)
	box.Size = UDim2.new(1,-24,1,-24); box.Position = UDim2.new(0,12,0,12)
	box.BackgroundColor3 = C.panel; box.BorderSizePixel = 0; box.ZIndex = 61
	corner(box,10); uiStroke(box,C.stroke,1); padAll(box,12)

	local bTitle = Instance.new("TextLabel", box)
	bTitle.BackgroundTransparency=1; bTitle.Size = UDim2.new(1,0,0,22)
	bTitle.Text = ("Preview — %d pending action(s)"):format(#pendingPreview)
	bTitle.Font = Enum.Font.BuilderSansBold; bTitle.TextSize = 14; bTitle.TextColor3 = C.text
	bTitle.TextXAlignment = Enum.TextXAlignment.Left; bTitle.ZIndex = 62

	local pScroll = Instance.new("ScrollingFrame", box)
	pScroll.Position = UDim2.new(0,0,0,30); pScroll.Size = UDim2.new(1,0,1,-80)
	pScroll.BackgroundColor3 = C.bg; pScroll.BorderSizePixel = 0
	pScroll.CanvasSize = UDim2.new(0,0,0,0); pScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
	pScroll.ScrollBarThickness = 4; pScroll.ZIndex = 62; corner(pScroll,6)
	local pList = Instance.new("UIListLayout", pScroll); pList.Padding = UDim.new(0,4)
	padAll(pScroll, 6)

	for _, a in ipairs(pendingPreview) do
		local row = Instance.new("Frame", pScroll)
		row.BackgroundColor3 = C.panel; row.AutomaticSize = Enum.AutomaticSize.Y
		row.Size = UDim2.new(1,-4,0,0); row.BorderSizePixel = 0; row.ZIndex = 63
		corner(row,4); padAll(row,6)
		local lbl = Instance.new("TextLabel", row)
		lbl.BackgroundTransparency=1; lbl.Size = UDim2.new(1,0,0,0); lbl.AutomaticSize = Enum.AutomaticSize.Y
		lbl.Font = Enum.Font.Code; lbl.TextSize = 10; lbl.TextColor3 = C.textDim
		lbl.TextWrapped = true; lbl.TextXAlignment = Enum.TextXAlignment.Left; lbl.ZIndex = 63
		lbl.Text = tostring(a.kind or "?") .. "  " .. tostring(a.name or a.parent_path or "")
	end

	local btnRow = Instance.new("Frame", box)
	btnRow.BackgroundTransparency=1; btnRow.Position = UDim2.new(0,0,1,-44)
	btnRow.Size = UDim2.new(1,0,0,38); btnRow.ZIndex = 62
	local bl = Instance.new("UIListLayout",btnRow); bl.FillDirection = Enum.FillDirection.Horizontal; bl.Padding = UDim.new(0,8)

	local function mkBtn(text, bg, tc)
		local b = Instance.new("TextButton", btnRow)
		b.Size = UDim2.new(0.5,-4,1,0); b.BackgroundColor3 = bg; b.TextColor3 = tc
		b.Font = Enum.Font.BuilderSansBold; b.TextSize = 13; b.Text = text; b.BorderSizePixel = 0
		corner(b,8); return b
	end
	local applyAll   = mkBtn("Apply All ✓", C.success, Color3.new(1,1,1))
	local discardAll = mkBtn("Discard All ✗", C.disconnect, C.error)

	applyAll.MouseButton1Click:Connect(function()
		local batch = pendingPreview; pendingPreview = {}; previewSeenIds = {}
		refreshReviewBtnLabel(); closePreviewOverlay()
		applyActions(batch, "preview-apply")
	end)
	discardAll.MouseButton1Click:Connect(function()
		local reports = {}
		for _, a in ipairs(pendingPreview) do
			if a.id then table.insert(reports, { action_id=a.id, status="failed", error="Discarded in Preview" }) end
		end
		if #reports > 0 then
			pcall(function() postPlugin("/api/public/plugin/complete", { token=getToken(), results=reports }) end)
		end
		pendingPreview = {}; previewSeenIds = {}; refreshReviewBtnLabel(); closePreviewOverlay()
		syncVal.Text = "Preview batch discarded."
	end)
end

----------------------------------------------------------------
-- POLL LOOP — the heartbeat. Called every POLL_SECONDS.
-- POST /api/public/plugin/poll  → server returns pending actions + marks them "sent"
-- Plugin immediately executes them and POSTs results to /complete
----------------------------------------------------------------
local lastPollFingerprint = ""

local function pollOnce()
	if not connected then return end
	if not RunService:IsEdit() then
		syncVal.Text = "Edit mode only — paused during Play Test"; return
	end
	if getPaused() then syncVal.Text = "Paused — incoming actions ignored"; return end

	local data, err = postPlugin("/api/public/plugin/poll", {
		token          = getToken(),
		place_id       = tostring(game.PlaceId or 0),
		studio_version = tostring(version()),
		plugin_version = PLUGIN_VERSION,
		project_id     = (activeProjectId ~= "" and activeProjectId or nil),
	})
	if not data then
		syncVal.Text = "Poll error: " .. tostring(err)
		if not connected then refreshHealthInfo("Disconnected"); updateButtonState() end
		return
	end

	refreshHealthInfo("Poll OK")
	lastSyncAt = os.time(); pcall(refreshStatsInfo)

	-- Update project id from server response if not set yet
	if (not activeProjectId or activeProjectId == "") and data.user_id then
		-- server doesn't return project_id here; it's set at pair time
	end

	local actions = data.actions or {}
	if #actions == 0 then return end

	-- Fingerprint to skip duplicate batches
	local fp = ""
	for _, a in ipairs(actions) do fp = fp .. (a.id or "") .. ";" end
	if fp == lastPollFingerprint then return end
	lastPollFingerprint = fp

	appendLog("Received " .. #actions .. " action(s)")

	if getPreviewMode() then
		local added = 0
		for _, a in ipairs(actions) do
			local key = a.id or (tostring(a.kind)..":"..tostring(a.name)..":"..tostring(a.parent_path))
			if not previewSeenIds[key] then
				previewSeenIds[key] = true; table.insert(pendingPreview, a); added += 1
			end
		end
		refreshReviewBtnLabel()
		if added > 0 then
			syncVal.Text = ("Preview: %d action(s) queued"):format(added)
			setPill("idle"); task.defer(openPreviewOverlay)
		end
		return
	end

	applyActions(actions, "build")
end

----------------------------------------------------------------
-- PAIRING FLOW
-- 1. POST /api/public/plugin/pair/start  → {code, link_url, expires_in}
-- 2. Show link_url in pairLinkBox
-- 3. Poll POST /api/public/plugin/pair/poll {code} until status=="approved"
-- 4. Store plugin_token + project_id, start poll loop
----------------------------------------------------------------
doPairing = function()
	if pairingInProgress then return end
	pairingInProgress = true; pairingCancelled = false
	pairCard.Visible = true; updateButtonState()
	setPill("pairing"); statusVal.Text = "Requesting pairing code…"; appendLog("Requesting pair code")

	local data, err = postPluginRaw("/api/public/plugin/pair/start", {})
	if not data or err then
		pairingInProgress = false; pairCard.Visible = false
		setPill("offline"); statusVal.Text = "Pair start failed: " .. tostring(err)
		appendLog("Pair start failed: " .. tostring(err)); updateButtonState()
		return
	end

	local code    = tostring(data.code    or "")
	local linkUrl = tostring(data.link_url or "")
	if code == "" then
		pairingInProgress = false; pairCard.Visible = false
		setPill("offline"); statusVal.Text = "No pairing code returned"; updateButtonState()
		return
	end

	pairLinkBox.Text     = linkUrl
	pairCodeLabel.Text   = "Code: " .. code
	syncVal.Text         = "Waiting for approval at bloxsmith.pro/link?code=" .. code
	appendLog("Pair link: " .. linkUrl)

	-- Poll for approval
	local deadline = os.clock() + PAIR_TIMEOUT
	task.spawn(function()
		while pairingInProgress and not pairingCancelled and os.clock() < deadline do
			task.wait(PAIR_POLL_SEC)
			if pairingCancelled then break end

			local poll, pollErr = postPluginRaw("/api/public/plugin/pair/poll", { code = code })
			if not poll then
				logLine("Pair poll error: " .. tostring(pollErr), "warn")
			elseif poll.status == "approved" then
				-- Got the token!
				local token = tostring(poll.plugin_token or "")
				local projId = tostring(poll.project_id or "")
				if token ~= "" then
					setToken(token)
					if projId ~= "" then setProjectId(projId); activeProjectId = projId end
					pairingInProgress = false; shouldBeConnected = true; connected = true
					pairCard.Visible = false
					setPill("connected"); updateButtonState()
					statusVal.Text  = "Connected!"
					projectVal.Text = projId ~= "" and ("Project: " .. projId) or "Connected"
					appendLog("Paired successfully! Token saved.")
					refreshHealthInfo("Paired OK")
					-- Immediately do a scan so the AI has context
					task.spawn(pushSnapshot)
				end
				return
			elseif poll.status == "expired" then
				logLine("Pair code expired. Click Connect to try again.", "warn")
				pairingInProgress = false; pairCard.Visible = false
				setPill("offline"); updateButtonState()
				statusVal.Text = "Pair code expired — click Connect again"
				return
			elseif poll.status == "pending" then
				-- still waiting — continue loop
			end
		end

		if pairingInProgress and not pairingCancelled then
			-- Timed out
			pairingInProgress = false; pairCard.Visible = false
			setPill("offline"); updateButtonState()
			statusVal.Text = "Pairing timed out — click Connect again"
			appendLog("Pair timed out after " .. PAIR_TIMEOUT .. "s")
		else
			pairingInProgress = false; pairCard.Visible = false
			setPill("offline"); updateButtonState()
		end
	end)
end

disconnect = function()
	shouldBeConnected = false; connected = false
	pairingInProgress = false; pairingCancelled = true
	pairCard.Visible = false; pairLinkBox.Text = ""
	lastPollFingerprint = ""
	statusVal.Text  = "Not connected"
	syncVal.Text    = "—"
	projectVal.Text = "—"
	setPill("offline"); updateButtonState(); appendLog("Disconnected")
	refreshHealthInfo("Disconnected")
end

doReconnect = function()
	-- If we have a saved token, skip pairing and go straight to polling
	local tok = getToken()
	if tok == "" then
		doPairing(); return
	end
	shouldBeConnected = true; connected = true
	statusVal.Text  = "Reconnecting with saved token…"
	projectVal.Text = getProjectId() ~= "" and ("Project: " .. getProjectId()) or "—"
	activeProjectId = getProjectId()
	setPill("connecting"); updateButtonState()
	appendLog("Reconnecting with saved token…")
	-- Verify the token by doing a poll
	local data, err = postPlugin("/api/public/plugin/poll", {
		token          = tok,
		place_id       = tostring(game.PlaceId or 0),
		studio_version = tostring(version()),
		plugin_version = PLUGIN_VERSION,
		project_id     = (activeProjectId ~= "" and activeProjectId or nil),
	})
	if not data then
		connected = false; shouldBeConnected = false
		setPill("offline"); updateButtonState()
		statusVal.Text = "Token invalid — click Connect to re-pair"
		appendLog("Reconnect failed: " .. tostring(err))
		return
	end
	connected = true
	setPill("connected"); updateButtonState()
	statusVal.Text = "Connected (token verified)"
	appendLog("Reconnected successfully")
	refreshHealthInfo("Reconnected OK")
	task.spawn(pushSnapshot)
end

----------------------------------------------------------------
-- BUTTON WIRING
----------------------------------------------------------------
connectBtn.MouseButton1Click:Connect(function()
	if connected or pairingInProgress then
		disconnect()
	else
		doPairing()
	end
end)

cancelPairBtn.MouseButton1Click:Connect(function()
	pairingCancelled = true; pairingInProgress = false
	pairCard.Visible = false; setPill("offline"); updateButtonState()
	statusVal.Text = "Pairing cancelled"; appendLog("Pairing cancelled by user")
end)

syncNowBtn.MouseButton1Click:Connect(function()
	if not connected then appendLog("Not connected — sync cancelled"); return end
	task.spawn(pollOnce)
	task.spawn(pushSnapshot)
end)

scanBtn.MouseButton1Click:Connect(function()
	if not connected then appendLog("Connect first before scanning"); return end
	task.spawn(pushSnapshot)
end)

clearQueueBtn.MouseButton1Click:Connect(function()
	if getToken() == "" then appendLog("Not connected"); return end
	local data, err = postPlugin("/api/public/plugin/clear", {
		token      = getToken(),
		project_id = (activeProjectId ~= "" and activeProjectId or nil),
	})
	if data then
		local n = data.cleared or 0
		appendLog(("Cleared %d stuck action(s) from queue"):format(n))
		syncVal.Text = ("Queue cleared — %d action(s) removed"):format(n)
	else
		appendLog("Clear failed: " .. tostring(err))
	end
end)

reconnectBtn.MouseButton1Click:Connect(function()
	disconnect()
	task.defer(doReconnect)
end)

organizeBtn.MouseButton1Click:Connect(function()
	ChangeHistoryService:SetWaypoint("BloxSmith organize start")
	local ok, result = pcall(function() return Actions.organize_project({}) end)
	ChangeHistoryService:SetWaypoint("BloxSmith organize done")
	if ok then appendLog("Organize complete")
	else appendLog("Organize error: " .. tostring(result)) end
end)

autoFixBtn.MouseButton1Click:Connect(function()
	ChangeHistoryService:SetWaypoint("BloxSmith auto-fix start")
	local ok, result = pcall(function() return Actions.autofix_project({}) end)
	ChangeHistoryService:SetWaypoint("BloxSmith auto-fix done")
	if ok then appendLog("Auto-fix complete")
	else appendLog("Auto-fix error: " .. tostring(result)) end
end)

pauseBtn.MouseButton1Click:Connect(function()
	setPaused(not getPaused())
	pauseBtn.Text = getPaused() and "▶  Resume sync" or "⏸  Pause sync"
	appendLog(getPaused() and "Sync paused" or "Sync resumed")
end)

previewBtn.MouseButton1Click:Connect(function()
	setPreviewMode(not getPreviewMode())
	previewBtn.Text = getPreviewMode() and "🔍  Preview Mode: ON" or "🔍  Preview Mode: OFF"
	if not getPreviewMode() and #pendingPreview > 0 then
		local batch = pendingPreview; pendingPreview = {}; previewSeenIds = {}
		refreshReviewBtnLabel(); applyActions(batch, "preview-off")
	end
end)

reviewBtn.MouseButton1Click:Connect(openPreviewOverlay)

----------------------------------------------------------------
-- BACKGROUND LOOPS
----------------------------------------------------------------

-- Main poll loop
task.spawn(function()
	while true do
		task.wait(POLL_SECONDS)
		if connected then pcall(pollOnce) end
	end
end)

-- Auto-reconnect if token saved but not connected
task.spawn(function()
	while true do
		task.wait(5)
		if shouldBeConnected and not connected and not pairingInProgress then
			appendLog("Auto-reconnecting…")
			pcall(doReconnect)
		end
	end
end)

-- React to workspace changes (prompt a fresh scan)
local lastWorkspaceChange = 0
Workspace.DescendantAdded:Connect(function()
	if connected then lastWorkspaceChange = os.time() end
end)
Workspace.DescendantRemoving:Connect(function()
	if connected then lastWorkspaceChange = os.time() end
end)

-- Periodic re-scan if workspace changed (debounced 30s)
task.spawn(function()
	while true do
		task.wait(30)
		if connected and lastWorkspaceChange > 0 and (os.time() - lastWorkspaceChange) > 25 and not scanInProgress then
			lastWorkspaceChange = 0
			pcall(pushSnapshot)
		end
	end
end)

----------------------------------------------------------------
-- AUTO CONNECT on load if token exists
----------------------------------------------------------------
if getToken() ~= "" then
	shouldBeConnected = true
	task.defer(doReconnect)
end

print(string.format("[BloxSmith] Ultimate v%s ready — click BloxSmith in the PLUGINS tab.", PLUGIN_VERSION))
appendLog("BloxSmith Ultimate v" .. PLUGIN_VERSION .. " loaded.")
appendLog("API: " .. API_BASE)
appendLog("Place: " .. tostring(game.PlaceId or 0))
