"""Regression tests for ROOT_DIR-based StaticFiles mounts (fonts/screenshots)."""

import ast
import hashlib
import os
import shutil
from contextlib import contextmanager
from pathlib import Path

import pytest
import requests
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = BACKEND_ROOT / "server.py"
FONT_NAME = "TraditionalArabic-Regular.ttf"
SCREENSHOT_NAME = "ios_01_welcome.png"
SOURCE_FONT = BACKEND_ROOT / "static_fonts" / FONT_NAME
SOURCE_SCREENSHOT = BACKEND_ROOT / "store-screenshots" / SCREENSHOT_NAME


def _sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _extract_mount_source() -> tuple[str, list[str]]:
    source = SERVER_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    root_assign = None
    mount_lines: list[str] = []

    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "ROOT_DIR":
                    root_assign = ast.get_source_segment(source, node)
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            call = node.value
            if isinstance(call.func, ast.Attribute) and call.func.attr == "mount":
                if call.args and isinstance(call.args[0], ast.Constant):
                    route = call.args[0].value
                    if route in {"/api/fonts", "/api/screenshots"}:
                        mount_lines.append(ast.get_source_segment(source, node))

    if not root_assign:
        raise AssertionError("ROOT_DIR assignment not found in server.py")
    if len(mount_lines) != 2:
        raise AssertionError("Expected exactly two static asset mounts in server.py")
    return root_assign, mount_lines


@contextmanager
def _cwd(path: Path):
    previous = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(previous)


def _build_isolated_app(module_path: Path, working_dir: Path) -> FastAPI:
    root_assign, mount_lines = _extract_mount_source()
    namespace = {
        "__file__": str(module_path),
        "Path": Path,
        "FastAPI": FastAPI,
        "StaticFiles": StaticFiles,
    }
    snippet = "\n".join([root_assign, "app = FastAPI()", *mount_lines])
    with _cwd(working_dir):
        exec(compile(snippet, str(module_path), "exec"), namespace)
    return namespace["app"]


def _copy_assets(target_root: Path):
    (target_root / "static_fonts").mkdir(parents=True, exist_ok=True)
    (target_root / "store-screenshots").mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE_FONT, target_root / "static_fonts" / FONT_NAME)
    shutil.copy2(SOURCE_SCREENSHOT, target_root / "store-screenshots" / SCREENSHOT_NAME)


@pytest.fixture(scope="module")
def source_hashes():
    return {
        "font": _sha256_bytes(SOURCE_FONT.read_bytes()),
        "screenshot": _sha256_bytes(SOURCE_SCREENSHOT.read_bytes()),
    }


@pytest.fixture(scope="module")
def isolated_clients(tmp_path_factory):
    base = tmp_path_factory.mktemp("static_mount_layouts")

    nested_backend = base / "nested" / "backend"
    nested_backend.mkdir(parents=True, exist_ok=True)
    nested_server = nested_backend / "server.py"
    nested_server.write_text("# isolated nested server placeholder\n", encoding="utf-8")
    _copy_assets(nested_backend)

    flattened_runtime = base / "flattened"
    flattened_runtime.mkdir(parents=True, exist_ok=True)
    flattened_server = flattened_runtime / "server.py"
    flattened_server.write_text("# isolated flattened server placeholder\n", encoding="utf-8")
    _copy_assets(flattened_runtime)

    random_cwd = base / "different_cwd"
    random_cwd.mkdir(parents=True, exist_ok=True)

    nested_app = _build_isolated_app(nested_server, random_cwd)
    flat_app = _build_isolated_app(flattened_server, random_cwd)

    return {
        "nested": TestClient(nested_app),
        "flattened": TestClient(flat_app),
    }


# Module wiring integrity: extracted source must remain ROOT_DIR-based and not /app/backend-hardcoded.
def test_server_mounts_are_root_relative_not_hardcoded():
    _, mount_lines = _extract_mount_source()
    combined = "\n".join(mount_lines)
    assert "ROOT_DIR" in combined
    assert "/app/backend" not in combined


# Startup guardrail: hardcoded outside-fixture static dir should be rejected at mount-time.
def test_old_style_hardcoded_external_path_is_rejected(tmp_path):
    invalid_path = tmp_path / "outside" / "backend" / "static_fonts"
    app = FastAPI()
    with pytest.raises(RuntimeError):
        app.mount("/api/fonts", StaticFiles(directory=str(invalid_path)), name="fonts")


@pytest.mark.parametrize("layout", ["nested", "flattened"])
# Asset serving: font bytes and hash must match tracked source in both layouts.
def test_font_asset_serves_expected_bytes(isolated_clients, source_hashes, layout):
    resp = isolated_clients[layout].get(f"/api/fonts/{FONT_NAME}")
    assert resp.status_code == 200
    assert _sha256_bytes(resp.content) == source_hashes["font"]


@pytest.mark.parametrize("layout", ["nested", "flattened"])
# Asset serving: screenshot file should return PNG bytes exactly as tracked source.
def test_screenshot_asset_serves_expected_png(isolated_clients, source_hashes, layout):
    resp = isolated_clients[layout].get(f"/api/screenshots/{SCREENSHOT_NAME}")
    assert resp.status_code == 200
    assert "image/png" in resp.headers.get("content-type", "")
    assert _sha256_bytes(resp.content) == source_hashes["screenshot"]


@pytest.mark.parametrize("layout", ["nested", "flattened"])
# Error handling: missing static file returns 404.
def test_missing_asset_returns_404(isolated_clients, layout):
    resp = isolated_clients[layout].get("/api/screenshots/does-not-exist.png")
    assert resp.status_code == 404


@pytest.mark.parametrize("layout", ["nested", "flattened"])
# Security: traversal attempts must not escape static roots.
def test_path_traversal_is_blocked(isolated_clients, layout):
    resp = isolated_clients[layout].get("/api/screenshots/../server.py")
    assert resp.status_code in (404, 400)


@pytest.fixture(scope="module")
def public_base_url():
    base_url = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not base_url:
        env_file = BACKEND_ROOT.parent / "frontend" / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    base_url = line.split("=", 1)[1].strip()
                    break
    if not base_url:
        pytest.skip("EXPO_PUBLIC_BACKEND_URL not set; skipping preview endpoint checks")
    return base_url.rstrip("/")


# Live preview readonly check: mounted font must be publicly reachable and byte-exact.
def test_preview_font_endpoint_matches_source(public_base_url, source_hashes):
    resp = requests.get(f"{public_base_url}/api/fonts/{FONT_NAME}", timeout=20)
    assert resp.status_code == 200
    assert _sha256_bytes(resp.content) == source_hashes["font"]


# Live preview readonly check: representative screenshot endpoint should return expected PNG bytes.
def test_preview_screenshot_endpoint_matches_source(public_base_url, source_hashes):
    resp = requests.get(f"{public_base_url}/api/screenshots/{SCREENSHOT_NAME}", timeout=20)
    assert resp.status_code == 200
    assert "image/png" in resp.headers.get("content-type", "")
    assert _sha256_bytes(resp.content) == source_hashes["screenshot"]


# Live preview safety check: traversal path must not expose files outside static roots.
def test_preview_traversal_is_blocked(public_base_url):
    resp = requests.get(
        f"{public_base_url}/api/screenshots/../server.py",
        timeout=20,
    )
    assert resp.status_code in (400, 404)


# Optional sanity check: non-static API route should still respond.
def test_preview_categories_optional(public_base_url):
    resp = requests.get(f"{public_base_url}/api/categories", timeout=20)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
