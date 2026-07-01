import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const BLUEZ_BUS_NAME = 'org.bluez';
const OBJECT_MANAGER_PATH = '/';
const OBJECT_MANAGER_IFACE = 'org.freedesktop.DBus.ObjectManager';
const DEVICE_IFACE = 'org.bluez.Device1';
const BATTERY_IFACE = 'org.bluez.Battery1';
const REFRESH_INTERVAL_SECONDS = 60;

const BluetoothBatteryIndicator = GObject.registerClass(
class BluetoothBatteryIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Bluetooth Battery');

        this._timeoutId = null;
        this._refreshInFlight = false;

        const box = new St.BoxLayout({
            style_class: 'panel-status-menu-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'battery-missing-symbolic',
            style_class: 'system-status-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._valueLabel = new St.Label({
            text: '--',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'bluetooth-battery-value',
            style: 'margin-left: 6px; font-weight: 700;',
        });

        box.add_child(this._icon);
        box.add_child(this._valueLabel);
        this.add_child(box);

        this._summaryItem = new PopupMenu.PopupMenuItem('Bluetooth battery: loading...', {reactive: false});
        this._devicesSection = new PopupMenu.PopupMenuSection();
        this._updatedItem = new PopupMenu.PopupMenuItem('Updated: --', {reactive: false});
        this._messageItem = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._refreshItem = new PopupMenu.PopupMenuItem('Refresh now');

        this.menu.addMenuItem(this._summaryItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._devicesSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._updatedItem);
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
        this._refreshItem.label.text = manual ? 'Refreshing...' : 'Refresh now';

        Gio.DBus.system.call(
            BLUEZ_BUS_NAME,
            OBJECT_MANAGER_PATH,
            OBJECT_MANAGER_IFACE,
            'GetManagedObjects',
            null,
            new GLib.VariantType('(a{oa{sa{sv}}})'),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, result) => {
                try {
                    const variant = connection.call_finish(result);
                    const [objects] = variant.deep_unpack();
                    this._applyDevices(this._extractBatteryDevices(objects));
                } catch (error) {
                    this._setError(error.message);
                } finally {
                    this._refreshInFlight = false;
                    this._refreshItem.label.text = 'Refresh now';
                }
            }
        );
    }

    _extractBatteryDevices(objects) {
        const devices = [];

        for (const path of Object.keys(objects)) {
            const interfaces = objects[path] ?? {};
            const device = interfaces[DEVICE_IFACE];
            const battery = interfaces[BATTERY_IFACE];

            if (!device || !battery)
                continue;

            const connected = this._unpack(device.Connected);
            const percentage = Number(this._unpack(battery.Percentage));

            if (!connected || Number.isNaN(percentage))
                continue;

            devices.push({
                path,
                name: this._deviceName(device, path),
                percentage,
            });
        }

        devices.sort((a, b) => a.name.localeCompare(b.name));
        return devices;
    }

    _deviceName(device, path) {
        const alias = this._unpack(device.Alias);
        const name = this._unpack(device.Name);
        const address = this._unpack(device.Address);

        return alias || name || address || path.split('/').at(-1) || 'Bluetooth device';
    }

    _unpack(value) {
        if (value instanceof GLib.Variant)
            return value.deep_unpack();

        return value;
    }

    _applyDevices(devices) {
        this._devicesSection.removeAll();
        this._messageItem.label.text = '';

        if (devices.length === 0) {
            this._icon.icon_name = 'battery-missing-symbolic';
            this._valueLabel.text = '--';
            this._summaryItem.label.text = 'No connected Bluetooth battery devices';
            this._devicesSection.addMenuItem(new PopupMenu.PopupMenuItem('No connected battery-reporting devices', {reactive: false}));
            this._updatedItem.label.text = `Updated: ${this._timeText()}`;
            return;
        }

        const lowest = devices.reduce((current, device) =>
            device.percentage < current.percentage ? device : current, devices[0]);

        this._icon.icon_name = this._batteryIconName(lowest.percentage);
        this._valueLabel.text = `${lowest.percentage}%`;
        this._summaryItem.label.text = devices.length === 1
            ? `${lowest.name}: ${lowest.percentage}%`
            : `Bluetooth battery: ${lowest.percentage}% lowest`;

        for (const device of devices) {
            const item = new PopupMenu.PopupMenuItem(
                `${device.name}: ${device.percentage}%`,
                {reactive: false}
            );
            this._devicesSection.addMenuItem(item);
        }

        this._updatedItem.label.text = `Updated: ${this._timeText()}`;
    }

    _batteryIconName(percentage) {
        const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

        if (clamped <= 5)
            return 'battery-level-0-symbolic';

        const bucket = Math.min(100, Math.max(10, Math.round(clamped / 10) * 10));
        return `battery-level-${bucket}-symbolic`;
    }

    _setError(message) {
        this._devicesSection.removeAll();
        this._icon.icon_name = 'battery-missing-symbolic';
        this._valueLabel.text = 'ERR';
        this._summaryItem.label.text = 'Bluetooth battery unavailable';
        this._devicesSection.addMenuItem(new PopupMenu.PopupMenuItem('Unable to read BlueZ battery data', {reactive: false}));
        this._updatedItem.label.text = `Updated: ${this._timeText()}`;
        this._messageItem.label.text = message;
    }

    _timeText() {
        return GLib.DateTime.new_now_local().format('%H:%M:%S');
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        super.destroy();
    }
});

export default class BluetoothBatteryExtension extends Extension {
    enable() {
        this._indicator = new BluetoothBatteryIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
