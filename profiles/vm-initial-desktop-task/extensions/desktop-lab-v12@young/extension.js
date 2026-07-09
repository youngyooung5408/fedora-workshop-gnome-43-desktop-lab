import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const MARKDOWN_DIR = GLib.build_filenamev([
    GLib.get_home_dir(),
    'Documents',
    'Markdown Notes',
]);
const CLOCK_REFRESH_SECONDS = 30;
const MOTION_REFRESH_SECONDS = 18;

const DOCK_GROUPS = [
    {
        label: 'Write',
        actions: [
            {
                kind: 'new-note',
                name: 'New Markdown Note',
                icon: 'document-new-symbolic',
                styleClass: 'desktop-lab-v12-note-button',
            },
            {
                kind: 'app',
                id: 'org.gnome.TextEditor.desktop',
                name: 'Text Editor',
                icon: 'accessories-text-editor-symbolic',
            },
        ],
    },
    {
        label: 'Code',
        actions: [
            {
                kind: 'app',
                id: 'org.gnome.Ptyxis.desktop',
                name: 'Terminal',
                icon: 'utilities-terminal-symbolic',
            },
            {
                kind: 'app',
                id: 'org.gnome.Nautilus.desktop',
                name: 'Files',
                icon: 'system-file-manager-symbolic',
            },
        ],
    },
    {
        label: 'Web',
        actions: [
            {
                kind: 'app',
                id: 'org.mozilla.firefox.desktop',
                name: 'Firefox',
                icon: 'web-browser-symbolic',
            },
        ],
    },
    {
        label: 'System',
        actions: [
            {
                kind: 'app',
                id: 'org.gnome.Settings.desktop',
                name: 'Settings',
                icon: 'org.gnome.Settings-symbolic',
            },
            {
                kind: 'app',
                id: 'org.gnome.clocks.desktop',
                name: 'Clocks',
                icon: 'org.gnome.clocks-symbolic',
            },
        ],
    },
];

const WATCHLIST = ['SPY', 'QQQ', 'NVDA', 'AAPL'];

export default class DesktopLabV12Extension extends Extension {
    enable() {
        this._appSystem = Shell.AppSystem.get_default();
        this._timeouts = [];
        this._signals = [];
        this._hiddenBatteryActors = [];
        this._motionStep = 0;

        this._buildDock();
        this._buildDataPanel();
        this._buildMotionDot();
        this._syncLayout();
        this._updateClock();
        this._moveMotionDot();
        this._tryHideBatteryIcon();

        this._signals.push([
            Main.layoutManager,
            Main.layoutManager.connect('monitors-changed', () => this._syncLayout()),
        ]);
        this._timeouts.push(GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            CLOCK_REFRESH_SECONDS,
            () => {
                this._updateClock();
                return GLib.SOURCE_CONTINUE;
            }
        ));
        this._timeouts.push(GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            MOTION_REFRESH_SECONDS,
            () => {
                this._moveMotionDot();
                return GLib.SOURCE_CONTINUE;
            }
        ));
    }

    disable() {
        for (const [object, signalId] of this._signals ?? [])
            object.disconnect(signalId);
        this._signals = [];

        for (const timeoutId of this._timeouts ?? [])
            GLib.source_remove(timeoutId);
        this._timeouts = [];

        this._restoreBatteryActors();
        this._destroyChrome(this._dock);
        this._destroyChrome(this._dataPanel);
        this._destroyChrome(this._motionDot);

        this._dock = null;
        this._dataPanel = null;
        this._motionDot = null;
        this._clockLabel = null;
        this._dateLabel = null;
        this._appSystem = null;
    }

    _buildDock() {
        this._dock = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style_class: 'desktop-lab-v12-dock',
        });

        DOCK_GROUPS.forEach((group, groupIndex) => {
            if (groupIndex > 0)
                this._dock.add_child(new St.Widget({style_class: 'desktop-lab-v12-separator'}));

            this._dock.add_child(new St.Label({
                text: group.label,
                style_class: 'desktop-lab-v12-group-label',
            }));

            for (const action of group.actions)
                this._dock.add_child(this._createDockButton(action));
        });

        Main.layoutManager.addChrome(this._dock, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _buildDataPanel() {
        this._dataPanel = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style_class: 'desktop-lab-v12-panel',
        });

        this._clockLabel = new St.Label({style_class: 'desktop-lab-v12-clock'});
        this._dateLabel = new St.Label({style_class: 'desktop-lab-v12-subtle'});
        this._dataPanel.add_child(this._clockLabel);
        this._dataPanel.add_child(this._dateLabel);
        this._dataPanel.add_child(new St.Label({
            text: 'Watchlist',
            style_class: 'desktop-lab-v12-subtle',
        }));

        const chipRow = new St.BoxLayout({
            vertical: false,
            style_class: 'desktop-lab-v12-chip-row',
        });
        for (const symbol of WATCHLIST)
            chipRow.add_child(this._createWatchButton(symbol));
        this._dataPanel.add_child(chipRow);

        this._dataPanel.add_child(new St.Label({
            text: 'Idle dim: 5 min / Breaks: 20 min',
            style_class: 'desktop-lab-v12-subtle',
        }));

        Main.layoutManager.addChrome(this._dataPanel, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _buildMotionDot() {
        this._motionDot = new St.Widget({
            reactive: false,
            style_class: 'desktop-lab-v12-motion-dot',
        });
        Main.layoutManager.addChrome(this._motionDot, {
            affectsStruts: false,
            trackFullscreen: false,
        });
    }

    _createDockButton(action) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: action.name,
            style_class: `desktop-lab-v12-app-button ${action.styleClass ?? ''}`,
        });

        const app = action.id ? this._appSystem.lookup_app(action.id) : null;
        const icon = app
            ? app.create_icon_texture(32)
            : new St.Icon({icon_name: action.icon, icon_size: 32});

        button.set_child(icon);
        button.connect('clicked', () => this._runAction(action));
        return button;
    }

    _createWatchButton(symbol) {
        const button = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: `Open ${symbol} quote`,
            style_class: 'desktop-lab-v12-chip',
        });
        button.set_child(new St.Label({text: symbol}));
        button.connect('clicked', () =>
            this._openUri(`https://finance.yahoo.com/quote/${symbol}`));
        return button;
    }

    _runAction(action) {
        if (action.kind === 'new-note') {
            this._createMarkdownNote();
            return;
        }

        const app = this._appSystem.lookup_app(action.id);
        if (app) {
            app.open_new_window(-1);
            return;
        }

        Main.notify('Desktop Lab', `${action.name} is not installed in this VM.`);
    }

    _createMarkdownNote() {
        try {
            GLib.mkdir_with_parents(MARKDOWN_DIR, 0o755);
            const now = GLib.DateTime.new_now_local();
            const stamp = now.format('%Y-%m-%d-%H%M%S');
            const title = now.format('%Y-%m-%d %H:%M');
            const path = GLib.build_filenamev([MARKDOWN_DIR, `${stamp}.md`]);

            GLib.file_set_contents(path, `# ${title}\n\n`);
            this._openUri(Gio.File.new_for_path(path).get_uri());
        } catch (error) {
            logError(error, 'Could not create Markdown note');
            Main.notify('Desktop Lab', 'Could not create Markdown note.');
        }
    }

    _openUri(uri) {
        try {
            Gio.AppInfo.launch_default_for_uri(uri, null);
        } catch (error) {
            logError(error, `Could not open ${uri}`);
        }
    }

    _syncLayout() {
        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return;

        const panelHeight = Main.panel?.height ?? 0;
        const top = monitor.y + panelHeight + 16;
        const dockHeight = Math.max(220, Math.min(520, monitor.height - panelHeight - 40));
        const panelWidth = Math.max(220, Math.min(300, monitor.width - 130));

        this._dock?.set_position(monitor.x + 12, top);
        this._dock?.set_size(64, dockHeight);

        this._dataPanel?.set_position(
            monitor.x + monitor.width - panelWidth - 24,
            top
        );
        this._dataPanel?.set_width(panelWidth);
    }

    _updateClock() {
        if (!this._clockLabel || !this._dateLabel)
            return;

        const now = GLib.DateTime.new_now_local();
        this._clockLabel.text = now.format('%H:%M');
        this._dateLabel.text = now.format('%A %Y-%m-%d');
    }

    _moveMotionDot() {
        if (!this._motionDot)
            return GLib.SOURCE_CONTINUE;

        const monitor = Main.layoutManager.primaryMonitor ?? Main.layoutManager.monitors[0];
        if (!monitor)
            return GLib.SOURCE_CONTINUE;

        const minX = monitor.x + 96;
        const minY = monitor.y + (Main.panel?.height ?? 0) + 80;
        const spanX = Math.max(1, monitor.width - 160);
        const spanY = Math.max(1, monitor.height - 180);
        const x = minX + ((this._motionStep * 149) % spanX);
        const y = minY + ((this._motionStep * 83) % spanY);
        this._motionStep += 1;

        this._motionDot.ease({
            x,
            y,
            duration: (MOTION_REFRESH_SECONDS - 2) * 1000,
            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
        });

        return GLib.SOURCE_CONTINUE;
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
