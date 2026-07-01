import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const REFRESH_INTERVAL_SECONDS = 300;

const CodexUsageIndicator = GObject.registerClass(
class CodexUsageIndicator extends PanelMenu.Button {
    _init(extensionPath) {
        super._init(0.0, 'Codex Usage');

        this._extensionPath = extensionPath;
        this._helperPath = GLib.build_filenamev([extensionPath, 'export_codex_usage.py']);
        this._timeoutId = null;
        this._refreshInFlight = false;
        this._lastStatus = null;

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._iconLabel = new St.Label({
            text: 'C',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: 700; margin-right: 6px;',
        });
        this._valueLabel = new St.Label({
            text: '--',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'font-weight: 700;',
        });

        box.add_child(this._iconLabel);
        box.add_child(this._valueLabel);
        this.add_child(box);

        this._summaryItem = new PopupMenu.PopupMenuItem('Loading…', {reactive: false});
        this._fiveHourItem = new PopupMenu.PopupMenuItem('5h left: --', {reactive: false});
        this._weeklyItem = new PopupMenu.PopupMenuItem('Week left: --', {reactive: false});
        this._fiveHourResetItem = new PopupMenu.PopupMenuItem('5h reset: --', {reactive: false});
        this._weeklyResetItem = new PopupMenu.PopupMenuItem('Week reset: --', {reactive: false});
        this._creditsItem = new PopupMenu.PopupMenuItem('Credits: --', {reactive: false});
        this._sourceItem = new PopupMenu.PopupMenuItem('Source: --', {reactive: false});
        this._updatedItem = new PopupMenu.PopupMenuItem('Updated: --', {reactive: false});
        this._staleItem = new PopupMenu.PopupMenuItem('State: --', {reactive: false});
        this._messageItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._refreshItem = new PopupMenu.PopupMenuItem('Refresh now');

        this.menu.addMenuItem(this._summaryItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._fiveHourItem);
        this.menu.addMenuItem(this._weeklyItem);
        this.menu.addMenuItem(this._fiveHourResetItem);
        this.menu.addMenuItem(this._weeklyResetItem);
        this.menu.addMenuItem(this._creditsItem);
        this.menu.addMenuItem(this._sourceItem);
        this.menu.addMenuItem(this._updatedItem);
        this.menu.addMenuItem(this._staleItem);
        this.menu.addMenuItem(this._messageItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._refreshItem);

        this._refreshItem.connect('activate', () => this.refresh(true));

        this.refresh(false);
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            REFRESH_INTERVAL_SECONDS,
            () => {
                this.refresh(false);
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    refresh(manual) {
        if (this._refreshInFlight)
            return;

        this._refreshInFlight = true;
        this._refreshItem.label.text = manual ? 'Refreshing…' : 'Refresh now';

        const proc = Gio.Subprocess.new(
            ['/usr/bin/python3', this._helperPath],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        );

        proc.communicate_utf8_async(null, null, (subprocess, result) => {
            try {
                const [, stdout, stderr] = subprocess.communicate_utf8_finish(result);
                if (!subprocess.get_successful()) {
                    const message = (stderr || stdout || 'Unknown exporter failure').trim();
                    this._setError(message);
                    return;
                }

                const status = JSON.parse(stdout.trim());
                this._lastStatus = status;
                this._applyStatus(status);
            } catch (error) {
                this._setError(error.message);
            } finally {
                this._refreshInFlight = false;
                this._refreshItem.label.text = 'Refresh now';
            }
        });
    }

    _applyStatus(status) {
        if (!status.ok) {
            this._setError(status.message || 'Usage unavailable');
            return;
        }

        const fiveHour = Math.round(status.primary?.remaining_percent ?? 0);
        const weekly = Math.round(status.weekly?.remaining_percent ?? 0);
        const minimum = Math.min(fiveHour, weekly);
        const stale = Boolean(status.stale);

        this._valueLabel.text = stale ? `${minimum}%?` : `${minimum}%`;
        this._summaryItem.label.text = stale
            ? `Codex remaining ${minimum}% (stale)`
            : `Codex remaining ${minimum}%`;
        this._fiveHourItem.label.text = `5h left: ${fiveHour}%`;
        this._weeklyItem.label.text = `Week left: ${weekly}%`;
        this._fiveHourResetItem.label.text = `5h reset: ${status.primary?.resets_at_local ?? '--'}`;
        this._weeklyResetItem.label.text = `Week reset: ${status.weekly?.resets_at_local ?? '--'}`;
        this._creditsItem.label.text = `Credits: ${status.credits?.balance ?? '--'}`;
        this._sourceItem.label.text = `Source: ${status.source ?? '--'}`;
        this._updatedItem.label.text = `Updated: ${status.generated_at ?? '--'}`;
        this._staleItem.label.text = stale
            ? `State: stale (${(status.stale_reasons ?? []).join(', ') || 'unknown'})`
            : 'State: live';
        this._messageItem.label.text = `Plan: ${status.plan_type ?? '--'}`;

        this._applySeverityStyle(status.severity, stale);
    }

    _applySeverityStyle(severity, stale) {
        let color = '#9ca3af';
        if (!stale) {
            if (severity === 'high')
                color = '#34d399';
            else if (severity === 'medium')
                color = '#f59e0b';
            else if (severity === 'low')
                color = '#ef4444';
        }

        this._iconLabel.style = `font-weight: 700; margin-right: 6px; color: ${color};`;
        this._valueLabel.style = `font-weight: 700; color: ${color};`;
    }

    _setError(message) {
        this._valueLabel.text = 'ERR';
        this._summaryItem.label.text = 'Codex usage unavailable';
        this._fiveHourItem.label.text = '5h left: --';
        this._weeklyItem.label.text = 'Week left: --';
        this._fiveHourResetItem.label.text = '5h reset: --';
        this._weeklyResetItem.label.text = 'Week reset: --';
        this._creditsItem.label.text = 'Credits: --';
        this._sourceItem.label.text = 'Source: unavailable';
        this._updatedItem.label.text = 'Updated: --';
        this._staleItem.label.text = 'State: error';
        this._messageItem.label.text = message;
        this._applySeverityStyle('low', true);
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        super.destroy();
    }
});

export default class CodexUsageExtension extends Extension {
    enable() {
        this._indicator = new CodexUsageIndicator(this.path);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
