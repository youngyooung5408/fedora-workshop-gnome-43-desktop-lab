#!/usr/bin/env python3
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
DESKTOP = (ROOT / "profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/extension.js").read_text(encoding="utf-8")
BLUETOOTH = (ROOT / "profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young/extension.js").read_text(encoding="utf-8")


class LifecycleAssertions(unittest.TestCase):
    def test_overview_does_not_reparent_or_manually_scale_widgets(self):
        self.assertNotIn("workspace?._background?._bin", DESKTOP)
        self.assertNotIn("_reparentDesktopActor", DESKTOP)
        self.assertNotIn("OVERVIEW_FALLBACK_WIDGET_SCALE", DESKTOP)
        self.assertIn("_setBackgroundWidgetsVisible(false)", DESKTOP)

    def test_async_callbacks_and_repaint_are_lifecycle_guarded(self):
        self.assertIn("generation !== this._asyncGeneration", DESKTOP)
        self.assertIn("if (!this._enabled)", DESKTOP)
        self.assertIn("this._backgroundWidgetLayer?.visible", DESKTOP)
        self.assertIn("remove_all_transitions", DESKTOP)

    def test_bluetooth_keeps_connected_devices_without_percentage(self):
        self.assertIn("percentage = Number.isNaN(rawPercentage)", BLUETOOTH)
        self.assertIn("battery unavailable", BLUETOOTH)
        self.assertIn("input-mouse-symbolic", BLUETOOTH)


if __name__ == "__main__":
    unittest.main()
