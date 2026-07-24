#!/usr/bin/env python3
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
DESKTOP = (ROOT / "profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/extension.js").read_text(encoding="utf-8")
BLUETOOTH = (ROOT / "profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young/extension.js").read_text(encoding="utf-8")


class LifecycleAssertions(unittest.TestCase):
    def test_overview_clones_widgets_without_reparenting_live_actor(self):
        self.assertIn("background?._bgManager?.backgroundActor", DESKTOP)
        self.assertIn("wallpaperActor.add_child(frame)", DESKTOP)
        self.assertIn("new Clutter.Clone", DESKTOP)
        self.assertIn("source: this._backgroundWidgetLayer", DESKTOP)
        self.assertIn("Shell.util_set_hidden_from_pick(frame, true)", DESKTOP)
        self.assertIn("_detachOverviewWidgetClone", DESKTOP)
        self.assertNotIn("workspace?._background?._bin ?? null", DESKTOP)
        self.assertNotIn("container.add_child(frame)", DESKTOP)
        self.assertNotIn("_reparentDesktopActor", DESKTOP)
        self.assertNotIn("OVERVIEW_FALLBACK_WIDGET_SCALE", DESKTOP)
        self.assertNotIn("_setBackgroundWidgetsVisible(false)", DESKTOP)

    def test_overview_clone_uses_one_aspect_preserving_scale(self):
        self.assertIn("layout_manager: new Clutter.FixedLayout()", DESKTOP)
        self.assertIn("_syncOverviewWidgetCloneGeometry", DESKTOP)
        self.assertIn("const scale = Math.min(", DESKTOP)
        self.assertIn("frame.set_size(wallpaperWidth, wallpaperHeight)", DESKTOP)
        self.assertIn("clone.set_size(sourceWidth, sourceHeight)", DESKTOP)
        self.assertIn("clone.set_scale(scale, scale)", DESKTOP)
        self.assertIn("'notify::allocation'", DESKTOP)
        frame_options = DESKTOP.split(
            "const frame = new Clutter.Actor({", 1
        )[1].split("});", 1)[0]
        self.assertNotIn("x_expand", frame_options)
        self.assertNotIn("y_expand", frame_options)
        clone_options = DESKTOP.split(
            "const clone = new Clutter.Clone({", 1
        )[1].split("});", 1)[0]
        self.assertNotIn("x_expand", clone_options)
        self.assertNotIn("y_expand", clone_options)

    def test_overview_replica_does_not_capture_window_drag_targets(self):
        self.assertIn("Shell.util_set_hidden_from_pick(frame, true)", DESKTOP)
        self.assertIn("Shell.util_set_hidden_from_pick(clone, true)", DESKTOP)
        self.assertIn("'window-drag-begin'", DESKTOP)
        self.assertIn("this._cancelDockDrag()", DESKTOP)

    def test_async_callbacks_and_repaint_are_lifecycle_guarded(self):
        self.assertIn("generation !== this._asyncGeneration", DESKTOP)
        self.assertIn("if (!this._enabled)", DESKTOP)
        self.assertIn("this._backgroundWidgetLayer?.visible", DESKTOP)
        self.assertIn("remove_all_transitions", DESKTOP)

    def test_market_editor_is_inline_automatic_and_bounded(self):
        self.assertIn("document-edit-symbolic", DESKTOP)
        self.assertIn("window-close-symbolic", DESKTOP)
        self.assertIn("this._marketAddButton.visible = this._marketEditing", DESKTOP)
        self.assertIn("'text-changed', () => this._scheduleMarketSearch()", DESKTOP)
        self.assertIn("MARKET_SEARCH_DEBOUNCE_MS", DESKTOP)
        self.assertIn("desktop-lab-v12-stock-search-scroll", DESKTOP)
        self.assertIn("MAX_MARKET_INSTRUMENTS = 10", DESKTOP)
        self.assertIn("desktop-lab-v12-market-rows-scroll", DESKTOP)
        self.assertIn("const chooserWidth = Math.max(1, Math.floor(marketWidth))", DESKTOP)
        self.assertNotIn("system-search-symbolic", DESKTOP)
        self.assertNotIn("Selected Instruments", DESKTOP)

    def test_running_apps_and_show_apps_share_one_left_dock(self):
        self.assertIn("Main.overview?.dash", DESKTOP)
        self.assertIn("_restoreOverviewDash", DESKTOP)
        self.assertIn("'app-state-changed'", DESKTOP)
        self.assertIn("get_running", DESKTOP)
        self.assertIn("_showApplications", DESKTOP)
        self.assertIn("view-app-grid-symbolic", DESKTOP)
        self.assertNotIn("desktop-lab-v12-running-apps-scroll", DESKTOP)
        self.assertNotIn("overview-apps", DESKTOP)

    def test_plain_area_click_dismisses_both_editors(self):
        self.assertIn("_dismissEditorsOutside", DESKTOP)
        self.assertIn("this._hideDockEditor()", DESKTOP)
        self.assertIn("this._setMarketEditing(false)", DESKTOP)

    def test_bluetooth_keeps_connected_devices_without_percentage(self):
        self.assertIn("percentage = Number.isNaN(rawPercentage)", BLUETOOTH)
        self.assertIn("battery unavailable", BLUETOOTH)
        self.assertIn("input-mouse-symbolic", BLUETOOTH)


if __name__ == "__main__":
    unittest.main()
