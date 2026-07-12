import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const CLOCK_REFRESH_MS = 250;
const MARKET_REFRESH_SECONDS = 900;
const IDLE_SCREEN_SECONDS = 30 * 60;
const IDLE_ANIMATION_SECONDS = 12;
const CLOCK_SIZE = 198;
const DOCK_WIDTH = 92;
const DOCK_EDGE_REVEAL_WIDTH = 34;
const DOCK_PEEK_WIDTH = 14;
const DOCK_ICON_SIZE = 38;
const FOLDER_ICON_SIZE = 34;
const DOCK_WAVE_RADIUS = 118;
const DOCK_WAVE_SCALE = 0.28;
const DOCK_DRAG_THRESHOLD = 12;
const DOCK_CLUSTER_HEIGHT = 76;
const DOCK_VERTICAL_PADDING = 40;
const DOCK_MIN_HEIGHT = 220;
const OVERVIEW_FALLBACK_WIDGET_SCALE = 0.78;
const OVERVIEW_FALLBACK_TRANSLATION_Y = 54;
const BACKGROUND_WORKSPACE_INDEX = 0;
const STOCK_CONFIG_DIR = 'desktop-lab-v12';
const STOCK_SYMBOLS_FILE = 'market-symbols.json';
const DOCK_GROUPS_FILE = 'dock-groups.json';
const TAU = Math.PI * 2;

const DOCK_GROUPS = [
    {
        label: 'Write',
        icon: 'accessories-text-editor-symbolic',
        actions: [
            {
                kind: 'app',
                id: 'org.gnome.TextEditor.desktop',
                fallbackIds: ['org.gnome.gedit.desktop'],
                name: 'Text Editor',
                icon: 'accessories-text-editor-symbolic',
            },
        ],
    },
    {
        label: 'Code',
        icon: 'utilities-terminal-symbolic',
        actions: [
            {
                kind: 'app',
                id: 'org.gnome.Ptyxis.desktop',
                fallbackIds: ['org.gnome.Terminal.desktop', 'com.raggesilver.BlackBox.desktop'],
                name: 'Terminal',
                icon: 'utilities-terminal-symbolic',
            },
            {
                kind: 'app',
                id: 'org.gnome.Nautilus.desktop',
                fallbackIds: ['org.gnome.Files.desktop'],
                name: 'Files',
                icon: 'system-file-manager-symbolic',
            },
        ],
    },
    {
        label: 'Web',
        icon: 'web-browser-symbolic',
        actions: [
            {
                kind: 'app',
                id: 'org.mozilla.firefox.desktop',
                fallbackIds: ['firefox.desktop', 'org.gnome.Epiphany.desktop'],
                name: 'Firefox',
                icon: 'web-browser-symbolic',
            },
            {
                kind: 'app',
                id: 'google-chrome.desktop',
                fallbackIds: ['chromium-browser.desktop', 'org.chromium.Chromium.desktop'],
                name: 'Chrome',
                icon: 'web-browser-symbolic',
            },
        ],
    },
    {
        label: 'System',
        icon: 'org.gnome.Settings-symbolic',
        actions: [
            {
                kind: 'app',
                id: 'org.gnome.Settings.desktop',
                fallbackIds: ['gnome-control-center.desktop'],
                name: 'Settings',
                icon: 'org.gnome.Settings-symbolic',
            },
            {
                kind: 'app',
                id: 'org.gnome.clocks.desktop',
                fallbackIds: ['org.gnome.Clocks.desktop'],
                name: 'Clocks',
                icon: 'org.gnome.clocks-symbolic',
            },
        ],
    },
    {
        label: 'Apps',
        icon: 'view-app-grid-symbolic',
        actions: [
            {
                kind: 'overview-apps',
                name: 'Show Applications',
                icon: 'view-app-grid-symbolic',
            },
            {
                kind: 'dock-editor',
                name: 'Edit Dock',
                icon: 'document-edit-symbolic',
            },
        ],
    },
];

const DEFAULT_MARKET_SYMBOLS = ['SPY', 'QQQ', 'NVDA', 'AAPL'];
const MARKET_PRESET_SYMBOLS = ['SPY', 'QQQ', 'NVDA', 'AAPL'];

const MARKET_FETCH_SCRIPT = `
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

symbols = json.loads(sys.argv[1])
config_home = pathlib.Path(os.environ.get("XDG_CONFIG_HOME") or pathlib.Path.home() / ".config")
key_file = config_home / "desktop-lab-v12" / "alpha-vantage-key"
api_key = os.environ.get("DESKTOP_LAB_ALPHA_VANTAGE_KEY", "").strip()
if not api_key and key_file.exists():
    api_key = key_file.read_text(encoding="utf-8").strip()

def format_price(value):
    return f"{float(value):.2f}" if value is not None else "--"

def fetch_alpha_vantage(symbol):
    url = "https://www.alphavantage.co/query?" + urllib.parse.urlencode({
        "function": "GLOBAL_QUOTE",
        "symbol": symbol,
        "apikey": api_key,
    })
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "desktop-lab-v126/1.0 (+https://local-only.invalid)"}
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8", "replace"))

    quote = payload.get("Global Quote") or {}
    price = quote.get("05. price")
    if not price:
        raise RuntimeError(payload.get("Note") or payload.get("Information") or "empty Alpha Vantage quote")

    return {"close": format_price(price)}

def fetch_yahoo_chart(symbol):
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urllib.parse.quote(symbol)}?range=1d&interval=1d"
    )
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "desktop-lab-v126/1.0 (+https://local-only.invalid)"}
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8", "replace"))

    result = (payload.get("chart", {}).get("result") or [{}])[0]
    meta = result.get("meta", {})
    price = meta.get("regularMarketPrice")
    if price is None:
        closes = ((result.get("indicators", {}).get("quote") or [{}])[0].get("close") or [])
        price = next((value for value in reversed(closes) if value is not None), None)

    return {"close": format_price(price)}

try:
    quotes = {}
    for symbol in symbols:
        quote = None
        if api_key:
            try:
                quote = fetch_alpha_vantage(symbol)
            except Exception:
                quote = None

        if quote is None:
            quote = fetch_yahoo_chart(symbol)

        quotes[symbol] = quote

    print(json.dumps({"ok": True, "quotes": quotes}))
except Exception as error:
    print(json.dumps({"ok": False, "message": str(error)}))
`;

export default class DesktopLabV12Extension extends Extension {
    enable() {
        this._appSystem = Shell.AppSystem.get_default();
        this._timeouts = [];
        this._signals = [];
        this._backgroundActors = [];
        this._backgroundFallbackActors = [];
        this._hiddenBatteryActors = [];
        this._quoteLabels = new Map();
        this._marketRows = new Map();
        this._marketSymbols = this._loadMarketSymbols();
        this._dockGroups = this._loadDockGroups();
        this._marketFetchInFlight = false;
        this._idleVisible = false;
        this._idleAnimationStep = 0;
        this._idleTimeoutId = 0;
        this._idleMonitor = null;
        this._idleWatchId = 0;
        this._userActiveWatchId = 0;
        this._usesCoreIdleMonitor = false;
        this._lastActivityUsec = 0;
        this._dockButtons = [];
        this._dockClusters = [];
        this._dockDrag = null;
        this._dockRevealed = false;
        this._dockPinnedByCluster = false;
        this._dockShownX = 0;
        this._dockHiddenTranslationX = 0;
        this._dockTop = 0;
        this._dockBottom = 0;
        this._suppressNextDockClick = false;
        this._activeFolderGroup = null;
        this._activeFolderCluster = null;
        this._overviewWidgetsScaled = false;
        this._overviewWidgetContainer = null;
        this._overviewWidgetsEmbedded = false;
        this._overviewIsHiding = false;
        this._overviewStateAdjustment = Main.overview?._overview?.controls?._stateAdjustment ?? null;

        this._buildDock();
        this._buildFolderFlyout();
        this._buildDockEditor();
        this._buildBackgroundWidgetLayer();
        this._buildClock();
        this._buildMarketPanel();
        this._buildStockChooser();
        this._buildIdleOverlay();
        this._syncLayout();
        this._syncWorkspaceVisibility();
        this._updateClock();
        this._refreshMarketQuotes();
        this._startIdleWatch();
        this._tryHideBatteryIcon();

        this._signals.push([
            Main.layoutManager,
            Main.layoutManager.connect('monitors-changed', () => this._syncLayout()),
        ]);
        this._signals.push([
            global.workspace_manager,
            global.workspace_manager.connect('active-workspace-changed', () => this._syncWorkspaceVisibility()),
        ]);
        this._signals.push([
            global.stage,
            global.stage.connect('captured-event', (_actor, event) => this._handleCapturedEvent(event)),
        ]);
        this._signals.push([
            global.display,
            global.display.connect('in-fullscreen-changed', () => this._syncFullscreenDockVisibility()),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('showing', () => this._enterOverviewWidgetMode()),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('shown', () => this._enterOverviewWidgetMode(false)),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('hiding', () => this._beginOverviewWidgetExit()),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('hidden', () => this._leaveOverviewWidgetMode()),
        ]);
        if (this._overviewStateAdjustment) {
            this._signals.push([
                this._overviewStateAdjustment,
                this._overviewStateAdjustment.connect(
                    'notify::value',
                    () => this._handleOverviewStateChanged()
                ),
            ]);
        }

        this._addMillisecondTimeout(CLOCK_REFRESH_MS, () => {
            this._updateClock();
            return GLib.SOURCE_CONTINUE;
        });
        this._addTimeout(MARKET_REFRESH_SECONDS, () => {
            this._refreshMarketQuotes();
            return GLib.SOURCE_CONTINUE;
        });
        this._addTimeout(IDLE_ANIMATION_SECONDS, () => {
            this._animateIdleScreen();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        for (const [object, signalId] of this._signals ?? [])
            object.disconnect(signalId);
        this._signals = [];

        for (const timeoutId of this._timeouts ?? [])
            GLib.source_remove(timeoutId);
        this._timeouts = [];

        this._clearIdleWatch();
        this._restoreBatteryActors();
        this._destroyChrome(this._dock);
        this._destroyChrome(this._folderFlyout);
        this._destroyChrome(this._dockRevealZone);
        this._destroyChrome(this._dockEditor);
        this._destroyDesktopActor(this._backgroundWidgetLayer);
        this._destroyDesktopActor(this._stockChooser);
        this._destroyChrome(this._idleOverlay);

        this._dock = null;
        this._dockRevealZone = null;
        this._folderFlyout = null;
        this._folderTitleLabel = null;
        this._folderItems = null;
        this._dockEditor = null;
        this._dockEditorGroupEntry = null;
        this._dockEditorIconEntry = null;
        this._dockEditorAppIdEntry = null;
        this._dockEditorAppNameEntry = null;
        this._dockEditorItems = null;
        this._backgroundWidgetLayer = null;
        this._clockPanel = null;
        this._clockFace = null;
        this._clockTimeLabel = null;
        this._clockDateLabel = null;
        this._marketPanel = null;
        this._marketRowsContainer = null;
        this._stockChooser = null;
        this._stockEntry = null;
        this._stockPresetItems = null;
        this._stockItems = null;
        this._idleOverlay = null;
        this._idleCanvas = null;
        this._idleClockLabel = null;
        this._appSystem = null;
        this._quoteLabels = null;
        this._marketRows = null;
        this._marketSymbols = null;
        this._dockGroups = null;
        this._idleMonitor = null;
        this._dockButtons = null;
        this._dockClusters = null;
        this._dockDrag = null;
        this._dockPinnedByCluster = false;
        this._backgroundActors = null;
        this._backgroundFallbackActors = null;
        this._overviewWidgetsScaled = false;
        this._overviewWidgetContainer = null;
        this._overviewWidgetsEmbedded = false;
        this._overviewIsHiding = false;
        this._overviewStateAdjustment = null;
    }

    _addTimeout(seconds, callback) {
        const timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            seconds,
            callback
        );
        this._timeouts.push(timeoutId);
        return timeoutId;
    }

    _addMillisecondTimeout(milliseconds, callback) {
        const timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            milliseconds,
            callback
        );
        this._timeouts.push(timeoutId);
        return timeoutId;
    }

    _removeTimeout(timeoutId) {
        if (!timeoutId)
            return;

        GLib.source_remove(timeoutId);
        this._timeouts = this._timeouts.filter(id => id !== timeoutId);
    }

    _addDesktopActor(actor) {
        const backgroundGroup = Main.layoutManager?._backgroundGroup;
        if (backgroundGroup?.add_child) {
            backgroundGroup.add_child(actor);
            this._backgroundActors.push(actor);
            if (typeof actor.raise_top === 'function')
                actor.raise_top();
            return;
        }

        Main.layoutManager.addChrome(actor, {
            affectsStruts: false,
            trackFullscreen: false,
        });
        this._backgroundFallbackActors.push(actor);
    }

    _reparentDesktopActor(actor, container) {
        if (!actor || !container?.add_child || actor.get_parent?.() === container)
            return false;

        if (this._backgroundFallbackActors?.includes(actor)) {
            try {
                Main.layoutManager.removeChrome(actor);
            } catch (error) {
                actor.get_parent?.()?.remove_child(actor);
            }
        } else {
            actor.get_parent?.()?.remove_child(actor);
        }

        container.add_child(actor);
        if (typeof actor.raise_top === 'function')
            actor.raise_top();
        return true;
    }

    _restoreDesktopActor(actor) {
        if (!actor)
            return;

        actor.get_parent?.()?.remove_child(actor);
        if (this._backgroundActors?.includes(actor)) {
            const backgroundGroup = Main.layoutManager?._backgroundGroup;
            if (backgroundGroup?.add_child) {
                backgroundGroup.add_child(actor);
                actor.raise_top?.();
                return;
            }
        }

        Main.layoutManager.addChrome(actor, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _destroyDesktopActor(actor) {
        if (!actor)
            return;

        if (this._backgroundFallbackActors?.includes(actor)) {
            try {
                Main.layoutManager.removeChrome(actor);
            } catch (error) {
                logError(error, 'Could not remove desktop lab fallback chrome actor');
            }
        } else {
            try {
                actor.get_parent()?.remove_child(actor);
            } catch (error) {
                logError(error, 'Could not remove desktop lab background actor');
            }
        }

        actor.destroy();
    }

    _buildDock() {
        this._dockRevealZone = new St.Widget({
            reactive: true,
            track_hover: true,
            style_class: 'desktop-lab-v12-dock-reveal-zone',
        });
        this._dockRevealZone.connect('enter-event', () => {
            this._showDock();
            return Clutter.EVENT_PROPAGATE;
        });

        this._dock = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            opacity: 210,
            style_class: 'desktop-lab-v12-dock',
        });
        this._dock.connect('enter-event', () => {
            return Clutter.EVENT_PROPAGATE;
        });
        this._dock.connect('leave-event', () => {
            this._resetDockWave();
            return Clutter.EVENT_PROPAGATE;
        });

        this._rebuildDockGroups();

        Main.layoutManager.addChrome(this._dockRevealZone, {
            affectsStruts: false,
            trackFullscreen: false,
        });
        Main.layoutManager.addChrome(this._dock, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _rebuildDockGroups() {
        if (!this._dock)
            return;

        this._hideClusterFolder();
        this._dock.destroy_all_children();
        this._dockButtons = [];
        this._dockClusters = [];

        for (const group of this._dockGroups ?? DOCK_GROUPS) {
            const cluster = new St.BoxLayout({
                vertical: true,
                reactive: true,
                track_hover: true,
                style_class: 'desktop-lab-v12-cluster',
            });

            cluster.add_child(this._createDockFolderButton(group, cluster));

            this._dockClusters.push(cluster);
            this._dock.add_child(cluster);
        }

        this._syncLayout();
    }

    _buildFolderFlyout() {
        this._folderFlyout = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            visible: false,
            opacity: 0,
            style_class: 'desktop-lab-v12-folder-flyout',
        });
        this._folderTitleLabel = new St.Label({
            text: '',
            style_class: 'desktop-lab-v12-folder-title',
        });
        this._folderItems = new St.BoxLayout({
            vertical: true,
            style_class: 'desktop-lab-v12-folder-items',
        });

        this._folderFlyout.add_child(this._folderItems);

        Main.layoutManager.addChrome(this._folderFlyout, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _buildDockEditor() {
        this._dockEditor = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            visible: false,
            opacity: 0,
            style_class: 'desktop-lab-v12-dock-editor',
        });

        const groupRow = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-dock-editor-row',
        });
        this._dockEditorGroupEntry = this._createPanelEntry('Group', 'desktop-lab-v12-dock-editor-entry');
        this._dockEditorIconEntry = this._createPanelEntry('Icon', 'desktop-lab-v12-dock-editor-entry desktop-lab-v12-dock-editor-entry-small');
        groupRow.add_child(this._dockEditorGroupEntry);
        groupRow.add_child(this._dockEditorIconEntry);

        const appRow = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-dock-editor-row',
        });
        this._dockEditorAppIdEntry = this._createPanelEntry('App .desktop ID', 'desktop-lab-v12-dock-editor-entry');
        this._dockEditorAppNameEntry = this._createPanelEntry('Name', 'desktop-lab-v12-dock-editor-entry desktop-lab-v12-dock-editor-entry-small');
        const addButton = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'Add dock item',
            style_class: 'desktop-lab-v12-dock-editor-add',
        });
        addButton.set_child(new St.Icon({
            icon_name: 'list-add-symbolic',
            icon_size: 16,
        }));
        addButton.connect('clicked', () => this._addDockEditorItem());
        appRow.add_child(this._dockEditorAppIdEntry);
        appRow.add_child(this._dockEditorAppNameEntry);
        appRow.add_child(addButton);

        this._dockEditorItems = new St.BoxLayout({
            vertical: true,
            style_class: 'desktop-lab-v12-dock-editor-items',
        });

        this._dockEditor.add_child(groupRow);
        this._dockEditor.add_child(appRow);
        this._dockEditor.add_child(this._dockEditorItems);
        this._rebuildDockEditorItems();

        Main.layoutManager.addChrome(this._dockEditor, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _createPanelEntry(hintText, styleClass) {
        return new St.Entry({
            can_focus: true,
            hint_text: hintText,
            style_class: styleClass,
        });
    }

    _buildBackgroundWidgetLayer() {
        this._backgroundWidgetLayer = new Clutter.Actor({
            reactive: false,
            x_expand: true,
            y_expand: true,
        });
        this._addDesktopActor(this._backgroundWidgetLayer);
    }

    _buildClock() {
        this._clockPanel = new St.BoxLayout({
            vertical: true,
            reactive: false,
            style_class: 'desktop-lab-v12-clock-panel',
        });

        this._clockFace = new St.DrawingArea({
            style_class: 'desktop-lab-v12-clock-face',
        });
        this._clockFace.set_size(CLOCK_SIZE, CLOCK_SIZE);
        this._clockFace.connect('repaint', area => this._drawClockFace(area));

        this._clockTimeLabel = new St.Label({style_class: 'desktop-lab-v12-clock-time'});
        this._clockDateLabel = new St.Label({style_class: 'desktop-lab-v12-subtle'});

        this._clockPanel.add_child(this._clockFace);
        this._clockPanel.add_child(this._clockTimeLabel);
        this._clockPanel.add_child(this._clockDateLabel);

        this._backgroundWidgetLayer.add_child(this._clockPanel);
    }

    _buildMarketPanel() {
        this._marketPanel = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            style_class: 'desktop-lab-v12-market-panel',
        });

        const header = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-market-header',
        });
        header.add_child(new St.Label({
            text: 'Market',
            style_class: 'desktop-lab-v12-market-title',
        }));
        const configureButton = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'Choose stocks',
            style_class: 'desktop-lab-v12-market-configure',
        });
        configureButton.set_child(new St.Icon({
            icon_name: 'list-add-symbolic',
            icon_size: 14,
        }));
        configureButton.connect('clicked', () => this._toggleStockChooser());
        header.add_child(configureButton);
        this._marketPanel.add_child(header);

        this._marketRowsContainer = new St.BoxLayout({
            vertical: true,
            style_class: 'desktop-lab-v12-market-rows',
        });
        this._marketPanel.add_child(this._marketRowsContainer);
        this._rebuildMarketRows();

        this._backgroundWidgetLayer.add_child(this._marketPanel);
    }

    _buildStockChooser() {
        this._stockChooser = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            visible: false,
            opacity: 0,
            style_class: 'desktop-lab-v12-stock-chooser',
        });

        const entryRow = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-stock-entry-row',
        });
        this._stockEntry = new St.Entry({
            can_focus: true,
            hint_text: 'Symbol',
            style_class: 'desktop-lab-v12-stock-entry',
        });
        this._stockEntry.clutter_text.connect('activate', () => this._addMarketSymbolFromEntry());
        const addButton = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'Add stock',
            style_class: 'desktop-lab-v12-stock-icon-button',
        });
        addButton.set_child(new St.Icon({
            icon_name: 'list-add-symbolic',
            icon_size: 16,
        }));
        addButton.connect('clicked', () => this._addMarketSymbolFromEntry());
        entryRow.add_child(this._stockEntry);
        entryRow.add_child(addButton);

        this._stockPresetItems = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-stock-presets',
        });
        for (const symbol of MARKET_PRESET_SYMBOLS)
            this._stockPresetItems.add_child(this._createStockPresetButton(symbol));

        this._stockItems = new St.BoxLayout({
            vertical: true,
            style_class: 'desktop-lab-v12-stock-items',
        });

        this._stockChooser.add_child(entryRow);
        this._stockChooser.add_child(this._stockPresetItems);
        this._stockChooser.add_child(this._stockItems);
        this._rebuildStockChooserItems();
        this._addDesktopActor(this._stockChooser);
    }

    _createStockPresetButton(symbol) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            label: symbol,
            accessible_name: `Add ${symbol}`,
            style_class: 'desktop-lab-v12-stock-preset-button',
        });
        button.connect('clicked', () => this._addMarketSymbol(symbol));
        return button;
    }

    _buildIdleOverlay() {
        this._idleOverlay = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            visible: false,
            style_class: 'desktop-lab-v12-idle-overlay',
        });

        this._idleCanvas = new St.DrawingArea({
            x_expand: true,
            y_expand: true,
            style_class: 'desktop-lab-v12-idle-canvas',
        });
        this._idleCanvas.connect('repaint', area => this._drawIdleBackground(area));

        const content = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'desktop-lab-v12-idle-content',
        });
        this._idleClockLabel = new St.Label({style_class: 'desktop-lab-v12-idle-clock'});
        content.add_child(this._idleClockLabel);
        content.add_child(new St.Label({
            text: 'Rest',
            style_class: 'desktop-lab-v12-idle-subtitle',
        }));

        this._idleOverlay.add_child(this._idleCanvas);
        this._idleOverlay.add_child(content);
        this._idleOverlay.connect('button-press-event', () => {
            this._hideIdleScreen();
            this._resetIdleTimer();
            return Clutter.EVENT_PROPAGATE;
        });

        Main.layoutManager.addChrome(this._idleOverlay, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _createDockFolderButton(group, cluster) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: `${group.label} folder`,
            style_class: 'desktop-lab-v12-app-button desktop-lab-v12-folder-trigger',
        });
        button.set_pivot_point(0.5, 0.5);

        button.set_child(new St.Icon({
            icon_name: group.icon,
            icon_size: DOCK_ICON_SIZE,
        }));
        button.connect('button-press-event', (_actor, event) => {
            this._beginDockDrag(group, cluster, button, event);
            return Clutter.EVENT_PROPAGATE;
        });
        button.connect('clicked', () => {
            if (this._suppressNextDockClick) {
                this._suppressNextDockClick = false;
                return;
            }

            this._toggleClusterFolder(group, cluster);
        });

        this._dockButtons.push(button);
        return button;
    }

    _createFolderButton(action) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: action.name,
            style_class: 'desktop-lab-v12-folder-button',
        });

        const app = this._lookupAppForAction(action);
        button.set_child(app
            ? app.create_icon_texture(FOLDER_ICON_SIZE)
            : new St.Icon({icon_name: action.icon, icon_size: FOLDER_ICON_SIZE}));
        button.connect('clicked', () => {
            this._runAction(action);
            this._hideClusterFolder();
        });
        return button;
    }

    _lookupAppForAction(action) {
        for (const appId of [action.id, ...(action.fallbackIds ?? [])]) {
            if (!appId)
                continue;

            const app = this._appSystem.lookup_app(appId);
            if (app)
                return app;
        }

        return null;
    }

    _toggleClusterFolder(group, cluster) {
        this._dockPinnedByCluster = true;
        this._showDock();

        if (this._activeFolderGroup === group && this._folderFlyout?.visible) {
            this._hideClusterFolder();
            return;
        }

        this._showClusterFolder(group, cluster);
    }

    _showClusterFolder(group, cluster) {
        if (!this._folderFlyout || !this._folderItems)
            return;

        this._activeFolderGroup = group;
        this._activeFolderCluster = cluster;
        this._folderTitleLabel.text = group.label;
        this._folderItems.destroy_all_children();

        for (const action of group.actions)
            this._folderItems.add_child(this._createFolderButton(action));

        this._positionFolderFlyout();
        this._folderFlyout.show();
        this._folderFlyout.ease({
            opacity: 255,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _positionFolderFlyout() {
        if (!this._folderFlyout || !this._activeFolderCluster)
            return;

        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const panelHeight = Main.panel?.height ?? 0;
        const contentTop = monitor.y + panelHeight;
        const [clusterX, clusterY] = this._activeFolderCluster.get_transformed_position();
        const [, clusterHeight] = this._activeFolderCluster.get_transformed_size();
        const flyoutWidth = 98;
        const flyoutHeight = Math.max(76, this._folderFlyout.height || 120);
        const targetY = Math.floor(clusterY + (clusterHeight / 2) - (flyoutHeight / 2));
        const maxY = monitor.y + monitor.height - flyoutHeight - 18;

        this._folderFlyout.set_width(flyoutWidth);
        this._folderFlyout.set_position(
            Math.min(clusterX + DOCK_WIDTH + 18, monitor.x + monitor.width - flyoutWidth - 18),
            Math.max(contentTop + 18, Math.min(targetY, maxY))
        );
    }

    _hideClusterFolder() {
        this._activeFolderGroup = null;
        this._activeFolderCluster = null;
        if (!this._folderFlyout)
            return;

        this._folderFlyout.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._folderFlyout?.hide(),
        });
    }

    _beginDockDrag(group, cluster, button, event) {
        const [x, y] = event.get_coords();
        this._dockDrag = {
            group,
            cluster,
            button,
            startX: x,
            startY: y,
            dragging: false,
        };
        this._suppressNextDockClick = false;
    }

    _handleDockDragMotion(event) {
        if (!this._dockDrag)
            return false;

        const [x, y] = event.get_coords();
        const drag = this._dockDrag;
        const distance = Math.hypot(x - drag.startX, y - drag.startY);

        if (!drag.dragging) {
            if (distance < DOCK_DRAG_THRESHOLD)
                return false;

            drag.dragging = true;
            drag.cluster.add_style_class_name('desktop-lab-v12-cluster-dragging');
            this._hideClusterFolder();
        }

        this._reorderDockClusterForY(drag.cluster, y);
        return true;
    }

    _finishDockDrag(event) {
        if (!this._dockDrag)
            return false;

        const drag = this._dockDrag;
        if (drag.dragging) {
            const [, y] = event.get_coords();
            this._reorderDockClusterForY(drag.cluster, y);
            drag.cluster.remove_style_class_name('desktop-lab-v12-cluster-dragging');
            this._suppressNextDockClick = true;
        }

        this._dockDrag = null;
        return drag.dragging;
    }

    _reorderDockClusterForY(cluster, y) {
        if (!this._dock || !this._dockClusters?.length)
            return;

        const currentIndex = this._dockClusters.indexOf(cluster);
        if (currentIndex < 0)
            return;

        let targetIndex = this._dockClusters.length - 1;
        for (let index = 0; index < this._dockClusters.length; index++) {
            const candidate = this._dockClusters[index];
            const [, candidateY] = candidate.get_transformed_position();
            const [, candidateHeight] = candidate.get_transformed_size();
            if (y < candidateY + candidateHeight / 2) {
                targetIndex = index;
                break;
            }
        }

        if (targetIndex === currentIndex)
            return;

        this._dockClusters.splice(currentIndex, 1);
        this._dockClusters.splice(targetIndex, 0, cluster);
        this._dock.set_child_at_index(cluster, targetIndex);
        this._positionFolderFlyout();
    }

    _showDock() {
        if (!this._dock || this._dockRevealed || this._isDockMonitorFullscreen())
            return;

        this._dockRevealed = true;
        this._dock.ease({
            translation_x: 0,
            opacity: 255,
            duration: 480,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });
    }

    _hideDock() {
        if (!this._dock || !this._dockRevealed || this._dockDrag || this._dockEditor?.visible)
            return;

        this._dockRevealed = false;
        this._dockPinnedByCluster = false;
        this._hideClusterFolder();
        this._resetDockWave();
        this._dock.ease({
            translation_x: this._dockHiddenTranslationX,
            opacity: 210,
            duration: 380,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });
    }

    _handleDockRevealMotion(x, y) {
        if (this._isDockMonitorFullscreen()) {
            this._syncFullscreenDockVisibility();
            return;
        }

        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const panelHeight = Main.panel?.height ?? 0;
        const contentTop = monitor.y + panelHeight;
        if (x <= monitor.x + DOCK_EDGE_REVEAL_WIDTH &&
            y >= this._dockTop && y <= this._dockBottom) {
            this._showDock();
            return;
        }

        if (!this._dockRevealed)
            return;

        if (this._dockPinnedByCluster)
            return;

        if (this._pointInsideActor(this._dock, x, y, 14) ||
            this._pointInsideActor(this._folderFlyout, x, y, 14) ||
            this._pointInsideActor(this._dockEditor, x, y, 14))
            return;

        if (x > monitor.x + DOCK_WIDTH + 90 || y < contentTop || y > monitor.y + monitor.height)
            this._hideDock();
    }

    _isDockMonitorFullscreen() {
        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return false;

        try {
            if (typeof global.display.get_monitor_in_fullscreen === 'function')
                return global.display.get_monitor_in_fullscreen(monitor.index ?? 0);
        } catch (error) {
            logError(error, 'Could not query monitor fullscreen state');
        }

        const focusedWindow = global.display.focus_window;
        return Boolean(focusedWindow?.is_fullscreen?.() &&
            focusedWindow.get_monitor?.() === (monitor.index ?? 0));
    }

    _syncFullscreenDockVisibility() {
        const fullscreen = this._isDockMonitorFullscreen();
        this._dockRevealZone?.set_visible(!fullscreen);

        if (!fullscreen) {
            this._dock?.show();
            return;
        }

        this._dockDrag = null;
        this._dockPinnedByCluster = false;
        this._hideDockEditor();
        this._hideClusterFolder();
        this._resetDockWave();
        this._dockRevealed = false;
        this._dock?.remove_all_transitions();
        if (this._dock) {
            this._dock.translation_x = this._dockHiddenTranslationX;
            this._dock.opacity = 210;
            this._dock.hide();
        }
    }

    _updateDockWave(x, y) {
        if (!this._dockRevealed || !this._dockButtons?.length)
            return;

        if (!this._pointInsideActor(this._dock, x, y, DOCK_WAVE_RADIUS)) {
            this._resetDockWave();
            return;
        }

        for (const button of this._dockButtons) {
            const [, buttonY] = button.get_transformed_position();
            const [, buttonHeight] = button.get_transformed_size();
            const centerY = buttonY + buttonHeight / 2;
            const distance = Math.abs(y - centerY);
            const influence = Math.max(0, 1 - distance / DOCK_WAVE_RADIUS);
            const scale = 1 + DOCK_WAVE_SCALE * influence * influence;

            button.ease({
                scale_x: scale,
                scale_y: scale,
                translation_x: 8 * influence,
                duration: 90,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    _resetDockWave() {
        for (const button of this._dockButtons ?? []) {
            button.ease({
                scale_x: 1,
                scale_y: 1,
                translation_x: 0,
                duration: 140,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    _pointInsideActor(actor, x, y, padding = 0) {
        if (!actor?.visible)
            return false;

        const [actorX, actorY] = actor.get_transformed_position();
        const [actorWidth, actorHeight] = actor.get_transformed_size();
        return x >= actorX - padding &&
            x <= actorX + actorWidth + padding &&
            y >= actorY - padding &&
            y <= actorY + actorHeight + padding;
    }

    _hideFolderIfPointerOutside(x, y) {
        if (!this._folderFlyout?.visible)
            return;

        if (this._pointInsideActor(this._dock, x, y, 8) ||
            this._pointInsideActor(this._folderFlyout, x, y, 8))
            return;

        this._hideClusterFolder();
    }

    _runAction(action) {
        if (action.kind === 'overview-apps') {
            this._showApplications();
            return;
        }

        if (action.kind === 'dock-editor') {
            this._toggleDockEditor();
            return;
        }

        const app = this._lookupAppForAction(action);
        if (app) {
            app.open_new_window(-1);
            return;
        }

        Main.notify('Desktop Lab', `${action.name} is not installed in this VM.`);
    }

    _showApplications() {
        try {
            if (typeof Main.overview.showApps === 'function') {
                Main.overview.showApps();
                return;
            }

            Main.overview.show();
            const controls = Main.overview._overview?.controls;
            if (typeof controls?._toggleAppsPage === 'function')
                controls._toggleAppsPage();
            else if (typeof controls?.showApps === 'function')
                controls.showApps();
        } catch (error) {
            logError(error, 'Could not show application grid');
        }
    }

    _toggleDockEditor() {
        if (this._dockEditor?.visible) {
            this._hideDockEditor();
            return;
        }

        this._showDockEditor();
    }

    _showDockEditor() {
        if (!this._dockEditor)
            return;

        this._showDock();
        this._rebuildDockEditorItems();
        this._positionDockEditor();
        this._dockEditor.show();
        this._dockEditor.ease({
            opacity: 255,
            duration: 140,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _hideDockEditor() {
        if (!this._dockEditor)
            return;

        this._dockEditor.ease({
            opacity: 0,
            duration: 110,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._dockEditor?.hide(),
        });
    }

    _positionDockEditor() {
        if (!this._dockEditor)
            return;

        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const panelHeight = Main.panel?.height ?? 0;
        const editorWidth = Math.max(316, Math.min(360, monitor.width - 180));
        const editorHeight = Math.max(210, this._dockEditor.height || 250);
        this._dockEditor.set_width(editorWidth);
        this._dockEditor.set_position(
            Math.min(this._dockShownX + DOCK_WIDTH + 18, monitor.x + monitor.width - editorWidth - 18),
            Math.min(monitor.y + panelHeight + 88, monitor.y + monitor.height - editorHeight - 18)
        );
    }

    _rebuildDockEditorItems() {
        if (!this._dockEditorItems)
            return;

        this._dockEditorItems.destroy_all_children();
        for (const group of this._dockGroups ?? [])
            this._dockEditorItems.add_child(this._createDockEditorGroupRow(group));
    }

    _createDockEditorGroupRow(group) {
        const row = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-dock-editor-group-row',
        });
        row.add_child(new St.Label({
            text: `${group.label} ${group.actions?.length ?? 0}`,
            style_class: 'desktop-lab-v12-dock-editor-group-label',
        }));

        const removeButton = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: `Remove ${group.label}`,
            style_class: 'desktop-lab-v12-dock-editor-remove',
        });
        removeButton.set_child(new St.Icon({
            icon_name: 'edit-delete-symbolic',
            icon_size: 13,
        }));
        removeButton.connect('clicked', () => this._removeDockEditorGroup(group.label));
        row.add_child(removeButton);
        return row;
    }

    _addDockEditorItem() {
        const groupLabel = this._cleanDockText(this._getEntryText(this._dockEditorGroupEntry), 18);
        if (!groupLabel)
            return;

        const iconName = this._cleanIconName(this._getEntryText(this._dockEditorIconEntry));
        const appId = this._cleanDesktopId(this._getEntryText(this._dockEditorAppIdEntry));
        const appName = this._cleanDockText(this._getEntryText(this._dockEditorAppNameEntry), 28);
        let group = (this._dockGroups ?? []).find(item => item.label.toLowerCase() === groupLabel.toLowerCase());

        if (!group) {
            group = {
                label: groupLabel,
                icon: iconName || 'folder-symbolic',
                actions: [],
            };
            this._dockGroups.push(group);
        } else if (iconName) {
            group.icon = iconName;
        }

        if (appId && !group.actions.some(action => action.id === appId)) {
            group.actions.push({
                kind: 'app',
                id: appId,
                name: appName || appId.replace(/\.desktop$/, ''),
                icon: iconName || 'application-x-executable-symbolic',
            });
        }

        this._saveDockGroups();
        this._setEntryText(this._dockEditorAppIdEntry, '');
        this._setEntryText(this._dockEditorAppNameEntry, '');
        this._rebuildDockGroups();
        this._rebuildDockEditorItems();
        this._positionDockEditor();
    }

    _removeDockEditorGroup(label) {
        if (!this._dockGroups || this._dockGroups.length <= 1)
            return;

        this._dockGroups = this._dockGroups.filter(group => group.label !== label);
        this._saveDockGroups();
        this._rebuildDockGroups();
        this._rebuildDockEditorItems();
        this._positionDockEditor();
    }

    _loadDockGroups() {
        const defaults = this._cloneDockGroups(DOCK_GROUPS);
        const path = this._stockConfigPath(DOCK_GROUPS_FILE);

        try {
            const [ok, contents] = GLib.file_get_contents(path);
            if (!ok)
                return defaults;

            const groups = JSON.parse(new TextDecoder().decode(contents));
            if (!Array.isArray(groups))
                return defaults;

            const cleaned = groups
                .map(group => this._sanitizeDockGroup(group))
                .filter(group => group);
            return cleaned.length > 0 ? cleaned : defaults;
        } catch (error) {
            return defaults;
        }
    }

    _saveDockGroups() {
        try {
            const path = this._stockConfigPath(DOCK_GROUPS_FILE);
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
            GLib.file_set_contents(path, `${JSON.stringify(this._dockGroups, null, 2)}\n`);
        } catch (error) {
            logError(error, 'Could not save desktop lab dock groups');
        }
    }

    _cloneDockGroups(groups) {
        return groups.map(group => ({
            label: group.label,
            icon: group.icon,
            actions: (group.actions ?? []).map(action => ({
                ...action,
                fallbackIds: action.fallbackIds ? [...action.fallbackIds] : undefined,
            })),
        }));
    }

    _sanitizeDockGroup(group) {
        const label = this._cleanDockText(group?.label, 18);
        if (!label)
            return null;

        const actions = Array.isArray(group?.actions)
            ? group.actions
                .map(action => this._sanitizeDockAction(action))
                .filter(action => action)
            : [];

        return {
            label,
            icon: this._cleanIconName(group?.icon) || 'folder-symbolic',
            actions,
        };
    }

    _sanitizeDockAction(action) {
        if (action?.kind === 'overview-apps' || action?.kind === 'dock-editor') {
            return {
                kind: action.kind,
                name: this._cleanDockText(action.name, 28) || action.name,
                icon: this._cleanIconName(action.icon) || 'application-x-executable-symbolic',
            };
        }

        const id = this._cleanDesktopId(action?.id);
        if (!id)
            return null;

        return {
            kind: 'app',
            id,
            fallbackIds: Array.isArray(action?.fallbackIds)
                ? action.fallbackIds.map(item => this._cleanDesktopId(item)).filter(item => item)
                : undefined,
            name: this._cleanDockText(action?.name, 28) || id.replace(/\.desktop$/, ''),
            icon: this._cleanIconName(action?.icon) || 'application-x-executable-symbolic',
        };
    }

    _cleanDockText(value, maxLength) {
        return String(value ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, maxLength);
    }

    _cleanIconName(value) {
        const icon = String(value ?? '').trim();
        return /^[A-Za-z0-9._-]{1,96}$/.test(icon) ? icon : '';
    }

    _cleanDesktopId(value) {
        let id = String(value ?? '').trim();
        if (!id)
            return '';

        if (!id.endsWith('.desktop'))
            id = `${id}.desktop`;

        return /^[A-Za-z0-9._-]+\.desktop$/.test(id) ? id : '';
    }

    _getEntryText(entry) {
        return entry?.get_text?.() ??
            entry?.clutter_text?.get_text?.() ??
            entry?.clutter_text?.text ??
            '';
    }

    _setEntryText(entry, text) {
        if (typeof entry?.set_text === 'function')
            entry.set_text(text);
        else if (typeof entry?.clutter_text?.set_text === 'function')
            entry.clutter_text.set_text(text);
        else if (entry?.clutter_text)
            entry.clutter_text.text = text;
    }

    _stockConfigPath(fileName) {
        return GLib.build_filenamev([
            GLib.get_user_config_dir(),
            STOCK_CONFIG_DIR,
            fileName,
        ]);
    }

    _loadMarketSymbols() {
        const path = this._stockConfigPath(STOCK_SYMBOLS_FILE);
        try {
            const [ok, contents] = GLib.file_get_contents(path);
            if (!ok)
                return [...DEFAULT_MARKET_SYMBOLS];

            const symbols = JSON.parse(new TextDecoder().decode(contents));
            const cleaned = Array.isArray(symbols)
                ? symbols
                    .map(symbol => this._sanitizeMarketSymbol(symbol))
                    .filter(symbol => symbol)
                : [];
            return cleaned.length > 0 ? [...new Set(cleaned)] : [...DEFAULT_MARKET_SYMBOLS];
        } catch (error) {
            return [...DEFAULT_MARKET_SYMBOLS];
        }
    }

    _saveMarketSymbols() {
        try {
            const path = this._stockConfigPath(STOCK_SYMBOLS_FILE);
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
            GLib.file_set_contents(path, `${JSON.stringify(this._marketSymbols, null, 2)}\n`);
        } catch (error) {
            logError(error, 'Could not save desktop lab market symbols');
        }
    }

    _sanitizeMarketSymbol(value) {
        const symbol = String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
        if (!/^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(symbol))
            return null;

        return symbol;
    }

    _rebuildMarketRows() {
        if (!this._marketRowsContainer || !this._quoteLabels)
            return;

        this._marketRowsContainer.destroy_all_children();
        this._quoteLabels.clear();
        this._marketRows.clear();

        for (const symbol of this._marketSymbols) {
            const row = new St.BoxLayout({
                vertical: false,
                style_class: 'desktop-lab-v12-market-row',
            });
            row.add_child(new St.Label({
                text: symbol,
                style_class: 'desktop-lab-v12-market-symbol',
            }));

            const value = new St.Label({
                text: '--',
                style_class: 'desktop-lab-v12-market-value',
            });
            row.add_child(value);
            this._quoteLabels.set(symbol, value);
            this._marketRows.set(symbol, row);
            this._marketRowsContainer.add_child(row);
        }
    }

    _toggleStockChooser() {
        if (this._stockChooser?.visible) {
            this._hideStockChooser();
            return;
        }

        this._showStockChooser();
    }

    _showStockChooser() {
        if (!this._stockChooser || this._getActiveWorkspaceIndex() !== BACKGROUND_WORKSPACE_INDEX)
            return;

        this._rebuildStockChooserItems();
        this._positionStockChooser();
        this._stockChooser.show();
        this._stockChooser.ease({
            opacity: 255,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _hideStockChooser() {
        if (!this._stockChooser)
            return;

        this._stockChooser.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._stockChooser?.hide(),
        });
    }

    _positionStockChooser() {
        if (!this._stockChooser || !this._marketPanel)
            return;

        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const [marketX, marketY] = this._marketPanel.get_transformed_position();
        const [marketWidth] = this._marketPanel.get_transformed_size();
        const chooserWidth = Math.max(210, marketWidth);
        const chooserHeight = Math.max(132, this._stockChooser.height || 170);

        this._stockChooser.set_width(chooserWidth);
        this._stockChooser.set_position(
            Math.min(marketX, monitor.x + monitor.width - chooserWidth - 18),
            Math.min(marketY + this._marketPanel.height + 10, monitor.y + monitor.height - chooserHeight - 18)
        );
    }

    _rebuildStockChooserItems() {
        if (!this._stockItems)
            return;

        this._stockItems.destroy_all_children();
        for (const symbol of this._marketSymbols)
            this._stockItems.add_child(this._createStockChooserRow(symbol));
    }

    _createStockChooserRow(symbol) {
        const row = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-stock-row',
        });
        row.add_child(new St.Label({
            text: symbol,
            style_class: 'desktop-lab-v12-stock-symbol',
        }));

        const removeButton = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: `Remove ${symbol}`,
            style_class: 'desktop-lab-v12-stock-icon-button',
        });
        removeButton.set_child(new St.Icon({
            icon_name: 'edit-delete-symbolic',
            icon_size: 14,
        }));
        removeButton.connect('clicked', () => this._removeMarketSymbol(symbol));
        row.add_child(removeButton);
        return row;
    }

    _addMarketSymbolFromEntry() {
        const symbol = this._sanitizeMarketSymbol(this._getEntryText(this._stockEntry));
        if (!symbol)
            return;

        this._addMarketSymbol(symbol);
        this._setEntryText(this._stockEntry, '');
    }

    _addMarketSymbol(symbol) {
        symbol = this._sanitizeMarketSymbol(symbol);
        if (!symbol)
            return;

        if (!this._marketSymbols.includes(symbol))
            this._marketSymbols.push(symbol);

        this._saveMarketSymbols();
        this._rebuildMarketRows();
        this._rebuildStockChooserItems();
        this._positionStockChooser();
        this._refreshMarketQuotes();
    }

    _removeMarketSymbol(symbol) {
        if (this._marketSymbols.length <= 1)
            return;

        this._marketSymbols = this._marketSymbols.filter(item => item !== symbol);
        this._saveMarketSymbols();
        this._rebuildMarketRows();
        this._rebuildStockChooserItems();
        this._positionStockChooser();
        this._refreshMarketQuotes();
    }

    _getActiveWorkspaceIndex() {
        try {
            return global.workspace_manager?.get_active_workspace?.()?.index?.() ?? BACKGROUND_WORKSPACE_INDEX;
        } catch (error) {
            return BACKGROUND_WORKSPACE_INDEX;
        }
    }

    _syncWorkspaceVisibility() {
        const visible = this._getActiveWorkspaceIndex() === BACKGROUND_WORKSPACE_INDEX;

        if (this._clockPanel)
            this._clockPanel.visible = visible;
        if (this._marketPanel)
            this._marketPanel.visible = visible;
        if (!visible)
            this._hideStockChooser();
    }

    _getOverviewWorkspaceBackgroundBin() {
        if (this._getActiveWorkspaceIndex() !== BACKGROUND_WORKSPACE_INDEX)
            return null;

        const display = Main.overview?._overview?.controls?._workspacesDisplay;
        const primaryIndex = Main.layoutManager.primaryIndex ?? 0;
        const primaryView = display?._workspacesViews?.[primaryIndex];
        const workspace = primaryView?.getActiveWorkspace?.();
        if (workspace?.metaWorkspace?.index?.() !== BACKGROUND_WORKSPACE_INDEX)
            return null;

        return workspace?._background?._bin ?? null;
    }

    _enterOverviewWidgetMode(animate = true) {
        if (this._overviewWidgetContainer)
            return;

        this._overviewIsHiding = false;
        this._overviewWidgetsScaled = true;
        this._hideStockChooser();

        const workspaceBackground = this._getOverviewWorkspaceBackgroundBin();
        const container = workspaceBackground ?? Main.layoutManager?.overviewGroup;
        if (!container)
            return;

        this._overviewWidgetContainer = container;
        this._overviewWidgetsEmbedded = !!workspaceBackground;
        this._reparentDesktopActor(this._backgroundWidgetLayer, container);

        this._syncLayout();
        this._setBackgroundWidgetTransform(
            this._backgroundWidgetLayer,
            !this._overviewWidgetsEmbedded,
            animate
        );
    }

    _beginOverviewWidgetExit() {
        this._overviewIsHiding = true;
        this._hideStockChooser();
        if (!this._overviewStateAdjustment)
            this._leaveOverviewWidgetMode();
    }

    _handleOverviewStateChanged() {
        if (this._overviewIsHiding && this._overviewStateAdjustment?.value <= 0.001)
            this._leaveOverviewWidgetMode();
    }

    _leaveOverviewWidgetMode() {
        if (!this._overviewWidgetContainer) {
            this._overviewIsHiding = false;
            this._overviewWidgetsScaled = false;
            this._overviewWidgetsEmbedded = false;
            return;
        }

        this._restoreDesktopActor(this._backgroundWidgetLayer);

        this._overviewWidgetContainer = null;
        this._overviewWidgetsEmbedded = false;
        this._overviewWidgetsScaled = false;
        this._overviewIsHiding = false;
        this._setBackgroundWidgetTransform(this._backgroundWidgetLayer, false, false);
        this._syncLayout();
    }

    _setBackgroundWidgetTransform(actor, inOverview, animate) {
        if (!actor)
            return;

        actor.set_pivot_point(0.5, 0);
        const scale = inOverview ? OVERVIEW_FALLBACK_WIDGET_SCALE : 1;
        const translationY = inOverview ? OVERVIEW_FALLBACK_TRANSLATION_Y : 0;

        if (!animate) {
            actor.scale_x = scale;
            actor.scale_y = scale;
            actor.translation_y = translationY;
            return;
        }

        actor.ease({
            scale_x: scale,
            scale_y: scale,
            translation_y: translationY,
            duration: 220,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _syncLayout() {
        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const panelHeight = Main.panel?.height ?? 0;
        const contentTop = monitor.y + panelHeight;
        const availableHeight = monitor.height - panelHeight;
        const clusterCount = Math.max(1, this._dockClusters?.length ?? 1);
        const desiredDockHeight = clusterCount * DOCK_CLUSTER_HEIGHT + DOCK_VERTICAL_PADDING;
        const dockHeight = Math.min(
            Math.max(DOCK_MIN_HEIGHT, desiredDockHeight),
            Math.max(1, availableHeight - 56)
        );
        const dockY = contentTop + Math.max(28, Math.floor((availableHeight - dockHeight) / 2));
        const marketWidth = Math.max(238, Math.min(292, monitor.width - 220));
        const clockWidth = 236;
        const widgetLayerX = this._overviewWidgetsEmbedded ? 0 : monitor.x;
        const widgetLayerY = this._overviewWidgetsEmbedded ? 0 : monitor.y;

        this._dockShownX = monitor.x + 14;
        this._dockHiddenTranslationX = -(DOCK_WIDTH + 14 - DOCK_PEEK_WIDTH);
        this._dockTop = dockY;
        this._dockBottom = dockY + dockHeight;
        this._dock?.set_position(this._dockShownX, dockY);
        this._dock?.set_size(DOCK_WIDTH, dockHeight);
        if (this._dock)
            this._dock.translation_x = this._dockRevealed ? 0 : this._dockHiddenTranslationX;
        this._dockRevealZone?.set_position(monitor.x, dockY);
        this._dockRevealZone?.set_size(DOCK_EDGE_REVEAL_WIDTH, dockHeight);

        this._backgroundWidgetLayer?.set_position(widgetLayerX, widgetLayerY);
        this._backgroundWidgetLayer?.set_size(monitor.width, monitor.height);
        this._clockPanel?.set_position(
            Math.floor((monitor.width - clockWidth) / 2),
            panelHeight + 18
        );
        this._clockPanel?.set_size(clockWidth, 252);

        this._marketPanel?.set_position(
            monitor.width - marketWidth - 24,
            panelHeight + 36
        );
        this._marketPanel?.set_width(marketWidth);
        this._positionFolderFlyout();
        this._positionStockChooser();
        this._positionDockEditor();
        this._setBackgroundWidgetTransform(
            this._backgroundWidgetLayer,
            this._overviewWidgetsScaled && !this._overviewWidgetsEmbedded,
            false
        );

        this._idleOverlay?.set_position(monitor.x, monitor.y);
        this._idleOverlay?.set_size(monitor.width, monitor.height);
        this._idleCanvas?.set_size(monitor.width, monitor.height);
    }

    _updateClock() {
        const now = GLib.DateTime.new_now_local();

        if (this._clockTimeLabel)
            this._clockTimeLabel.text = now.format('%H:%M');
        if (this._clockDateLabel)
            this._clockDateLabel.text = this._formatMonthDay(now);
        if (this._idleClockLabel)
            this._idleClockLabel.text = now.format('%H:%M');
        this._clockFace?.queue_repaint();
    }

    _formatMonthDay(now) {
        return `${now.format('%B')} ${now.get_day_of_month()}`;
    }

    _drawClockFace(area) {
        const [width, height] = area.get_surface_size();
        const cr = area.get_context();

        try {
            const now = GLib.DateTime.new_now_local();
            const hour = Number(now.format('%H')) % 12;
            const second = Number(now.format('%S')) + now.get_microsecond() / 1_000_000;
            const minute = Number(now.format('%M')) + second / 60;
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.max(1, Math.min(width, height) / 2 - 3);

            cr.setSourceRGBA(1.0, 1.0, 1.0, 0.035);
            cr.arc(centerX, centerY, radius, 0, TAU);
            cr.fill();

            cr.setLineWidth(2.4);
            cr.setSourceRGBA(0.96, 0.96, 0.97, 0.82);
            cr.arc(centerX, centerY, radius, 0, TAU);
            cr.stroke();

            cr.setSourceRGBA(0.96, 0.96, 0.97, 0.62);
            for (let hourIndex = 0; hourIndex < 12; hourIndex++) {
                const tickAngle = (hourIndex / 12) * TAU - Math.PI / 2;
                cr.arc(
                    centerX + Math.cos(tickAngle) * (radius * 0.84),
                    centerY + Math.sin(tickAngle) * (radius * 0.84),
                    2.2,
                    0,
                    TAU
                );
                cr.fill();
            }

            const minuteAngle = (minute / 60) * TAU - Math.PI / 2;
            const hourAngle = ((hour + minute / 60) / 12) * TAU - Math.PI / 2;

            cr.setSourceRGBA(0.96, 0.96, 0.97, 0.95);
            cr.setLineWidth(5.2);
            cr.moveTo(centerX, centerY);
            cr.lineTo(
                centerX + Math.cos(hourAngle) * (radius * 0.48),
                centerY + Math.sin(hourAngle) * (radius * 0.48)
            );
            cr.stroke();

            cr.setLineWidth(3.0);
            cr.moveTo(centerX, centerY);
            cr.lineTo(
                centerX + Math.cos(minuteAngle) * (radius * 0.72),
                centerY + Math.sin(minuteAngle) * (radius * 0.72)
            );
            cr.stroke();

            cr.setSourceRGBA(0.96, 0.96, 0.97, 0.95);
            cr.arc(centerX, centerY, 4.4, 0, TAU);
            cr.fill();
        } finally {
            cr.$dispose();
        }
    }

    _refreshMarketQuotes() {
        if (this._marketFetchInFlight || !this._quoteLabels)
            return;

        this._marketFetchInFlight = true;

        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['/usr/bin/python3', '-c', MARKET_FETCH_SCRIPT, JSON.stringify(this._marketSymbols)],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (error) {
            this._setMarketError(error.message);
            this._marketFetchInFlight = false;
            return;
        }

        proc.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                if (!subprocess.get_successful()) {
                    this._setMarketError((stderr || stdout || '').trim());
                    return;
                }

                const payload = JSON.parse(stdout.trim());
                if (!payload.ok) {
                    this._setMarketError(payload.message || 'offline');
                    return;
                }

                for (const [symbol, quote] of Object.entries(payload.quotes ?? {})) {
                    if (!this._quoteLabels)
                        return;

                    const label = this._quoteLabels.get(symbol);
                    if (label)
                        label.text = quote.close ?? '--';
                }

            } catch (error) {
                this._setMarketError(error.message);
            } finally {
                this._marketFetchInFlight = false;
            }
        });
    }

    _setMarketError(message) {
        for (const value of this._quoteLabels?.values() ?? [])
            value.text = '--';
    }

    _handleCapturedEvent(event) {
        const type = event.type();
        if (type === Clutter.EventType.MOTION) {
            const [x, y] = event.get_coords();
            this._handleDockRevealMotion(x, y);
            this._updateDockWave(x, y);
            if (this._handleDockDragMotion(event))
                return Clutter.EVENT_STOP;
        } else if (type === Clutter.EventType.BUTTON_PRESS) {
            const [x, y] = event.get_coords();
            this._hideFolderIfPointerOutside(x, y);
            if (this._dockPinnedByCluster &&
                !this._pointInsideActor(this._dock, x, y) &&
                !this._pointInsideActor(this._folderFlyout, x, y) &&
                !this._pointInsideActor(this._dockEditor, x, y))
                this._hideDock();
        } else if (type === Clutter.EventType.BUTTON_RELEASE) {
            if (this._finishDockDrag(event))
                return Clutter.EVENT_STOP;
        }

        if (type === Clutter.EventType.MOTION ||
            type === Clutter.EventType.BUTTON_PRESS ||
            type === Clutter.EventType.BUTTON_RELEASE ||
            type === Clutter.EventType.KEY_PRESS ||
            type === Clutter.EventType.TOUCH_BEGIN ||
            type === Clutter.EventType.TOUCH_UPDATE ||
            type === Clutter.EventType.SCROLL) {
            if (this._usesCoreIdleMonitor) {
                if (this._idleVisible) {
                    this._hideIdleScreen();
                    this._startIdleWatch();
                }

                return Clutter.EVENT_PROPAGATE;
            }

            const nowUsec = GLib.get_monotonic_time();
            if (!this._idleVisible && nowUsec - this._lastActivityUsec < 2_000_000)
                return Clutter.EVENT_PROPAGATE;

            this._lastActivityUsec = nowUsec;
            if (this._idleVisible)
                this._hideIdleScreen();
            this._resetIdleTimer();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _startIdleWatch() {
        this._clearIdleWatch();
        this._usesCoreIdleMonitor = false;

        try {
            const monitor = global.backend?.get_core_idle_monitor?.();
            if (monitor?.add_idle_watch && monitor?.remove_watch) {
                this._idleMonitor = monitor;
                this._usesCoreIdleMonitor = true;
                this._idleWatchId = monitor.add_idle_watch(IDLE_SCREEN_SECONDS * 1000, () => {
                    this._idleWatchId = 0;
                    this._showIdleScreen();
                    this._armUserActiveWatch();
                });
                return;
            }
        } catch (error) {
            logError(error, 'Could not start GNOME idle monitor watch');
        }

        this._resetIdleTimer();
    }

    _armUserActiveWatch() {
        if (!this._idleMonitor?.add_user_active_watch || this._userActiveWatchId)
            return;

        this._userActiveWatchId = this._idleMonitor.add_user_active_watch(() => {
            this._userActiveWatchId = 0;
            this._hideIdleScreen();
            this._startIdleWatch();
        });
    }

    _clearIdleWatch() {
        if (!this._idleMonitor)
            return;

        for (const watchId of [this._idleWatchId, this._userActiveWatchId]) {
            if (!watchId)
                continue;

            try {
                this._idleMonitor.remove_watch(watchId);
            } catch (error) {
                logError(error, 'Could not remove GNOME idle monitor watch');
            }
        }

        this._idleWatchId = 0;
        this._userActiveWatchId = 0;
        this._idleMonitor = null;
        this._usesCoreIdleMonitor = false;
    }

    _resetIdleTimer() {
        if (this._usesCoreIdleMonitor)
            return;

        this._removeTimeout(this._idleTimeoutId);
        this._idleTimeoutId = this._addTimeout(IDLE_SCREEN_SECONDS, () => {
            const timeoutId = this._idleTimeoutId;
            this._timeouts = this._timeouts.filter(id => id !== timeoutId);
            this._showIdleScreen();
            this._idleTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _showIdleScreen() {
        this._idleVisible = true;
        this._updateClock();
        this._idleOverlay?.show();
        this._idleCanvas?.queue_repaint();
    }

    _hideIdleScreen() {
        this._idleVisible = false;
        this._idleOverlay?.hide();
    }

    _animateIdleScreen() {
        if (!this._idleVisible)
            return;

        this._idleAnimationStep += 1;
        this._idleCanvas?.queue_repaint();
        this._updateClock();
    }

    _drawIdleBackground(area) {
        const [width, height] = area.get_surface_size();
        const cr = area.get_context();

        try {
            const step = this._idleAnimationStep;
            cr.setSourceRGB(0.015, 0.11, 0.18);
            cr.paint();

            cr.setLineWidth(1.0);
            for (let i = -6; i < 18; i++) {
                const y = ((i * 82) + (step * 11)) % (height + 220) - 110;
                const alpha = 0.025 + ((i % 4) * 0.012);
                cr.setSourceRGBA(0.80, 0.93, 0.98, alpha);
                cr.moveTo(-80, y);
                cr.lineTo(width + 80, y - 120);
                cr.stroke();
            }

            cr.setLineWidth(1.6);
            for (let i = 0; i < 5; i++) {
                const x = ((i * 260) + (step * 17)) % (width + 280) - 140;
                cr.setSourceRGBA(0.92, 0.98, 1.0, 0.045);
                cr.moveTo(x, 0);
                cr.lineTo(x + 110, height);
                cr.stroke();
            }
        } finally {
            cr.$dispose();
        }
    }

    _tryHideBatteryIcon() {
        const quickSettings = Main.panel.statusArea.quickSettings;
        const candidates = [
            quickSettings?._system?._indicator?._powerToggle,
            quickSettings?._system?._indicator?._powerIndicator,
            quickSettings?._system?._powerToggle,
            quickSettings?._system?._powerIndicator,
            quickSettings?._system?._batteryItem,
            quickSettings?._system?._powerItem,
        ];

        for (const candidate of candidates)
            this._hideActor(candidate);
    }

    _hideActor(candidate) {
        const actor = candidate?.actor ?? candidate;
        if (!actor || this._hiddenBatteryActors.includes(actor))
            return;

        if (typeof actor.hide === 'function') {
            this._hiddenBatteryActors.push(actor);
            actor.hide();
        }
    }

    _restoreBatteryActors() {
        for (const actor of this._hiddenBatteryActors ?? []) {
            if (typeof actor.show === 'function')
                actor.show();
        }
        this._hiddenBatteryActors = [];
    }

    _destroyChrome(actor) {
        if (!actor)
            return;

        try {
            Main.layoutManager.removeChrome(actor);
        } catch (error) {
            logError(error, 'Could not remove desktop lab chrome actor');
        }

        actor.destroy();
    }
}
