import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const CLOCK_REFRESH_MS = 500;
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
const BACKGROUND_WORKSPACE_INDEX = 0;
const STOCK_CONFIG_DIR = 'desktop-lab-v12';
const STOCK_SYMBOLS_FILE = 'market-symbols.json';
const DOCK_GROUPS_FILE = 'dock-groups.json';
const TAU = Math.PI * 2;

const GROUP_ICON_PALETTE = [
    ['Write', 'accessories-text-editor-symbolic'],
    ['Development', 'applications-development-symbolic'],
    ['Web', 'web-browser-symbolic'],
    ['Media', 'applications-multimedia-symbolic'],
    ['Games', 'applications-games-symbolic'],
    ['Communication', 'user-available-symbolic'],
    ['Files', 'system-file-manager-symbolic'],
    ['Utilities', 'applications-utilities-symbolic'],
    ['Settings', 'org.gnome.Settings-symbolic'],
    ['Folder', 'folder-symbolic'],
];

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

const DEFAULT_MARKET_INSTRUMENTS = [
    {provider: 'twelve-data', symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca', currency: 'USD'},
    {provider: 'twelve-data', symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ', currency: 'USD'},
    {provider: 'twelve-data', symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', currency: 'USD'},
    {provider: 'twelve-data', symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', currency: 'USD'},
];

export default class DesktopLabV12Extension extends Extension {
    enable() {
        this._enabled = true;
        this._asyncGeneration = 1;
        this._appSystem = Shell.AppSystem.get_default();
        this._timeouts = [];
        this._signals = [];
        this._backgroundActors = [];
        this._backgroundFallbackActors = [];
        this._hiddenBatteryActors = [];
        this._quoteLabels = new Map();
        this._marketRows = new Map();
        this._marketInstruments = this._loadMarketInstruments();
        this._dockGroups = this._loadDockGroups();
        this._marketFetchInFlight = false;
        this._marketSearchGeneration = 0;
        this._selectedDockGroupIndex = 0;
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
        this._focusedDockWindow = null;
        this._focusedDockWindowSignals = [];
        this._suppressNextDockClick = false;
        this._activeFolderGroup = null;
        this._activeFolderCluster = null;

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
            Main.layoutManager.connect('monitors-changed', () => {
                this._syncLayout();
                this._syncDockSuppressionVisibility();
            }),
        ]);
        this._signals.push([
            global.workspace_manager,
            global.workspace_manager.connect('active-workspace-changed', () => {
                this._syncWorkspaceVisibility();
                this._watchFocusedDockWindow();
            }),
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
            global.display,
            global.display.connect('notify::focus-window', () => this._watchFocusedDockWindow()),
        ]);
        this._watchFocusedDockWindow();
        this._signals.push([
            Main.overview,
            Main.overview.connect('showing', () => this._setBackgroundWidgetsVisible(false)),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('shown', () => this._setBackgroundWidgetsVisible(false, false)),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('hiding', () => this._setBackgroundWidgetsVisible(false, false)),
        ]);
        this._signals.push([
            Main.overview,
            Main.overview.connect('hidden', () => this._syncWorkspaceVisibility()),
        ]);

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
        this._enabled = false;
        this._asyncGeneration += 1;
        this._disconnectFocusedDockWindow();

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
        this._destroyChrome(this._stockChooser);
        this._destroyChrome(this._idleOverlay);

        this._dock = null;
        this._dockRevealZone = null;
        this._folderFlyout = null;
        this._folderTitleLabel = null;
        this._folderItems = null;
        this._dockEditor = null;
        this._dockEditorGroups = null;
        this._dockEditorNameEntry = null;
        this._dockEditorPalette = null;
        this._dockAppSearchEntry = null;
        this._dockAppSearchResults = null;
        this._dockCurrentApps = null;
        this._dockEditorStatus = null;
        this._backgroundWidgetLayer = null;
        this._clockPanel = null;
        this._clockFace = null;
        this._clockTimeLabel = null;
        this._clockDateLabel = null;
        this._marketPanel = null;
        this._marketRowsContainer = null;
        this._stockChooser = null;
        this._stockEntry = null;
        this._stockSearchResults = null;
        this._stockSearchStatus = null;
        this._twelveDataKeyEntry = null;
        this._stockItems = null;
        this._idleOverlay = null;
        this._idleCanvas = null;
        this._idleClockLabel = null;
        this._appSystem = null;
        this._quoteLabels = null;
        this._marketRows = null;
        this._marketInstruments = null;
        this._dockGroups = null;
        this._idleMonitor = null;
        this._dockButtons = null;
        this._dockClusters = null;
        this._dockDrag = null;
        this._dockPinnedByCluster = false;
        this._focusedDockWindow = null;
        this._focusedDockWindowSignals = null;
        this._backgroundActors = null;
        this._backgroundFallbackActors = null;
        this._enabled = false;
    }

    _addTimeout(seconds, callback) {
        const timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            seconds,
            () => this._enabled ? callback() : GLib.SOURCE_REMOVE
        );
        this._timeouts.push(timeoutId);
        return timeoutId;
    }

    _addMillisecondTimeout(milliseconds, callback) {
        const timeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            milliseconds,
            () => this._enabled ? callback() : GLib.SOURCE_REMOVE
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

        actor.remove_all_transitions?.();
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

        const header = new St.BoxLayout({vertical: false, style_class: 'desktop-lab-v12-dock-editor-row'});
        header.add_child(new St.Label({text: 'Dock Groups', style_class: 'desktop-lab-v12-editor-title'}));
        const createButton = this._createIconButton('list-add-symbolic', 'Create group', () => this._createDockEditorGroup());
        header.add_child(createButton);

        this._dockEditorGroups = new St.BoxLayout({
            vertical: true,
            style_class: 'desktop-lab-v12-dock-editor-groups',
        });
        this._dockEditorNameEntry = this._createPanelEntry('Selected group name', 'desktop-lab-v12-dock-editor-entry');
        this._dockEditorNameEntry.clutter_text.connect('activate', () => this._renameSelectedDockGroup());
        const nameRow = new St.BoxLayout({vertical: false, style_class: 'desktop-lab-v12-dock-editor-row'});
        nameRow.add_child(this._dockEditorNameEntry);
        nameRow.add_child(this._createIconButton('object-select-symbolic', 'Save group name', () => this._renameSelectedDockGroup()));

        this._dockEditorPalette = new St.BoxLayout({vertical: false, style_class: 'desktop-lab-v12-icon-palette'});
        for (const [label, icon] of GROUP_ICON_PALETTE) {
            const button = this._createIconButton(icon, label, () => this._setSelectedDockGroupIcon(icon));
            button.add_style_class_name('desktop-lab-v12-palette-button');
            this._dockEditorPalette.add_child(button);
        }

        const groupActions = new St.BoxLayout({vertical: false, style_class: 'desktop-lab-v12-dock-editor-row'});
        groupActions.add_child(this._createIconButton('go-up-symbolic', 'Move group up', () => this._moveSelectedDockGroup(-1)));
        groupActions.add_child(this._createIconButton('go-down-symbolic', 'Move group down', () => this._moveSelectedDockGroup(1)));
        groupActions.add_child(this._createIconButton('edit-delete-symbolic', 'Remove group', () => this._removeSelectedDockGroup()));

        this._dockAppSearchEntry = this._createPanelEntry('Search installed apps', 'desktop-lab-v12-dock-editor-entry');
        this._dockAppSearchEntry.clutter_text.connect('text-changed', () => this._rebuildDockAppSearchResults());
        this._dockAppSearchResults = new St.BoxLayout({vertical: true, style_class: 'desktop-lab-v12-app-search-results'});
        this._dockCurrentApps = new St.BoxLayout({vertical: true, style_class: 'desktop-lab-v12-current-apps'});
        this._dockEditorStatus = new St.Label({text: '', style_class: 'desktop-lab-v12-editor-status'});

        this._dockEditor.add_child(header);
        this._dockEditor.add_child(this._dockEditorGroups);
        this._dockEditor.add_child(nameRow);
        this._dockEditor.add_child(this._dockEditorPalette);
        this._dockEditor.add_child(groupActions);
        this._dockEditor.add_child(new St.Label({text: 'Installed Applications', style_class: 'desktop-lab-v12-editor-section'}));
        this._dockEditor.add_child(this._dockAppSearchEntry);
        this._dockEditor.add_child(this._dockAppSearchResults);
        this._dockEditor.add_child(new St.Label({text: 'Current Applications', style_class: 'desktop-lab-v12-editor-section'}));
        this._dockEditor.add_child(this._dockCurrentApps);
        this._dockEditor.add_child(this._dockEditorStatus);
        this._rebuildDockEditorItems();

        Main.layoutManager.addChrome(this._dockEditor, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _createIconButton(iconName, accessibleName, callback) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: accessibleName,
            style_class: 'desktop-lab-v12-dock-editor-add',
        });
        button.set_child(new St.Icon({icon_name: iconName, icon_size: 16}));
        button.connect('clicked', callback);
        return button;
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

        const searchRow = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-stock-entry-row',
        });
        this._stockEntry = new St.Entry({
            can_focus: true,
            hint_text: 'Search symbol or company',
            style_class: 'desktop-lab-v12-stock-entry',
        });
        this._stockEntry.clutter_text.connect('activate', () => this._searchMarketInstruments());
        const searchButton = this._createIconButton('system-search-symbolic', 'Search markets', () => this._searchMarketInstruments());
        searchButton.add_style_class_name('desktop-lab-v12-stock-icon-button');
        searchRow.add_child(this._stockEntry);
        searchRow.add_child(searchButton);

        const keyRow = new St.BoxLayout({vertical: false, style_class: 'desktop-lab-v12-stock-entry-row'});
        this._twelveDataKeyEntry = new St.Entry({
            can_focus: true,
            hint_text: 'Twelve Data API key (international)',
            style_class: 'desktop-lab-v12-stock-entry',
        });
        this._twelveDataKeyEntry.clutter_text.set_password_char?.('•');
        const saveKeyButton = this._createIconButton('document-save-symbolic', 'Save API key', () => this._saveTwelveDataKey());
        saveKeyButton.add_style_class_name('desktop-lab-v12-stock-icon-button');
        keyRow.add_child(this._twelveDataKeyEntry);
        keyRow.add_child(saveKeyButton);

        this._stockSearchStatus = new St.Label({text: 'TWSE and TPEx need no key', style_class: 'desktop-lab-v12-editor-status'});
        this._stockSearchResults = new St.BoxLayout({vertical: true, style_class: 'desktop-lab-v12-stock-search-results'});

        this._stockItems = new St.BoxLayout({
            vertical: true,
            style_class: 'desktop-lab-v12-stock-items',
        });

        this._stockChooser.add_child(searchRow);
        this._stockChooser.add_child(keyRow);
        this._stockChooser.add_child(this._stockSearchStatus);
        this._stockChooser.add_child(this._stockSearchResults);
        this._stockChooser.add_child(new St.Label({text: 'Selected Instruments', style_class: 'desktop-lab-v12-editor-section'}));
        this._stockChooser.add_child(this._stockItems);
        this._rebuildStockChooserItems();
        Main.layoutManager.addChrome(this._stockChooser, {
            affectsStruts: false,
            trackFullscreen: false,
        });
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
        const [group] = this._dockGroups.splice(currentIndex, 1);
        this._dockGroups.splice(targetIndex, 0, group);
        this._dock.set_child_at_index(cluster, targetIndex);
        this._saveDockGroups();
        this._positionFolderFlyout();
    }

    _showDock() {
        if (!this._dock || this._dockRevealed || this._isDockSuppressed())
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
        if (this._isDockSuppressed()) {
            this._syncDockSuppressionVisibility();
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

        // GNOME Shell's own chrome extensions use the layout monitor's
        // inFullscreen property. Prefer it because it tracks the monitor even
        // when the fullscreen window is not the currently focused window.
        if (typeof monitor.inFullscreen === 'boolean')
            return monitor.inFullscreen;

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

    _disconnectFocusedDockWindow() {
        for (const signalId of this._focusedDockWindowSignals ?? []) {
            try {
                this._focusedDockWindow?.disconnect(signalId);
            } catch (error) {
                // The window may already have been unmanaged.
            }
        }

        this._focusedDockWindowSignals = [];
        this._focusedDockWindow = null;
    }

    _watchFocusedDockWindow() {
        this._disconnectFocusedDockWindow();

        const focusedWindow = global.display.focus_window;
        if (focusedWindow) {
            this._focusedDockWindow = focusedWindow;
            const sync = () => this._syncDockSuppressionVisibility();
            for (const signal of [
                'size-changed',
                'position-changed',
                'notify::maximized-horizontally',
                'notify::maximized-vertically',
                'workspace-changed',
            ]) {
                try {
                    this._focusedDockWindowSignals.push(focusedWindow.connect(signal, sync));
                } catch (error) {
                    logError(error, `Could not watch focused window signal ${signal}`);
                }
            }
        }

        this._syncDockSuppressionVisibility();
    }

    _doesActiveWindowObscureDock() {
        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        const focusedWindow = global.display.focus_window;
        if (!monitor || !focusedWindow || focusedWindow.minimized)
            return false;

        const monitorIndex = monitor.index ?? Main.layoutManager.primaryIndex ?? 0;
        if (focusedWindow.get_monitor?.() !== monitorIndex)
            return false;

        const activeWorkspace = global.workspace_manager?.get_active_workspace?.();
        if (activeWorkspace && focusedWindow.get_workspace?.() !== activeWorkspace)
            return false;

        if (focusedWindow.is_maximized?.())
            return true;

        const frame = focusedWindow.get_frame_rect?.();
        const workArea = focusedWindow.get_work_area_current_monitor?.() ??
            Main.layoutManager.getWorkAreaForMonitor?.(monitorIndex);
        if (!frame || !workArea)
            return false;

        const tolerance = 8;
        const touchesLeftEdge = frame.x <= workArea.x + tolerance;
        const fillsWorkAreaHeight = frame.y <= workArea.y + tolerance &&
            frame.y + frame.height >= workArea.y + workArea.height - tolerance;
        const isPartialWidth = frame.width < workArea.width - tolerance;

        // Frame geometry identifies a left tile even if Mutter's internal tile
        // state changes. A right tile does not touch the dock edge and remains
        // available alongside the dock.
        return touchesLeftEdge && fillsWorkAreaHeight && isPartialWidth;
    }

    _isDockSuppressed() {
        return this._isDockMonitorFullscreen() || this._doesActiveWindowObscureDock();
    }

    _syncFullscreenDockVisibility() {
        this._syncDockSuppressionVisibility();
    }

    _syncDockSuppressionVisibility() {
        const fullscreen = this._isDockMonitorFullscreen();
        const windowObscuresDock = this._doesActiveWindowObscureDock();
        const suppressed = fullscreen || windowObscuresDock;
        if (this._dockRevealZone)
            this._dockRevealZone.visible = !suppressed;

        if (!suppressed) {
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
        const editorWidth = Math.max(420, Math.min(560, monitor.width - 180));
        const editorHeight = Math.max(360, this._dockEditor.height || 460);
        this._dockEditor.set_width(editorWidth);
        this._dockEditor.set_position(
            Math.min(this._dockShownX + DOCK_WIDTH + 18, monitor.x + monitor.width - editorWidth - 18),
            Math.min(monitor.y + panelHeight + 88, monitor.y + monitor.height - editorHeight - 18)
        );
    }

    _rebuildDockEditorItems() {
        if (!this._dockEditorGroups || !this._dockCurrentApps)
            return;

        this._selectedDockGroupIndex = Math.max(0, Math.min(
            this._selectedDockGroupIndex,
            (this._dockGroups?.length ?? 1) - 1
        ));
        this._dockEditorGroups.destroy_all_children();
        for (const [index, group] of (this._dockGroups ?? []).entries())
            this._dockEditorGroups.add_child(this._createDockEditorGroupRow(group, index));

        const group = this._selectedDockGroup();
        this._setEntryText(this._dockEditorNameEntry, group?.label ?? '');
        this._dockCurrentApps.destroy_all_children();
        for (const [index, action] of (group?.actions ?? []).entries())
            this._dockCurrentApps.add_child(this._createDockEditorAppRow(action, index));
        this._rebuildDockAppSearchResults();
    }

    _selectedDockGroup() {
        return this._dockGroups?.[this._selectedDockGroupIndex] ?? null;
    }

    _createDockEditorGroupRow(group, index) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: index === this._selectedDockGroupIndex
                ? 'desktop-lab-v12-dock-editor-group-row selected'
                : 'desktop-lab-v12-dock-editor-group-row',
        });
        const row = new St.BoxLayout({vertical: false});
        row.add_child(new St.Icon({icon_name: group.icon, icon_size: 18}));
        row.add_child(new St.Label({
            text: `${group.label} ${group.actions?.length ?? 0}`,
            style_class: 'desktop-lab-v12-dock-editor-group-label',
        }));
        button.set_child(row);
        button.connect('clicked', () => {
            this._selectedDockGroupIndex = index;
            this._setDockEditorStatus('');
            this._rebuildDockEditorItems();
        });
        return button;
    }

    _createDockEditorGroup() {
        const existing = new Set((this._dockGroups ?? []).map(group => group.label.toLowerCase()));
        let number = 1;
        let label = 'New Group';
        while (existing.has(label.toLowerCase()))
            label = `New Group ${++number}`;
        this._dockGroups.push({label, icon: 'folder-symbolic', actions: []});
        this._selectedDockGroupIndex = this._dockGroups.length - 1;
        this._commitDockEditorChange('Group created');
    }

    _renameSelectedDockGroup() {
        const group = this._selectedDockGroup();
        const label = this._cleanDockText(this._getEntryText(this._dockEditorNameEntry), 24);
        if (!group || !label)
            return;
        if (this._dockGroups.some(item => item !== group && item.label.toLowerCase() === label.toLowerCase())) {
            this._setDockEditorStatus('A group with that name already exists');
            return;
        }
        group.label = label;
        this._commitDockEditorChange('Group renamed');
    }

    _setSelectedDockGroupIcon(icon) {
        const group = this._selectedDockGroup();
        if (!group)
            return;
        group.icon = icon;
        this._commitDockEditorChange('Group icon updated');
    }

    _moveSelectedDockGroup(offset) {
        const next = this._selectedDockGroupIndex + offset;
        if (!this._dockGroups || next < 0 || next >= this._dockGroups.length)
            return;
        const [group] = this._dockGroups.splice(this._selectedDockGroupIndex, 1);
        this._dockGroups.splice(next, 0, group);
        this._selectedDockGroupIndex = next;
        this._commitDockEditorChange('Group reordered');
    }

    _removeSelectedDockGroup() {
        if (!this._dockGroups || this._dockGroups.length <= 1) {
            this._setDockEditorStatus('The final group cannot be removed');
            return;
        }
        this._dockGroups.splice(this._selectedDockGroupIndex, 1);
        this._selectedDockGroupIndex = Math.min(this._selectedDockGroupIndex, this._dockGroups.length - 1);
        this._commitDockEditorChange('Group removed');
    }

    _installedApps(query) {
        const folded = String(query ?? '').trim().toLowerCase();
        if (!folded)
            return [];
        return (this._appSystem?.get_installed?.() ?? [])
            .map(app => ({
                app,
                id: app.get_id?.() ?? '',
                name: app.get_name?.() ?? '',
                icon: app.get_app_info?.()?.get_icon?.()?.to_string?.() ?? 'application-x-executable-symbolic',
            }))
            .filter(item => item.id && item.name && (`${item.name} ${item.id}`).toLowerCase().includes(folded))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 8);
    }

    _rebuildDockAppSearchResults() {
        if (!this._dockAppSearchResults)
            return;
        this._dockAppSearchResults.destroy_all_children();
        const query = this._getEntryText(this._dockAppSearchEntry);
        for (const result of this._installedApps(query)) {
            const button = new St.Button({
                reactive: true,
                can_focus: true,
                track_hover: true,
                style_class: 'desktop-lab-v12-app-search-result',
            });
            const content = new St.BoxLayout({vertical: false});
            content.add_child(result.app.create_icon_texture(22));
            content.add_child(new St.Label({text: `${result.name}  ${result.id}`, style_class: 'desktop-lab-v12-app-result-label'}));
            button.set_child(content);
            button.connect('clicked', () => this._addInstalledAppToSelectedGroup(result));
            this._dockAppSearchResults.add_child(button);
        }
    }

    _addInstalledAppToSelectedGroup(result) {
        const group = this._selectedDockGroup();
        if (!group)
            return;
        const duplicate = this._dockGroups.some(item => item.actions.some(action => action.kind === 'app' && action.id === result.id));
        if (duplicate) {
            this._setDockEditorStatus(`${result.name} is already in the dock`);
            return;
        }
        group.actions.push({kind: 'app', id: result.id, name: result.name, icon: result.icon});
        this._setEntryText(this._dockAppSearchEntry, '');
        this._commitDockEditorChange(`${result.name} added`);
    }

    _createDockEditorAppRow(action, index) {
        const row = new St.BoxLayout({vertical: false, style_class: 'desktop-lab-v12-current-app-row'});
        row.add_child(new St.Icon({icon_name: action.icon || 'application-x-executable-symbolic', icon_size: 18}));
        row.add_child(new St.Label({text: `${action.name}  ${action.id ?? ''}`, style_class: 'desktop-lab-v12-app-result-label'}));
        row.add_child(this._createIconButton('go-up-symbolic', `Move ${action.name} up`, () => this._moveSelectedDockApp(index, -1)));
        row.add_child(this._createIconButton('go-down-symbolic', `Move ${action.name} down`, () => this._moveSelectedDockApp(index, 1)));
        row.add_child(this._createIconButton('edit-delete-symbolic', `Remove ${action.name}`, () => this._removeSelectedDockApp(index)));
        return row;
    }

    _moveSelectedDockApp(index, offset) {
        const actions = this._selectedDockGroup()?.actions;
        const next = index + offset;
        if (!actions || next < 0 || next >= actions.length)
            return;
        const [action] = actions.splice(index, 1);
        actions.splice(next, 0, action);
        this._commitDockEditorChange('Application reordered');
    }

    _removeSelectedDockApp(index) {
        const actions = this._selectedDockGroup()?.actions;
        if (!actions || index < 0 || index >= actions.length)
            return;
        actions.splice(index, 1);
        this._commitDockEditorChange('Application removed');
    }

    _setDockEditorStatus(message) {
        if (this._dockEditorStatus)
            this._dockEditorStatus.text = message;
    }

    _commitDockEditorChange(message) {
        this._saveDockGroups();
        this._rebuildDockGroups();
        this._rebuildDockEditorItems();
        this._positionDockEditor();
        this._setDockEditorStatus(message);
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

        const fallbackIds = Array.isArray(action?.fallbackIds)
            ? action.fallbackIds.map(item => this._cleanDesktopId(item)).filter(item => item)
            : undefined;
        const installed = [id, ...(fallbackIds ?? [])]
            .map(appId => this._appSystem?.lookup_app?.(appId))
            .find(app => app);
        const installedIcon = installed?.get_app_info?.()?.get_icon?.()?.to_string?.();

        return {
            kind: 'app',
            id,
            fallbackIds,
            name: this._cleanDockText(installed?.get_name?.() || action?.name, 48) || id.replace(/\.desktop$/, ''),
            icon: this._cleanIconName(installedIcon || action?.icon) || 'application-x-executable-symbolic',
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

    _loadMarketInstruments() {
        const path = this._stockConfigPath(STOCK_SYMBOLS_FILE);
        try {
            const [ok, contents] = GLib.file_get_contents(path);
            if (!ok)
                return DEFAULT_MARKET_INSTRUMENTS.map(item => ({...item}));

            const records = JSON.parse(new TextDecoder().decode(contents));
            const cleaned = Array.isArray(records)
                ? records
                    .map(record => this._sanitizeMarketInstrument(record))
                    .filter(record => record)
                : [];
            const seen = new Set();
            return cleaned.length > 0
                ? cleaned.filter(record => {
                    const key = this._marketInstrumentKey(record);
                    if (seen.has(key))
                        return false;
                    seen.add(key);
                    return true;
                })
                : DEFAULT_MARKET_INSTRUMENTS.map(item => ({...item}));
        } catch (error) {
            return DEFAULT_MARKET_INSTRUMENTS.map(item => ({...item}));
        }
    }

    _saveMarketInstruments() {
        try {
            const path = this._stockConfigPath(STOCK_SYMBOLS_FILE);
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o700);
            GLib.file_set_contents(path, `${JSON.stringify(this._marketInstruments, null, 2)}\n`);
        } catch (error) {
            logError(error, 'Could not save desktop lab market instruments');
        }
    }

    _sanitizeMarketInstrument(value) {
        if (typeof value === 'string') {
            const symbol = String(value).trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
            return /^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(symbol)
                ? {provider: 'legacy', symbol, name: symbol, exchange: '', currency: ''}
                : null;
        }
        const provider = String(value?.provider ?? '').trim();
        const symbol = String(value?.symbol ?? '').trim();
        const name = this._cleanDockText(value?.name, 80);
        const exchange = this._cleanDockText(value?.exchange, 40);
        const currency = String(value?.currency ?? '').trim().toUpperCase();
        if (!['twse', 'tpex', 'twelve-data', 'legacy'].includes(provider) ||
            !/^[\p{L}\p{N}._:/ -]{1,32}$/u.test(symbol) || !name)
            return null;
        if (provider !== 'legacy' && (!exchange || !/^[A-Z]{3}$/.test(currency)))
            return null;
        return {provider, symbol, name, exchange, currency};
    }

    _marketInstrumentKey(instrument) {
        return `${instrument.provider}|${instrument.symbol}|${instrument.exchange}`.toLowerCase();
    }

    _rebuildMarketRows() {
        if (!this._marketRowsContainer || !this._quoteLabels)
            return;

        this._marketRowsContainer.destroy_all_children();
        this._quoteLabels.clear();
        this._marketRows.clear();

        for (const instrument of this._marketInstruments) {
            const row = new St.BoxLayout({
                vertical: false,
                style_class: 'desktop-lab-v12-market-row',
            });
            row.add_child(new St.Label({
                text: instrument.symbol,
                style_class: 'desktop-lab-v12-market-symbol',
            }));

            const value = new St.Label({
                text: '--',
                style_class: 'desktop-lab-v12-market-value',
            });
            row.add_child(value);
            const key = this._marketInstrumentKey(instrument);
            this._quoteLabels.set(key, value);
            this._marketRows.set(key, row);
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
        const chooserWidth = Math.max(420, Math.min(560, monitor.width - 48));
        const chooserHeight = Math.max(240, this._stockChooser.height || 320);

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
        for (const instrument of this._marketInstruments)
            this._stockItems.add_child(this._createStockChooserRow(instrument));
    }

    _createStockChooserRow(instrument) {
        const row = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-stock-row',
        });
        row.add_child(new St.Label({
            text: `${instrument.symbol} · ${instrument.name} · ${instrument.exchange || 'Pending validation'}`,
            style_class: 'desktop-lab-v12-stock-symbol',
        }));

        const removeButton = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: `Remove ${instrument.symbol}`,
            style_class: 'desktop-lab-v12-stock-icon-button',
        });
        removeButton.set_child(new St.Icon({
            icon_name: 'edit-delete-symbolic',
            icon_size: 14,
        }));
        removeButton.connect('clicked', () => this._removeMarketInstrument(instrument));
        row.add_child(removeButton);
        return row;
    }

    _marketProviderPath() {
        return GLib.build_filenamev([this.path, 'market_provider.py']);
    }

    _runMarketHelper(args, stdin, callback) {
        const generation = this._asyncGeneration;
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['/usr/bin/python3', this._marketProviderPath(), ...args],
                Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (error) {
            callback?.(null, error.message);
            return;
        }
        proc.communicate_utf8_async(stdin ?? null, null, (subprocess, result) => {
            if (!this._enabled || generation !== this._asyncGeneration)
                return;
            try {
                const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                const payload = JSON.parse((stdout || '').trim());
                if (!payload.ok)
                    callback?.(null, payload.message || (stderr || '').trim() || 'Provider error');
                else
                    callback?.(payload, null);
            } catch (error) {
                callback?.(null, error.message);
            }
        });
    }

    _searchMarketInstruments() {
        const query = this._cleanDockText(this._getEntryText(this._stockEntry), 64);
        if (!query)
            return;
        const searchGeneration = ++this._marketSearchGeneration;
        this._stockSearchStatus.text = 'Searching official markets…';
        this._stockSearchResults.destroy_all_children();
        this._runMarketHelper(['search', query], null, (payload, error) => {
            if (searchGeneration !== this._marketSearchGeneration || !this._stockSearchResults)
                return;
            this._stockSearchResults.destroy_all_children();
            if (error) {
                this._stockSearchStatus.text = error;
                return;
            }
            this._stockSearchStatus.text = payload.warning || (payload.results.length ? 'Select a verified instrument' : 'No matching instrument found');
            for (const instrument of payload.results)
                this._stockSearchResults.add_child(this._createMarketSearchResult(instrument));
            this._positionStockChooser();
        });
    }

    _createMarketSearchResult(instrument) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'desktop-lab-v12-market-search-result',
        });
        const text = `${instrument.symbol} · ${instrument.name}\n${instrument.exchange} · ${instrument.currency}`;
        button.set_child(new St.Label({text, style_class: 'desktop-lab-v12-market-search-label'}));
        button.connect('clicked', () => this._addMarketInstrument(instrument));
        return button;
    }

    _addMarketInstrument(value) {
        const instrument = this._sanitizeMarketInstrument(value);
        if (!instrument)
            return;
        const key = this._marketInstrumentKey(instrument);
        if (this._marketInstruments.some(item => this._marketInstrumentKey(item) === key)) {
            this._stockSearchStatus.text = `${instrument.symbol} is already selected`;
            return;
        }
        this._marketInstruments.push(instrument);
        this._saveMarketInstruments();
        this._rebuildMarketRows();
        this._rebuildStockChooserItems();
        this._stockSearchResults.destroy_all_children();
        this._setEntryText(this._stockEntry, '');
        this._stockSearchStatus.text = `${instrument.name} added`;
        this._positionStockChooser();
        this._refreshMarketQuotes();
    }

    _removeMarketInstrument(instrument) {
        if (this._marketInstruments.length <= 1) {
            this._stockSearchStatus.text = 'Keep at least one instrument';
            return;
        }
        const key = this._marketInstrumentKey(instrument);
        this._marketInstruments = this._marketInstruments.filter(item => this._marketInstrumentKey(item) !== key);
        this._saveMarketInstruments();
        this._rebuildMarketRows();
        this._rebuildStockChooserItems();
        this._positionStockChooser();
        this._refreshMarketQuotes();
    }

    _saveTwelveDataKey() {
        const key = this._getEntryText(this._twelveDataKeyEntry).trim();
        if (!key) {
            this._stockSearchStatus.text = 'Enter a Twelve Data API key';
            return;
        }
        this._runMarketHelper(['set-key'], key, (_payload, error) => {
            this._setEntryText(this._twelveDataKeyEntry, '');
            this._stockSearchStatus.text = error || 'Twelve Data API key saved with owner-only permissions';
            if (!error)
                this._refreshMarketQuotes();
        });
    }

    _getActiveWorkspaceIndex() {
        try {
            return global.workspace_manager?.get_active_workspace?.()?.index?.() ?? BACKGROUND_WORKSPACE_INDEX;
        } catch (error) {
            return BACKGROUND_WORKSPACE_INDEX;
        }
    }

    _syncWorkspaceVisibility() {
        const visible = this._getActiveWorkspaceIndex() === BACKGROUND_WORKSPACE_INDEX && !Main.overview?.visible;
        this._setBackgroundWidgetsVisible(visible);
        if (!visible)
            this._hideStockChooser();
    }

    _setBackgroundWidgetsVisible(visible, animate = true) {
        const actor = this._backgroundWidgetLayer;
        if (!actor || !this._enabled)
            return;
        actor.remove_all_transitions?.();
        if (visible)
            actor.show();
        if (!animate) {
            actor.opacity = visible ? 255 : 0;
            if (!visible)
                actor.hide();
            return;
        }
        actor.ease({
            opacity: visible ? 255 : 0,
            duration: visible ? 160 : 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this._enabled && this._backgroundWidgetLayer === actor && !visible)
                    actor.hide();
            },
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

        this._backgroundWidgetLayer?.set_position(monitor.x, monitor.y);
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
        this._idleOverlay?.set_position(monitor.x, monitor.y);
        this._idleOverlay?.set_size(monitor.width, monitor.height);
        this._idleCanvas?.set_size(monitor.width, monitor.height);
    }

    _updateClock() {
        if (!this._enabled)
            return;
        const now = GLib.DateTime.new_now_local();

        if (this._clockTimeLabel)
            this._clockTimeLabel.text = now.format('%H:%M');
        if (this._clockDateLabel)
            this._clockDateLabel.text = this._formatMonthDay(now);
        if (this._idleClockLabel)
            this._idleClockLabel.text = now.format('%H:%M');
        if (this._backgroundWidgetLayer?.visible && this._backgroundWidgetLayer.opacity > 0)
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
        if (this._marketFetchInFlight || !this._quoteLabels || !this._enabled)
            return;

        this._marketFetchInFlight = true;
        this._runMarketHelper(['quotes', JSON.stringify(this._marketInstruments)], null, (payload, error) => {
            this._marketFetchInFlight = false;
            if (!this._quoteLabels)
                return;
            if (error) {
                this._setMarketError(error);
                return;
            }
            let configurationChanged = false;
            for (const quote of payload.quotes ?? []) {
                const instrument = this._sanitizeMarketInstrument(quote.instrument);
                if (!instrument)
                    continue;
                const originalIndex = this._marketInstruments.findIndex(item =>
                    item.symbol === instrument.symbol && (item.provider === 'legacy' || this._marketInstrumentKey(item) === this._marketInstrumentKey(instrument)));
                const original = this._marketInstruments[originalIndex] ?? instrument;
                const label = this._quoteLabels.get(this._marketInstrumentKey(original)) ??
                    this._quoteLabels.get(this._marketInstrumentKey(instrument));
                if (originalIndex >= 0 && this._marketInstruments[originalIndex].provider === 'legacy') {
                    this._marketInstruments[originalIndex] = instrument;
                    configurationChanged = true;
                }
                if (label && quote.close)
                    label.text = `${quote.close}${quote.cached ? ' ·' : ''}`;
            }
            if (configurationChanged) {
                this._saveMarketInstruments();
                this._rebuildMarketRows();
                this._refreshMarketQuotes();
            }
        });
    }

    _setMarketError(message) {
        // Keep the last successful value visible during temporary failures.
        for (const value of this._quoteLabels?.values() ?? []) {
            if (value.text === '--')
                value.text = 'offline';
        }
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

        actor.remove_all_transitions?.();
        actor.destroy();
    }
}
