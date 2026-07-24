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
        this._destroyed = false;

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
            if (this._destroyed)
                return;
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

            if (!device)
                continue;

            const connected = this._unpack(device.Connected);
            if (!connected)
                continue;

            const rawPercentage = battery ? Number(this._unpack(battery.Percentage)) : Number.NaN;
            const percentage = Number.isNaN(rawPercentage)
                ? null
                : Math.round(Math.max(0, Math.min(100, rawPercentage)));

            devices.push({
                path,
                name: this._deviceName(device, path),
                address: String(this._unpack(device.Address) ?? '').trim(),
                nativePath: path,
                percentage,
                kind: this._bluezDeviceKind(device),
                source: 'BlueZ',
            });
        }

        return devices;
    }

    _extractUpowerDevice(path, properties) {
        const rawPercentage = Number(this._unpack(properties.Percentage));
        const type = Number(this._unpack(properties.Type) ?? -1);
        const isPresent = this._unpack(properties.IsPresent);

        if (isPresent === false)
            return null;

        if (!this._isExternalPowerDevice(properties, type))
            return null;

        return {
            path,
            name: this._upowerDeviceName(properties, path, type),
            address: '',
            nativePath: String(this._unpack(properties.NativePath) ?? ''),
            percentage: Number.isNaN(rawPercentage)
                ? null
                : Math.round(Math.max(0, Math.min(100, rawPercentage))),
            kind: this._upowerDeviceKind(type, properties),
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
        const merged = [];
        for (const device of devices) {
            const match = merged.find(existing => this._devicesMatch(existing, device));
            if (!match) {
                merged.push({...device});
                continue;
            }
            if (match.percentage === null && device.percentage !== null)
                match.percentage = device.percentage;
            if (match.kind === 'device' && device.kind !== 'device')
                match.kind = device.kind;
            if (device.source && !match.source.includes(device.source))
                match.source = `${match.source} + ${device.source}`;
            match.address ||= device.address;
            match.nativePath ||= device.nativePath;
        }
        merged.sort((a, b) => a.name.localeCompare(b.name));
        return merged;
    }

    _devicesMatch(first, second) {
        const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const firstAddress = normalize(first.address);
        const secondAddress = normalize(second.address);
        if (firstAddress && secondAddress && firstAddress === secondAddress)
            return true;
        const firstPath = normalize(first.nativePath);
        const secondPath = normalize(second.nativePath);
        if (firstAddress && secondPath.includes(firstAddress) || secondAddress && firstPath.includes(secondAddress))
            return true;
        return normalize(first.name).length >= 4 && normalize(first.name) === normalize(second.name);
    }

    _bluezDeviceKind(device) {
        const text = [device.Icon, device.Name, device.Alias]
            .map(value => String(this._unpack(value) ?? '').toLowerCase()).join(' ');
        const uuids = (this._unpack(device.UUIDs) ?? []).map(value => String(value).toLowerCase()).join(' ');
        if (text.includes('mouse'))
            return 'mouse';
        if (text.includes('keyboard'))
            return 'keyboard';
        if (text.includes('headset') || text.includes('headphone') || text.includes('audio'))
            return 'headset';
        if (uuids.includes('00001124-0000-1000-8000-00805f9b34fb'))
            return 'input';
        return 'device';
    }

    _upowerDeviceKind(type, properties) {
        if (type === 5)
            return 'mouse';
        if (type === 6)
            return 'keyboard';
        if ([17, 18, 19].includes(type))
            return 'headset';
        const text = [properties.Model, properties.NativePath]
            .map(value => String(this._unpack(value) ?? '').toLowerCase()).join(' ');
        if (text.includes('mouse'))
            return 'mouse';
        if (text.includes('keyboard'))
            return 'keyboard';
        if (text.includes('headset') || text.includes('headphone'))
            return 'headset';
        return 'device';
    }

    _deviceIconName(device) {
        if (device.kind === 'mouse')
            return 'input-mouse-symbolic';
        if (device.kind === 'keyboard' || device.kind === 'input')
            return 'input-keyboard-symbolic';
        if (device.kind === 'headset')
            return 'audio-headphones-symbolic';
        return 'bluetooth-active-symbolic';
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
            this._summaryItem.label.text = 'No connected Bluetooth devices';
            this._devicesSection.addMenuItem(new PopupMenu.PopupMenuItem('No connected BlueZ or UPower devices', {reactive: false}));
            this._updatedItem.label.text = `Updated: ${this._timeText()}`;
            return;
        }

        const batteryDevices = devices.filter(device => device.percentage !== null);
        const representative = batteryDevices.length > 0
            ? batteryDevices.reduce((current, device) => device.percentage < current.percentage ? device : current)
            : devices[0];

        this._icon.icon_name = this._deviceIconName(representative);
        this._valueLabel.text = representative.percentage === null ? '--' : `${representative.percentage}%`;
        this._summaryItem.label.text = devices.length === 1
            ? `${representative.name}: ${representative.percentage === null ? 'battery unavailable' : `${representative.percentage}%`}`
            : batteryDevices.length > 0
                ? `Bluetooth devices: ${representative.percentage}% lowest`
                : 'Connected devices: battery unavailable';

        for (const device of devices) {
            const source = device.source ? ` (${device.source})` : '';
            const level = device.percentage === null ? 'battery unavailable' : `${device.percentage}%`;
            const item = new PopupMenu.PopupImageMenuItem(
                `${device.name}: ${level}${source}`,
                this._deviceIconName(device)
            );
            item.reactive = false;
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
        this._destroyed = true;
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
