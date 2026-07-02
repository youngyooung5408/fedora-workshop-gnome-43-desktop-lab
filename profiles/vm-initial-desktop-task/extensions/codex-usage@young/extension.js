import Cairo from 'cairo';
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
const ICON_SIZE = 24;
const TAU = Math.PI * 2;

const ICON_COLORS = {
    high: [0.20, 0.83, 0.60],
    medium: [0.96, 0.62, 0.04],
    low: [0.94, 0.27, 0.27],
    stale: [0.61, 0.64, 0.69],
    track: [0.45, 0.49, 0.56],
    background: [0.06, 0.08, 0.11],
    text: [0.98, 0.99, 1.00],
};

const CodexUsageIndicator = GObject.registerClass(
class CodexUsageIndicator extends PanelMenu.Button {
    _init(extensionPath) {
        super._init(0.0, 'Codex Usage');

        this._extensionPath = extensionPath;
        this._helperPath = GLib.build_filenamev([extensionPath, 'export_codex_usage.py']);
        this._timeoutId = null;
        this._refreshInFlight = false;
        this._lastStatus = null;
        this._fiveHourPercent = null;
        this._weeklyPercent = null;
        this._iconStale = true;

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._usageIcon = new St.DrawingArea({
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-icon',
        });
        this._usageIcon.set_size(ICON_SIZE, ICON_SIZE);
        this._usageIcon.connect('repaint', area => this._drawUsageIcon(area));

        this._valueLabel = new St.Label({
            text: '--',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'codex-usage-value',
        });

        box.add_child(this._usageIcon);
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

        this._setIconPercents(fiveHour, weekly, stale);
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

        this._valueLabel.style = `font-weight: 700; color: ${color};`;
    }

    _setError(message) {
        this._setIconPercents(null, null, true);
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

    _setIconPercents(fiveHourPercent, weeklyPercent, stale) {
        this._fiveHourPercent = this._clampPercent(fiveHourPercent);
        this._weeklyPercent = this._clampPercent(weeklyPercent);
        this._iconStale = stale;
        this._usageIcon.queue_repaint();
    }

    _clampPercent(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value)))
            return null;

        return Math.max(0, Math.min(100, Number(value)));
    }

    _drawUsageIcon(area) {
        const [width, height] = area.get_surface_size();
        const cr = area.get_context();

        try {
            const size = Math.max(1, Math.min(width, height));
            const centerX = width / 2;
            const centerY = height / 2;
            const fiveHour = this._fiveHourPercent ?? 0;
            const weekly = this._weeklyPercent ?? 0;
            const fiveHourColor = this._colorForPercent(fiveHour);
            const weeklyColor = this._colorForPercent(weekly);
            const outerRadius = Math.max(2, (size / 2) - 2);
            const innerRadius = Math.max(2, outerRadius - 5);

            cr.setLineWidth(2.4);
            this._setSource(cr, ICON_COLORS.track, 0.42);
            cr.arc(centerX, centerY, outerRadius, 0, TAU);
            cr.stroke();

            if (this._fiveHourPercent !== null) {
                this._setSource(cr, fiveHourColor, this._iconStale ? 0.70 : 1.0);
                cr.arc(
                    centerX,
                    centerY,
                    outerRadius,
                    -Math.PI / 2,
                    (-Math.PI / 2) + (TAU * (fiveHour / 100))
                );
                cr.stroke();
            }

            this._setSource(cr, ICON_COLORS.background, 0.90);
            cr.arc(centerX, centerY, innerRadius, 0, TAU);
            cr.fill();

            cr.save();
            cr.arc(centerX, centerY, innerRadius, 0, TAU);
            cr.clip();
            this._setSource(cr, weeklyColor, this._iconStale ? 0.70 : 0.95);
            const fillHeight = innerRadius * 2 * (weekly / 100);
            cr.rectangle(
                centerX - innerRadius,
                centerY + innerRadius - fillHeight,
                innerRadius * 2,
                fillHeight
            );
            cr.fill();
            cr.restore();

            this._setSource(cr, ICON_COLORS.track, 0.58);
            cr.setLineWidth(1.0);
            cr.arc(centerX, centerY, innerRadius, 0, TAU);
            cr.stroke();

            cr.selectFontFace('Sans', Cairo.FontSlant.NORMAL, Cairo.FontWeight.BOLD);
            cr.setFontSize(Math.max(10, size * 0.55));
            const extents = cr.textExtents('C');
            this._setSource(cr, ICON_COLORS.text, this._iconStale ? 0.78 : 0.95);
            cr.moveTo(
                centerX - (extents.width / 2) - extents.xBearing,
                centerY - (extents.height / 2) - extents.yBearing
            );
            cr.showText('C');
        } finally {
            cr.$dispose();
        }
    }

    _colorForPercent(percent) {
        if (this._iconStale)
            return ICON_COLORS.stale;
        if (percent <= 20)
            return ICON_COLORS.low;
        if (percent <= 50)
            return ICON_COLORS.medium;
        return ICON_COLORS.high;
    }

    _setSource(cr, color, alpha) {
        cr.setSourceRGBA(color[0], color[1], color[2], alpha);
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
