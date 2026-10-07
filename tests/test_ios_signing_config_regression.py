import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

ROOT_APP_JSON = ROOT / "app.json"
FRONT_APP_JSON = FRONTEND / "app.json"

ROOT_INTROSPECT = Path("/tmp/wy-root-ios-config.json")
FRONT_INTROSPECT = Path("/tmp/wy-frontend-ios-config.json")

ROOT_SCRATCH = Path("/tmp/wy_scratch_root_b23_fresh")
FRONT_SCRATCH = Path("/tmp/wy_scratch_front_b23_fresh")


def _read_json(path: Path):
    return json.loads(path.read_text())


def _load_expo(path: Path):
    return _read_json(path)["expo"]


def _plugins_without_project_noise(expo_cfg: dict):
    # Keep plugin validation deterministic across root/frontend
    return expo_cfg.get("plugins", [])


def _assert_no_stripe_native_plugin(plugins):
    plugin_names = []
    for plugin in plugins:
        if isinstance(plugin, str):
            plugin_names.append(plugin)
        elif isinstance(plugin, list) and plugin:
            plugin_names.append(plugin[0])
    assert "@stripe/stripe-react-native" not in plugin_names
    assert "stripe" not in [name.lower() for name in plugin_names]


# iOS signing regression guardrails: config parity + no Apple Pay entitlements + scene/font retention
class TestIosSigningConfigRegression:
    def test_root_and_frontend_app_json_core_parity(self):
        root_expo = _load_expo(ROOT_APP_JSON)
        front_expo = _load_expo(FRONT_APP_JSON)

        assert root_expo["ios"]["bundleIdentifier"] == "com.wanderingyacht.app"
        assert front_expo["ios"]["bundleIdentifier"] == "com.wanderingyacht.app"
        assert root_expo["ios"]["buildNumber"] == "23"
        assert front_expo["ios"]["buildNumber"] == "23"

        assert root_expo["ios"].get("merchantIdentifier") is None
        assert front_expo["ios"].get("merchantIdentifier") is None

        assert _plugins_without_project_noise(root_expo) == _plugins_without_project_noise(front_expo)

    def test_no_stripe_native_plugin_in_both_app_json(self):
        root_expo = _load_expo(ROOT_APP_JSON)
        front_expo = _load_expo(FRONT_APP_JSON)

        _assert_no_stripe_native_plugin(root_expo.get("plugins", []))
        _assert_no_stripe_native_plugin(front_expo.get("plugins", []))

    def test_scene_and_font_plugins_retained(self):
        root_expo = _load_expo(ROOT_APP_JSON)

        plugins = root_expo.get("plugins", [])
        has_scene_support = False
        has_font_embed = False

        for plugin in plugins:
            if isinstance(plugin, list) and plugin and plugin[0] == "expo-build-properties":
                has_scene_support = plugin[1].get("ios", {}).get("enableSceneSupport") is True
            if isinstance(plugin, list) and plugin and plugin[0] == "expo-font":
                has_font_embed = "./assets/fonts/TraditionalArabic-Regular.ttf" in plugin[1].get("ios", {}).get("fonts", [])

        assert has_scene_support
        assert has_font_embed

    def test_introspection_outputs_have_empty_ios_entitlements(self):
        if not ROOT_INTROSPECT.exists() or not FRONT_INTROSPECT.exists():
            pytest.skip("Introspection artifacts are missing in /tmp")

        root_cfg = _read_json(ROOT_INTROSPECT)
        front_cfg = _read_json(FRONT_INTROSPECT)

        assert root_cfg["ios"]["entitlements"] == {}
        assert front_cfg["ios"]["entitlements"] == {}

        root_plugin_history = root_cfg.get("_internal", {}).get("pluginHistory", {})
        front_plugin_history = front_cfg.get("_internal", {}).get("pluginHistory", {})

        assert "@stripe/stripe-react-native" not in root_plugin_history
        assert "@stripe/stripe-react-native" not in front_plugin_history

    def test_scratch_prebuild_entitlements_absence_and_parity(self):
        root_ent = ROOT_SCRATCH / "ios" / "WANDERINGYACHT" / "WANDERINGYACHT.entitlements"
        front_ent = FRONT_SCRATCH / "ios" / "WANDERINGYACHT" / "WANDERINGYACHT.entitlements"

        if not root_ent.exists() or not front_ent.exists():
            pytest.skip("Scratch prebuild artifacts missing")

        root_text = root_ent.read_text()
        front_text = front_ent.read_text()

        assert "<dict/>" in root_text
        assert "com.apple.developer.in-app-payments" not in root_text
        assert "merchant.com.wanderingyacht.app" not in root_text

        assert root_text == front_text

    def test_scratch_info_plist_scene_font_and_build(self):
        root_info = ROOT_SCRATCH / "ios" / "WANDERINGYACHT" / "Info.plist"
        front_info = FRONT_SCRATCH / "ios" / "WANDERINGYACHT" / "Info.plist"

        if not root_info.exists() or not front_info.exists():
            pytest.skip("Scratch Info.plist missing")

        root_text = root_info.read_text()
        front_text = front_info.read_text()

        assert "EXExpoAppSceneDelegate" in root_text
        assert "TraditionalArabic-Regular.ttf" in root_text
        assert "<string>23</string>" in root_text
        assert "com.apple.developer.in-app-payments" not in root_text

        assert root_text == front_text

    def test_scratch_app_delegate_scene_runtime_shape(self):
        root_delegate = ROOT_SCRATCH / "ios" / "WANDERINGYACHT" / "AppDelegate.swift"
        front_delegate = FRONT_SCRATCH / "ios" / "WANDERINGYACHT" / "AppDelegate.swift"

        if not root_delegate.exists() or not front_delegate.exists():
            pytest.skip("Scratch AppDelegate.swift missing")

        root_text = root_delegate.read_text()
        front_text = front_delegate.read_text()

        assert "ExpoReactNativeFactoryProvider" in root_text
        assert "return super.application(application, didFinishLaunchingWithOptions: launchOptions)" in root_text
        assert "self.window = UIWindow" not in root_text

        assert root_text == front_text
