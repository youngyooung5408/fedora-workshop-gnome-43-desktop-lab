#!/usr/bin/env bash
set -euo pipefail

gsettings set org.gnome.desktop.interface accent-color \'blue\'
gsettings set org.gnome.desktop.interface avatar-directories @as\ \[\]
gsettings set org.gnome.desktop.interface can-change-accels false
gsettings set org.gnome.desktop.interface clock-format \'12h\'
gsettings set org.gnome.desktop.interface clock-show-date true
gsettings set org.gnome.desktop.interface clock-show-seconds false
gsettings set org.gnome.desktop.interface clock-show-weekday false
gsettings set org.gnome.desktop.interface color-scheme \'default\'
gsettings set org.gnome.desktop.interface cursor-blink true
gsettings set org.gnome.desktop.interface cursor-blink-time 1200
gsettings set org.gnome.desktop.interface cursor-blink-timeout 10
gsettings set org.gnome.desktop.interface cursor-size 24
gsettings set org.gnome.desktop.interface cursor-theme \'Adwaita\'
gsettings set org.gnome.desktop.interface document-font-name \'Adwaita\ Sans\ 12\'
gsettings set org.gnome.desktop.interface enable-animations true
gsettings set org.gnome.desktop.interface enable-hot-corners true
gsettings set org.gnome.desktop.interface font-antialiasing \'grayscale\'
gsettings set org.gnome.desktop.interface font-hinting \'slight\'
gsettings set org.gnome.desktop.interface font-name \'Adwaita\ Sans\ 11\'
gsettings set org.gnome.desktop.interface font-rendering \'automatic\'
gsettings set org.gnome.desktop.interface font-rgba-order \'rgb\'
gsettings set org.gnome.desktop.interface gtk-color-palette \'black:white:gray50:red:purple:blue:light\ blue:green:yellow:orange:lavender:brown:goldenrod4:dodger\ blue:pink:light\ green:gray10:gray30:gray75:gray90\'
gsettings set org.gnome.desktop.interface gtk-color-scheme \'\'
gsettings set org.gnome.desktop.interface gtk-enable-primary-paste true
gsettings set org.gnome.desktop.interface gtk-im-module \'\'
gsettings set org.gnome.desktop.interface gtk-im-preedit-style \'callback\'
gsettings set org.gnome.desktop.interface gtk-im-status-style \'callback\'
gsettings set org.gnome.desktop.interface gtk-key-theme \'Default\'
gsettings set org.gnome.desktop.interface gtk-theme \'Adwaita\'
gsettings set org.gnome.desktop.interface gtk-timeout-initial 200
gsettings set org.gnome.desktop.interface gtk-timeout-repeat 20
gsettings set org.gnome.desktop.interface icon-theme \'Adwaita\'
gsettings set org.gnome.desktop.interface locate-pointer false
gsettings set org.gnome.desktop.interface menubar-accel \'F10\'
gsettings set org.gnome.desktop.interface menubar-detachable false
gsettings set org.gnome.desktop.interface menus-have-tearoff false
gsettings set org.gnome.desktop.interface monospace-font-name \'Adwaita\ Mono\ 11\'
gsettings set org.gnome.desktop.interface overlay-scrolling true
gsettings set org.gnome.desktop.interface scaling-factor uint32\ 0
gsettings set org.gnome.desktop.interface show-battery-percentage false
gsettings set org.gnome.desktop.interface text-scaling-factor 1.25
gsettings set org.gnome.desktop.interface toolbar-detachable false
gsettings set org.gnome.desktop.interface toolbar-icons-size \'large\'
gsettings set org.gnome.desktop.interface toolbar-style \'both-horiz\'
gsettings set org.gnome.desktop.interface toolkit-accessibility false
gsettings set org.gnome.desktop.background color-shading-type \'solid\'
gsettings set org.gnome.desktop.background picture-opacity 100
gsettings set org.gnome.desktop.background picture-options \'zoom\'
gsettings set org.gnome.desktop.background picture-uri \'file:///usr/share/backgrounds/f43/default/f43-01-day.jxl\'
gsettings set org.gnome.desktop.background picture-uri-dark \'file:///usr/share/backgrounds/f43/default/f43-01-night.jxl\'
gsettings set org.gnome.desktop.background primary-color \'#023c88\'
gsettings set org.gnome.desktop.background secondary-color \'#5789ca\'
gsettings set org.gnome.desktop.background show-desktop-icons false
gsettings set org.gnome.desktop.wm.preferences action-double-click-titlebar \'toggle-maximize\'
gsettings set org.gnome.desktop.wm.preferences action-middle-click-titlebar \'none\'
gsettings set org.gnome.desktop.wm.preferences action-right-click-titlebar \'menu\'
gsettings set org.gnome.desktop.wm.preferences audible-bell true
gsettings set org.gnome.desktop.wm.preferences auto-raise false
gsettings set org.gnome.desktop.wm.preferences auto-raise-delay 500
gsettings set org.gnome.desktop.wm.preferences button-layout \':close\,maximize\,minimize\'
gsettings set org.gnome.desktop.wm.preferences disable-workarounds false
gsettings set org.gnome.desktop.wm.preferences focus-mode \'click\'
gsettings set org.gnome.desktop.wm.preferences focus-new-windows \'smart\'
gsettings set org.gnome.desktop.wm.preferences mouse-button-modifier \'\<Super\>\'
gsettings set org.gnome.desktop.wm.preferences num-workspaces 4
gsettings set org.gnome.desktop.wm.preferences raise-on-click true
gsettings set org.gnome.desktop.wm.preferences resize-with-right-button false
gsettings set org.gnome.desktop.wm.preferences theme \'Adwaita\'
gsettings set org.gnome.desktop.wm.preferences titlebar-font \'Adwaita\ Sans\ Bold\ 11\'
gsettings set org.gnome.desktop.wm.preferences titlebar-uses-system-font true
gsettings set org.gnome.desktop.wm.preferences visual-bell false
gsettings set org.gnome.desktop.wm.preferences visual-bell-type \'fullscreen-flash\'
gsettings set org.gnome.desktop.wm.preferences workspace-names @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings activate-window-menu \[\'\<Alt\>space\'\]
gsettings set org.gnome.desktop.wm.keybindings always-on-top @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings begin-move \[\'\<Alt\>F7\'\]
gsettings set org.gnome.desktop.wm.keybindings begin-resize \[\'\<Alt\>F8\'\]
gsettings set org.gnome.desktop.wm.keybindings close \[\'\<Alt\>F4\'\]
gsettings set org.gnome.desktop.wm.keybindings cycle-group \[\'\<Alt\>F6\'\]
gsettings set org.gnome.desktop.wm.keybindings cycle-group-backward \[\'\<Shift\>\<Alt\>F6\'\]
gsettings set org.gnome.desktop.wm.keybindings cycle-panels \[\'\<Control\>\<Alt\>Escape\'\]
gsettings set org.gnome.desktop.wm.keybindings cycle-panels-backward \[\'\<Shift\>\<Control\>\<Alt\>Escape\'\]
gsettings set org.gnome.desktop.wm.keybindings cycle-windows \[\'\<Alt\>Escape\'\]
gsettings set org.gnome.desktop.wm.keybindings cycle-windows-backward \[\'\<Shift\>\<Alt\>Escape\'\]
gsettings set org.gnome.desktop.wm.keybindings lower @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings maximize \[\'\<Super\>Up\'\]
gsettings set org.gnome.desktop.wm.keybindings maximize-horizontally @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings maximize-vertically @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings minimize \[\'\<Super\>h\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-center @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-corner-ne @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-corner-nw @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-corner-se @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-corner-sw @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-monitor-down \[\'\<Super\>\<Shift\>Down\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-monitor-left \[\'\<Super\>\<Shift\>Left\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-monitor-right \[\'\<Super\>\<Shift\>Right\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-monitor-up \[\'\<Super\>\<Shift\>Up\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-side-e @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-side-n @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-side-s @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-side-w @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-1 \[\'\<Super\>\<Shift\>Home\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-10 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-11 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-12 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-2 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-3 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-4 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-5 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-6 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-7 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-8 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-9 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-down \[\'\<Control\>\<Shift\>\<Alt\>Down\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-last \[\'\<Super\>\<Shift\>End\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-left \[\'\<Super\>\<Shift\>Page_Up\'\,\ \'\<Super\>\<Shift\>KP_Prior\'\,\ \'\<Super\>\<Shift\>\<Alt\>Left\'\,\ \'\<Control\>\<Shift\>\<Alt\>Left\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-right \[\'\<Super\>\<Shift\>Page_Down\'\,\ \'\<Super\>\<Shift\>KP_Next\'\,\ \'\<Super\>\<Shift\>\<Alt\>Right\'\,\ \'\<Control\>\<Shift\>\<Alt\>Right\'\]
gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-up \[\'\<Control\>\<Shift\>\<Alt\>Up\'\]
gsettings set org.gnome.desktop.wm.keybindings panel-main-menu @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings panel-run-dialog \[\'\<Alt\>F2\'\]
gsettings set org.gnome.desktop.wm.keybindings raise @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings raise-or-lower @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings set-spew-mark @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings show-desktop @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-applications \[\'\<Super\>Tab\'\,\ \'\<Alt\>Tab\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-applications-backward \[\'\<Shift\>\<Super\>Tab\'\,\ \'\<Shift\>\<Alt\>Tab\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-group \[\'\<Super\>Above_Tab\'\,\ \'\<Alt\>Above_Tab\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-group-backward \[\'\<Shift\>\<Super\>Above_Tab\'\,\ \'\<Shift\>\<Alt\>Above_Tab\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-input-source \[\'\<Super\>space\'\,\ \'XF86Keyboard\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-input-source-backward \[\'\<Shift\>\<Super\>space\'\,\ \'\<Shift\>XF86Keyboard\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-panels \[\'\<Control\>\<Alt\>Tab\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-panels-backward \[\'\<Shift\>\<Control\>\<Alt\>Tab\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-1 \[\'\<Super\>Home\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-10 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-11 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-12 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-2 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-3 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-4 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-5 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-6 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-7 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-8 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-9 @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-down \[\'\<Control\>\<Alt\>Down\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-last \[\'\<Super\>End\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-left \[\'\<Super\>Page_Up\'\,\ \'\<Super\>KP_Prior\'\,\ \'\<Super\>\<Alt\>Left\'\,\ \'\<Control\>\<Alt\>Left\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-right \[\'\<Super\>Page_Down\'\,\ \'\<Super\>KP_Next\'\,\ \'\<Super\>\<Alt\>Right\'\,\ \'\<Control\>\<Alt\>Right\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-up \[\'\<Control\>\<Alt\>Up\'\]
gsettings set org.gnome.desktop.wm.keybindings switch-windows @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings switch-windows-backward @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings toggle-above @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings toggle-fullscreen @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings toggle-maximized \[\'\<Alt\>F10\'\]
gsettings set org.gnome.desktop.wm.keybindings toggle-on-all-workspaces @as\ \[\]
gsettings set org.gnome.desktop.wm.keybindings unmaximize \[\'\<Super\>Down\'\,\ \'\<Alt\>F5\'\]
gsettings set org.gnome.desktop.input-sources current uint32\ 0
gsettings set org.gnome.desktop.input-sources mru-sources \[\(\'xkb\'\,\ \'us\'\)\,\ \(\'ibus\'\,\ \'chewing\'\)\]
gsettings set org.gnome.desktop.input-sources per-window false
gsettings set org.gnome.desktop.input-sources show-all-sources false
gsettings set org.gnome.desktop.input-sources sources \[\(\'xkb\'\,\ \'us\'\)\,\ \(\'ibus\'\,\ \'chewing\'\)\]
gsettings set org.gnome.desktop.input-sources xkb-model \'pc105+inet\'
gsettings set org.gnome.desktop.input-sources xkb-options \[\'altwin:swap_alt_win\'\]
gsettings set org.gnome.shell allow-extension-installation true
gsettings set org.gnome.shell always-show-log-out false
gsettings set org.gnome.shell app-picker-layout \[\{\'org.gnome.Contacts.desktop\':\ \<\{\'position\':\ \<0\>\}\>\,\ \'simple-scan.desktop\':\ \<\{\'position\':\ \<1\>\}\>\,\ \'org.gnome.Weather.desktop\':\ \<\{\'position\':\ \<2\>\}\>\,\ \'org.gnome.clocks.desktop\':\ \<\{\'position\':\ \<3\>\}\>\,\ \'org.gnome.Maps.desktop\':\ \<\{\'position\':\ \<4\>\}\>\,\ \'org.fedoraproject.MediaWriter.desktop\':\ \<\{\'position\':\ \<5\>\}\>\,\ \'org.gnome.Settings.desktop\':\ \<\{\'position\':\ \<6\>\}\>\,\ \'org.gnome.Boxes.desktop\':\ \<\{\'position\':\ \<7\>\}\>\,\ \'google-chrome.desktop\':\ \<\{\'position\':\ \<8\>\}\>\,\ \'org.gnome.Showtime.desktop\':\ \<\{\'position\':\ \<9\>\}\>\,\ \'org.gnome.Snapshot.desktop\':\ \<\{\'position\':\ \<10\>\}\>\,\ \'org.gnome.Characters.desktop\':\ \<\{\'position\':\ \<11\>\}\>\,\ \'Utilities\':\ \<\{\'position\':\ \<12\>\}\>\,\ \'System\':\ \<\{\'position\':\ \<13\>\}\>\,\ \'libreoffice-calc.desktop\':\ \<\{\'position\':\ \<14\>\}\>\,\ \'org.gnome.Tour.desktop\':\ \<\{\'position\':\ \<15\>\}\>\,\ \'org.gnome.Yelp.desktop\':\ \<\{\'position\':\ \<16\>\}\>\,\ \'libreoffice-impress.desktop\':\ \<\{\'position\':\ \<17\>\}\>\,\ \'libreoffice-writer.desktop\':\ \<\{\'position\':\ \<18\>\}\>\,\ \'org.gnome.Ptyxis.desktop\':\ \<\{\'position\':\ \<19\>\}\>\}\]
gsettings set org.gnome.shell command-history @as\ \[\]
gsettings set org.gnome.shell development-tools true
gsettings set org.gnome.shell disable-extension-version-validation false
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell disabled-extensions @as\ \[\]
gsettings set org.gnome.shell enabled-extensions \[\'background-logo@fedorahosted.org\'\,\ \'codex-usage@young\'\,\ \'bluetooth-battery@young\'\]
gsettings set org.gnome.shell favorite-apps \[\'org.mozilla.firefox.desktop\'\,\ \'org.gnome.Calendar.desktop\'\,\ \'org.gnome.Nautilus.desktop\'\,\ \'org.gnome.Software.desktop\'\,\ \'org.gnome.TextEditor.desktop\'\,\ \'org.gnome.Calculator.desktop\'\]
gsettings set org.gnome.shell last-selected-power-profile \'performance\'
gsettings set org.gnome.shell looking-glass-history @as\ \[\]
gsettings set org.gnome.shell remember-mount-password false
gsettings set org.gnome.shell welcome-dialog-last-shown-version \'49.1\'
gsettings set org.gnome.shell.app-switcher current-workspace-only false
gsettings set org.gnome.shell.keybindings focus-active-notification \[\'\<Super\>n\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-1 \[\'\<Super\>\<Control\>1\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-2 \[\'\<Super\>\<Control\>2\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-3 \[\'\<Super\>\<Control\>3\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-4 \[\'\<Super\>\<Control\>4\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-5 \[\'\<Super\>\<Control\>5\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-6 \[\'\<Super\>\<Control\>6\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-7 \[\'\<Super\>\<Control\>7\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-8 \[\'\<Super\>\<Control\>8\'\]
gsettings set org.gnome.shell.keybindings open-new-window-application-9 \[\'\<Super\>\<Control\>9\'\]
gsettings set org.gnome.shell.keybindings screen-brightness-cycle \[\'XF86MonBrightnessCycle\'\]
gsettings set org.gnome.shell.keybindings screen-brightness-cycle-monitor \[\'\<Shift\>XF86MonBrightnessCycle\'\]
gsettings set org.gnome.shell.keybindings screen-brightness-down \[\'XF86MonBrightnessDown\'\]
gsettings set org.gnome.shell.keybindings screen-brightness-down-monitor \[\'\<Shift\>XF86MonBrightnessDown\'\]
gsettings set org.gnome.shell.keybindings screen-brightness-up \[\'XF86MonBrightnessUp\'\]
gsettings set org.gnome.shell.keybindings screen-brightness-up-monitor \[\'\<Shift\>XF86MonBrightnessUp\'\]
gsettings set org.gnome.shell.keybindings screenshot \[\'\<Shift\>Print\'\]
gsettings set org.gnome.shell.keybindings screenshot-window \[\'\<Alt\>Print\'\]
gsettings set org.gnome.shell.keybindings shift-overview-down \[\'\<Super\>\<Alt\>Down\'\]
gsettings set org.gnome.shell.keybindings shift-overview-up \[\'\<Super\>\<Alt\>Up\'\]
gsettings set org.gnome.shell.keybindings show-screen-recording-ui \[\'\<Ctrl\>\<Shift\>\<Alt\>R\'\]
gsettings set org.gnome.shell.keybindings show-screenshot-ui \[\'Print\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-1 \[\'\<Super\>1\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-2 \[\'\<Super\>2\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-3 \[\'\<Super\>3\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-4 \[\'\<Super\>4\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-5 \[\'\<Super\>5\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-6 \[\'\<Super\>6\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-7 \[\'\<Super\>7\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-8 \[\'\<Super\>8\'\]
gsettings set org.gnome.shell.keybindings switch-to-application-9 \[\'\<Super\>9\'\]
gsettings set org.gnome.shell.keybindings toggle-application-view \[\'\<Super\>a\'\]
gsettings set org.gnome.shell.keybindings toggle-message-tray \[\'\<Super\>v\'\,\ \'\<Super\>m\'\]
gsettings set org.gnome.shell.keybindings toggle-overview @as\ \[\]
gsettings set org.gnome.shell.keybindings toggle-quick-settings \[\'\<Super\>s\'\]
gsettings set org.gnome.shell.window-switcher app-icon-mode \'both\'
gsettings set org.gnome.shell.window-switcher current-workspace-only true
gsettings set org.gnome.mutter attach-modal-dialogs true
gsettings set org.gnome.mutter auto-maximize true
gsettings set org.gnome.mutter center-new-windows true
gsettings set org.gnome.mutter check-alive-timeout uint32\ 5000
gsettings set org.gnome.mutter draggable-border-width 10
gsettings set org.gnome.mutter dynamic-workspaces true
gsettings set org.gnome.mutter edge-tiling true
gsettings set org.gnome.mutter experimental-features @as\ \[\]
gsettings set org.gnome.mutter focus-change-on-pointer-rest true
gsettings set org.gnome.mutter locate-pointer-key \'Control_L\'
gsettings set org.gnome.mutter output-luminance @a\(ssssud\)\ \[\]
gsettings set org.gnome.mutter overlay-key \'Super\'
gsettings set org.gnome.mutter workspaces-only-on-primary true
gsettings set org.gnome.mutter.keybindings cancel-input-capture \[\'\<Super\>\<Shift\>Escape\'\]
gsettings set org.gnome.mutter.keybindings rotate-monitor \[\'XF86RotateWindows\'\]
gsettings set org.gnome.mutter.keybindings switch-monitor \[\'\<Super\>p\'\,\ \'XF86Display\'\]
gsettings set org.gnome.mutter.keybindings toggle-tiled-left \[\'\<Super\>Left\'\]
gsettings set org.gnome.mutter.keybindings toggle-tiled-right \[\'\<Super\>Right\'\]
