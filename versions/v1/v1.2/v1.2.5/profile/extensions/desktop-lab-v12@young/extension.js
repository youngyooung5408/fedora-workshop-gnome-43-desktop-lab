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
const DRAG_TRIGGER_DISTANCE = 70;
const CLOCK_SIZE = 198;
const DOCK_WIDTH = 92;
const DOCK_ICON_SIZE = 38;
const DOCK_WAVE_RADIUS = 118;
const DOCK_WAVE_SCALE = 0.28;
const DOCK_DRAG_THRESHOLD = 12;
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
        ],
    },
];

const MARKET_SYMBOLS = [
    {symbol: 'SPY'},
    {symbol: 'QQQ'},
    {symbol: 'NVDA'},
    {symbol: 'AAPL'},
];

const MARKET_FETCH_SCRIPT = `
import json
import sys
import urllib.parse
import urllib.request

symbols = json.loads(sys.argv[1])

try:
    quotes = {}
    for item in symbols:
        symbol = item["symbol"]
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{urllib.parse.quote(symbol)}?range=1d&interval=1d"
        )
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "desktop-lab-v125/1.0 (+https://local-only.invalid)"}
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8", "replace"))

        result = (payload.get("chart", {}).get("result") or [{}])[0]
        meta = result.get("meta", {})
        price = meta.get("regularMarketPrice")
        if price is None:
            closes = ((result.get("indicators", {}).get("quote") or [{}])[0].get("close") or [])
            price = next((value for value in reversed(closes) if value is not None), None)

        quotes[item["symbol"]] = {
            "close": f"{float(price):.2f}" if price is not None else "--",
        }

    print(json.dumps({"ok": True, "quotes": quotes}))
except Exception as error:
    print(json.dumps({"ok": False, "message": str(error)}))
`;

export default class DesktopLabV12Extension extends Extension {
    enable() {
        this._appSystem = Shell.AppSystem.get_default();
        this._timeouts = [];
        this._signals = [];
        this._hiddenBatteryActors = [];
        this._quoteLabels = new Map();
        this._marketFetchInFlight = false;
        this._idleVisible = false;
        this._idleAnimationStep = 0;
        this._idleTimeoutId = 0;
        this._idleMonitor = null;
        this._idleWatchId = 0;
        this._userActiveWatchId = 0;
        this._usesCoreIdleMonitor = false;
        this._lastActivityUsec = 0;
        this._dragStartY = null;
        this._dockButtons = [];
        this._dockClusters = [];
        this._dockDrag = null;
        this._suppressNextDockClick = false;
        this._activeFolderGroup = null;
        this._activeFolderCluster = null;

        this._buildDock();
        this._buildFolderFlyout();
        this._buildClock();
        this._buildMarketPanel();
        this._buildGestureZone();
        this._buildIdleOverlay();
        this._syncLayout();
        this._updateClock();
        this._refreshMarketQuotes();
        this._startIdleWatch();
        this._tryHideBatteryIcon();

        this._signals.push([
            Main.layoutManager,
            Main.layoutManager.connect('monitors-changed', () => this._syncLayout()),
        ]);
        this._signals.push([
            global.stage,
            global.stage.connect('captured-event', (_actor, event) => this._handleCapturedEvent(event)),
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
        this._destroyChrome(this._clockPanel);
        this._destroyChrome(this._marketPanel);
        this._destroyChrome(this._gestureZone);
        this._destroyChrome(this._idleOverlay);

        this._dock = null;
        this._folderFlyout = null;
        this._folderTitleLabel = null;
        this._folderItems = null;
        this._clockPanel = null;
        this._clockFace = null;
        this._clockTimeLabel = null;
        this._clockDateLabel = null;
        this._marketPanel = null;
        this._gestureZone = null;
        this._idleOverlay = null;
        this._idleCanvas = null;
        this._idleClockLabel = null;
        this._appSystem = null;
        this._quoteLabels = null;
        this._idleMonitor = null;
        this._dockButtons = null;
        this._dockClusters = null;
        this._dockDrag = null;
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

    _buildDock() {
        this._dock = new St.BoxLayout({
            vertical: true,
            reactive: true,
            track_hover: true,
            style_class: 'desktop-lab-v12-dock',
        });
        this._dock.connect('enter-event', () => {
            return Clutter.EVENT_PROPAGATE;
        });
        this._dock.connect('leave-event', () => {
            this._resetDockWave();
            return Clutter.EVENT_PROPAGATE;
        });

        for (const group of DOCK_GROUPS) {
            const cluster = new St.BoxLayout({
                vertical: true,
                reactive: true,
                track_hover: true,
                style_class: 'desktop-lab-v12-cluster',
            });

            cluster.add_child(this._createDockFolderButton(group, cluster));
            cluster.add_child(new St.Label({
                text: group.label,
                style_class: 'desktop-lab-v12-group-label',
            }));

            this._dockClusters.push(cluster);
            this._dock.add_child(cluster);
        }

        Main.layoutManager.addChrome(this._dock, {
            affectsStruts: false,
            trackFullscreen: false,
        });
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

        this._folderFlyout.add_child(this._folderTitleLabel);
        this._folderFlyout.add_child(this._folderItems);

        Main.layoutManager.addChrome(this._folderFlyout, {
            affectsStruts: false,
            trackFullscreen: false,
        });
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

        Main.layoutManager.addChrome(this._clockPanel, {
            affectsStruts: false,
            trackFullscreen: false,
        });
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
        this._marketPanel.add_child(header);

        for (const item of MARKET_SYMBOLS) {
            const row = new St.BoxLayout({
                vertical: false,
                style_class: 'desktop-lab-v12-market-row',
            });
            row.add_child(new St.Label({
                text: item.symbol,
                style_class: 'desktop-lab-v12-market-symbol',
            }));

            const value = new St.Label({
                text: '--',
                style_class: 'desktop-lab-v12-market-value',
            });
            row.add_child(value);
            this._quoteLabels.set(item.symbol, value);
            this._marketPanel.add_child(row);
        }

        Main.layoutManager.addChrome(this._marketPanel, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _buildGestureZone() {
        this._gestureZone = new St.Widget({
            reactive: true,
            track_hover: true,
            style_class: 'desktop-lab-v12-gesture-zone',
        });

        this._gestureZone.connect('scroll-event', (_actor, event) => {
            if (event.get_scroll_direction() === Clutter.ScrollDirection.UP) {
                this._showApplications();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });
        this._gestureZone.connect('button-press-event', (_actor, event) => {
            const [, y] = event.get_coords();
            this._dragStartY = y;
            return Clutter.EVENT_PROPAGATE;
        });
        this._gestureZone.connect('button-release-event', (_actor, event) => {
            const [, y] = event.get_coords();
            if (this._dragStartY !== null && this._dragStartY - y >= DRAG_TRIGGER_DISTANCE) {
                this._showApplications();
                this._dragStartY = null;
                return Clutter.EVENT_STOP;
            }

            this._dragStartY = null;
            return Clutter.EVENT_PROPAGATE;
        });

        Main.layoutManager.addChrome(this._gestureZone, {
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

        const row = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-folder-row',
        });
        const app = this._lookupAppForAction(action);
        row.add_child(app
            ? app.create_icon_texture(26)
            : new St.Icon({icon_name: action.icon, icon_size: 26}));
        row.add_child(new St.Label({
            text: action.name,
            style_class: 'desktop-lab-v12-folder-label',
        }));

        button.set_child(row);
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
        this._folderTitleLabel.text = `${group.label} Apps`;
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
        const flyoutWidth = 210;
        const flyoutHeight = Math.max(120, this._folderFlyout.height || 160);
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

    _updateDockWave(x, y) {
        if (!this._dockButtons?.length)
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

    _syncLayout() {
        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const panelHeight = Main.panel?.height ?? 0;
        const contentTop = monitor.y + panelHeight;
        const availableHeight = monitor.height - panelHeight;
        const dockHeight = Math.max(480, Math.min(640, availableHeight - 80));
        const dockY = contentTop + Math.max(28, Math.floor((availableHeight - dockHeight) / 2));
        const marketWidth = Math.max(238, Math.min(292, monitor.width - 220));
        const clockWidth = 236;

        this._dock?.set_position(monitor.x + 14, dockY);
        this._dock?.set_size(DOCK_WIDTH, dockHeight);

        this._clockPanel?.set_position(
            monitor.x + Math.floor((monitor.width - clockWidth) / 2),
            contentTop + 18
        );
        this._clockPanel?.set_size(clockWidth, 252);

        this._marketPanel?.set_position(
            monitor.x + monitor.width - marketWidth - 24,
            contentTop + 36
        );
        this._marketPanel?.set_width(marketWidth);
        this._positionFolderFlyout();

        this._gestureZone?.set_position(monitor.x, monitor.y + monitor.height - 46);
        this._gestureZone?.set_size(monitor.width, 46);

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

            const minuteAngle = (minute / 60) * TAU - Math.PI / 2;
            const hourAngle = ((hour + minute / 60) / 12) * TAU - Math.PI / 2;
            const secondAngle = (second / 60) * TAU - Math.PI / 2;

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

            cr.setSourceRGBA(0.96, 0.96, 0.97, 0.46);
            cr.setLineWidth(1.4);
            cr.moveTo(centerX, centerY);
            cr.lineTo(
                centerX + Math.cos(secondAngle) * (radius * 0.80),
                centerY + Math.sin(secondAngle) * (radius * 0.80)
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
                ['/usr/bin/python3', '-c', MARKET_FETCH_SCRIPT, JSON.stringify(MARKET_SYMBOLS)],
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
            this._updateDockWave(x, y);
            if (this._handleDockDragMotion(event))
                return Clutter.EVENT_STOP;
        } else if (type === Clutter.EventType.BUTTON_PRESS) {
            const [x, y] = event.get_coords();
            this._hideFolderIfPointerOutside(x, y);
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
            cr.setSourceRGB(0, 0, 0);
            cr.paint();

            cr.setLineWidth(1.0);
            for (let i = -6; i < 18; i++) {
                const y = ((i * 82) + (step * 11)) % (height + 220) - 110;
                const alpha = 0.025 + ((i % 4) * 0.012);
                cr.setSourceRGBA(0.96, 0.96, 0.97, alpha);
                cr.moveTo(-80, y);
                cr.lineTo(width + 80, y - 120);
                cr.stroke();
            }

            cr.setLineWidth(1.6);
            for (let i = 0; i < 5; i++) {
                const x = ((i * 260) + (step * 17)) % (width + 280) - 140;
                cr.setSourceRGBA(0.96, 0.96, 0.97, 0.045);
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
