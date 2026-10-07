import json
import plistlib
import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECTS = [ROOT, ROOT / "frontend"]
MANAGED_PROJECT_ID = "e2d8d630-a4ef-4de0-987b-11e96504aa5d"


def _run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=str(cwd), check=True, capture_output=True, text=True, timeout=120)


def _copy_project_to_scratch(source: Path, scratch_root: Path) -> Path:
    scratch_project = scratch_root / source.name
    shutil.copytree(
        source,
        scratch_project,
        ignore=shutil.ignore_patterns(
            "node_modules",
            "ios",
            "android",
            ".expo",
            ".git",
            ".emergent",
            ".env",
            ".env.*",
            "backend",
            "temp_backend",
            "test_reports",
            "dist",
            "build",
            "*.pyc",
            "__pycache__",
        ),
    )

    node_modules_src = source / "node_modules"
    node_modules_dest = scratch_project / "node_modules"
    node_modules_dest.symlink_to(node_modules_src, target_is_directory=True)
    return scratch_project


def _normalize_frozen_config(prebuild_json: dict) -> dict:
    frozen = dict(prebuild_json)
    frozen.pop("_internal", None)
    frozen.pop("mods", None)

    frozen["name"] = "WANDERINGYACHT"
    frozen["version"] = "1.0.1"
    frozen["slug"] = "wandering-yacht"
    frozen.setdefault("ios", {})
    frozen["ios"]["bundleIdentifier"] = "com.wanderingyacht.app"
    frozen["ios"]["buildNumber"] = str(int(frozen["version"].replace(".", "")))
    frozen.setdefault("extra", {}).setdefault("eas", {})["projectId"] = MANAGED_PROJECT_ID
    return frozen


def _plugin_names(config: dict) -> list[str]:
    names = []
    for plugin in config.get("plugins", []):
        if isinstance(plugin, str):
            names.append(plugin)
        elif isinstance(plugin, list) and plugin:
            names.append(plugin[0])
    return names


# Managed pipeline regression checks: frozen config rewrite + prebuild entitlement outcomes.
def test_managed_freeze_prebuild_without_merchant_for_root_and_frontend():
    with tempfile.TemporaryDirectory(prefix="wy_managed_freeze_") as tmp:
        tmp_root = Path(tmp)

        for source in PROJECTS:
            scratch = _copy_project_to_scratch(source, tmp_root)

            frozen_stdout = _run(
                ["yarn", "--silent", "expo", "config", "--type", "prebuild", "--json"],
                cwd=scratch,
            ).stdout
            prebuild_json = json.loads(frozen_stdout)
            frozen = _normalize_frozen_config(prebuild_json)

            # Simulate pipeline freeze: write deterministic static app.json and remove dynamic config.
            (scratch / "app.json").write_text(json.dumps({"expo": frozen}, indent=2) + "\n")
            for dynamic_cfg in ("app.config.js", "app.config.ts"):
                p = scratch / dynamic_cfg
                if p.exists():
                    p.unlink()

            introspect_json = json.loads(
                _run(["yarn", "--silent", "expo", "config", "--type", "introspect", "--json"], cwd=scratch).stdout
            )

            internal_history = introspect_json.get("_internal", {}).get("pluginHistory", {})
            assert "@stripe/stripe-react-native" not in internal_history

            plugin_names = _plugin_names(frozen)
            assert "@stripe/stripe-react-native" not in plugin_names

            _run(["yarn", "--silent", "expo", "prebuild", "--platform", "ios", "--no-install", "--clean"], cwd=scratch)

            ios_root = scratch / "ios" / "WANDERINGYACHT"
            entitlements_path = ios_root / "WANDERINGYACHT.entitlements"
            info_plist_path = ios_root / "Info.plist"

            assert entitlements_path.exists()
            assert info_plist_path.exists()

            with entitlements_path.open("rb") as f:
                entitlements = plistlib.load(f)
            assert entitlements == {}
            assert "com.apple.developer.in-app-payments" not in entitlements

            with info_plist_path.open("rb") as f:
                info = plistlib.load(f)

            ui_fonts = info.get("UIAppFonts", [])
            assert "TraditionalArabic-Regular.ttf" in ui_fonts
            scene_manifest = info.get("UIApplicationSceneManifest", {})
            assert "UISceneConfigurations" in scene_manifest


# Stripe plugin behavior check from installed package source (no package source edits).
def test_installed_stripe_set_apple_pay_entitlement_behavior():
    script = r"""
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pluginPath = require.resolve('@stripe/stripe-react-native/src/plugin/withStripe.ts', { paths: [process.cwd()] });
const src = fs.readFileSync(pluginPath, 'utf8');

const start = src.indexOf('export function setApplePayEntitlement');
const endMarker = '\n\n/**';
const end = start >= 0 ? src.indexOf(endMarker, start) : -1;
if (start < 0 || end < 0) {
  throw new Error('setApplePayEntitlement function not found in installed Stripe plugin');
}

let fnCode = src.slice(start, end)
  .replace('export function setApplePayEntitlement(', 'function setApplePayEntitlement(')
  .replace(/merchantIdentifiers\s*:\s*string\s*\|\s*string\[\]\s*,/, 'merchantIdentifiers,')
  .replace(/entitlements\s*:\s*Record<string,\s*any>/, 'entitlements')
  .replace(/const merchants\s*:\s*string\[\]\s*=/, 'const merchants =')
  .replace(/\)\s*:\s*Record<string,\s*any>\s*\{/, ') {');

const context = {};
vm.createContext(context);
vm.runInContext(fnCode + '\nthis.setApplePayEntitlement = setApplePayEntitlement;', context);

const emptyResult = context.setApplePayEntitlement(undefined, {});
const merchantResult = context.setApplePayEntitlement('merchant.com.wanderingyacht.app', {});

process.stdout.write(JSON.stringify({ pluginPath, emptyResult, merchantResult }));
""".strip()

    with tempfile.TemporaryDirectory(prefix="wy_stripe_plugin_") as tmp:
        script_path = Path(tmp) / "check_stripe_entitlement.js"
        script_path.write_text(script)
        result = subprocess.run(
            ["node", str(script_path)],
            cwd=str(ROOT),
            check=False,
            capture_output=True,
            text=True,
        )

    assert result.returncode == 0, result.stderr

    payload = json.loads(result.stdout)
    assert payload["pluginPath"].endswith("/node_modules/@stripe/stripe-react-native/src/plugin/withStripe.ts")
    assert payload["emptyResult"] == {}
    assert payload["merchantResult"]["com.apple.developer.in-app-payments"] == [
        "merchant.com.wanderingyacht.app"
    ]
