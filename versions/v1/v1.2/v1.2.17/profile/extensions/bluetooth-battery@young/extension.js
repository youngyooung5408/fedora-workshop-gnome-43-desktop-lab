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
const UPOWER_BUS_NAME = 'org.freedesktop.UPower';
const UPOWER_PATH = '/org/freedesktop/UPower';
const UPOWER_IFACE = 'org.freedesktop.UPower';
const DBUS_PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';
const UPOWER_DEVICE_IFACE = 'org.freedesktop.UPower.Device';
const REFRESH_INTERVAL_SECONDS = 60;

const UPOWER_EXTERNAL_DEVICE_TYPES = new Set([
    5,  // mouse
    6,  // keyboard
    12, // gaming input
    14, // touchpad
    17, // headset
    18, // speakers
    19, // headphones
    22, // remote control
    28, // generic Bluetooth device
]);

const UPOWER_DEVICE_TYPE_NAMES = new Map([
    [5, 'Mouse'],
    [6, 'Keyboard'],
    [12, 'Gaming input'],
    [14, 'Touchpad'],
    [17, 'Headset'],
    [18, 'Speakers'],
    [19, 'Headphones'],
    [22, 'Remote control'],
    [28, 'Bluetooth device'],
]);

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

        const state = {
            pending: 2,
            devices: [],
            errors: [],
        };

        const complete = (devices, errorMessage) => {
            state.devices.push(...devices);
            if (errorMessage)
                state.errors.push(errorMessage);

            state.pending -= 1;
            if (state.pending > 0)
                return;

            try {
                const allDevices = this._dedupeDevices(state.devices);
                if (allDevices.length > 0 || state.errors.length < 2) {
                    this._applyDevices(allDevices);
                    if (allDevices.length === 0 && state.errors.length > 0)
                        this._messageItem.label.text = state.errors.join('; ');
                } else {
                    this._setError(state.errors.join('; '));
                }
            } finally {
                this._refreshInFlight = false;
                this._refreshItem.label.text = 'Refresh now';
            }
        };

        this._queryBluez(complete);
        this._queryUpower(complete);
    }

    _queryBluez(callback) {
        try {
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
                        callback(this._extractBatteryDevices(objects), null);
                    } catch (error) {
                        callback([], `BlueZ: ${error.message}`);
                    }
                }
            );
        } catch (error) {
            callback([], `BlueZ: ${error.message}`);
        }
    }

    _queryUpower(callback) {
        try {
            Gio.DBus.system.call(
                UPOWER_BUS_NAME,
                UPOWER_PATH,
                UPOWER_IFACE,
                'EnumerateDevices',
                null,
                new GLib.VariantType('(ao)'),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (connection, result) => {
                    let paths;

                    try {
                        const variant = connection.call_finish(result);
                        [paths] = variant.deep_unpack();
                    } catch (error) {
                        callback([], `UPower: ${error.message}`);
                        return;
                    }

                    if (paths.length === 0) {
                        callback([], null);
                        return;
                    }

                    const devices = [];
                    const errors = [];
                    let pending = paths.length;

                    const finish = () => {
                        pending -= 1;
                        if (pending > 0)
                            return;

                        callback(devices, errors.length > 0 ? `UPower: ${errors[0]}` : null);
                    };

                    for (const path of paths) {
                        Gio.DBus.system.call(
                            UPOWER_BUS_NAME,
                            path,
                            DBUS_PROPERTIES_IFACE,
                            'GetAll',
                            new GLib.Variant('(s)', [UPOWER_DEVICE_IFACE]),
                            new GLib.VariantType('(a{sv})'),
                            Gio.DBusCallFlags.NONE,
                            -1,
                            null,
                            (propertiesConnection, propertiesResult) => {
                                try {
                                    const propertiesVariant = propertiesConnection.call_finish(propertiesResult);
                                    const [properties] = propertiesVariant.deep_unpack();
                                    const device = this._extractUpowerDevice(path, properties);
                                    if (device)
                                        devices.push(device);
                                } catch (error) {
                                    errors.push(error.message);
                                } finally {
                                    finish();
                                }
                            }
                        );
                    }
                }
            );
        } catch (error) {
            callback([], `UPower: ${error.message}`);
        }
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
                percentage: Math.round(percentage),
                source: 'BlueZ',
            });
        }

        return devices;
    }

    _extractUpowerDevice(path, properties) {
        const percentage = Number(this._unpack(properties.Percentage));
        const type = Number(this._unpack(properties.Type) ?? -1);
        const isPresent = this._unpack(properties.IsPresent);

        if (isPresent === false || Number.isNaN(percentage))
            return null;

        if (!this._isExternalPowerDevice(properties, type))
            return null;

        return {
            path,
            name: this._upowerDeviceName(properties, path, type),
            percentage: Math.round(Math.max(0, Math.min(100, percentage))),
            source: 'UPower',
        };
    }

    _isExternalPowerDevice(properties, type) {
        if (UPOWER_EXTERNAL_DEVICE_TYPES.has(type))
            return true;

        const text = [
            properties.NativePath,
            properties.Model,
            properties.Vendor,
            properties.Serial,
        ]
            .map(value => String(this._unpack(value) ?? '').toLowerCase())
            .join(' ');

        return text.includes('bluetooth') ||
            text.includes('bluez') ||
            text.includes('hidpp') ||
            text.includes('unifying');
    }

    _upowerDeviceName(properties, path, type) {
        const model = String(this._unpack(properties.Model) ?? '').trim();
        const vendor = String(this._unpack(properties.Vendor) ?? '').trim();
        const fallback = UPOWER_DEVICE_TYPE_NAMES.get(type) ||
            this._lastPathPart(path) ||
            'Device';

        if (vendor && model && !model.toLowerCase().includes(vendor.toLowerCase()))
            return `${vendor} ${model}`;

        return model || vendor || fallback;
    }

    _dedupeDevices(devices) {
        const seen = new Set();
        const unique = [];

        for (const device of devices) {
            const key = `${device.name.toLowerCase()}:${Math.round(device.percentage)}`;
            if (seen.has(key))
                continue;

            seen.add(key);
            unique.push(device);
        }

        unique.sort((a, b) =>
            a.name.localeCompare(b.name) || a.source.localeCompare(b.source));

        return unique;
    }

    _deviceName(device, path) {
        const alias = this._unpack(device.Alias);
        const name = this._unpack(device.Name);
        const address = this._unpack(device.Address);

        return alias || name || address || this._lastPathPart(path) || 'Bluetooth device';
    }

    _unpack(value) {
        if (value instanceof GLib.Variant)
            return value.deep_unpack();

        return value;
    }

    _lastPathPart(path) {
        const parts = path.split('/').filter(part => part.length > 0);
        return parts.length > 0 ? parts[parts.length - 1] : null;
    }

    _applyDevices(devices) {
        this._devicesSection.removeAll();
        this._messageItem.label.text = '';

        if (devices.length === 0) {
            this._icon.icon_name = 'battery-missing-symbolic';
            this._valueLabel.text = '--';
            this._summaryItem.label.text = 'No connected device battery data';
            this._devicesSection.addMenuItem(new PopupMenu.PopupMenuItem('No BlueZ or UPower battery devices', {reactive: false}));
            this._updatedItem.label.text = `Updated: ${this._timeText()}`;
            return;
        }

        const lowest = devices.reduce((current, device) =>
            device.percentage < current.percentage ? device : current, devices[0]);

        this._icon.icon_name = this._batteryIconName(lowest.percentage);
        this._valueLabel.text = `${lowest.percentage}%`;
        this._summaryItem.label.text = devices.length === 1
            ? `${lowest.name}: ${lowest.percentage}%`
            : `Device battery: ${lowest.percentage}% lowest`;

        for (const device of devices) {
            const source = device.source ? ` (${device.source})` : '';
            const item = new PopupMenu.PopupMenuItem(
                `${device.name}: ${device.percentage}%${source}`,
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
        this._summaryItem.label.text = 'Device battery unavailable';
        this._devicesSection.addMenuItem(new PopupMenu.PopupMenuItem('Unable to read BlueZ or UPower battery data', {reactive: false}));
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
