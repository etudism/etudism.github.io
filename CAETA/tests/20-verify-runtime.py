import asyncio
import json
import mimetypes
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://caeta.test/'
INDEX_HTML = (ROOT / 'index.html').read_text(encoding='utf-8').replace('<head>', '<head><base href="https://caeta.test/">', 1)
OVERRIDES = {
    'scripts/lib/10-deps.js': ROOT / 'tests/10-deps-stub.js',
}
ALLOW_CONSOLE_SUBSTRINGS = [
    'favicon',
]


def content_type(path: Path) -> str:
    if path.suffix == '.js':
        return 'application/javascript'
    if path.suffix == '.css':
        return 'text/css'
    if path.suffix == '.html':
        return 'text/html'
    return mimetypes.guess_type(str(path))[0] or 'application/octet-stream'


async def main():
    logs = []
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 1024})

        def on_console(msg):
            entry = {'type': 'console', 'level': msg.type, 'text': msg.text}
            logs.append(entry)
            if msg.type == 'error' and not any(token in msg.text.lower() for token in ALLOW_CONSOLE_SUBSTRINGS):
                failures.append(entry)

        def on_pageerror(exc):
            entry = {'type': 'pageerror', 'text': str(exc)}
            logs.append(entry)
            failures.append(entry)

        page.on('console', on_console)
        page.on('pageerror', on_pageerror)

        async def handler(route, request):
            url = request.url
            if url.startswith(BASE):
                rel = url[len(BASE):].split('?', 1)[0].split('#', 1)[0]
                if rel in ('', '/'):
                    rel = 'index.html'
                path = OVERRIDES.get(rel, ROOT / rel)
                path = Path(path).resolve()
                if not str(path).startswith(str(ROOT.resolve())) and not str(path).startswith(str((ROOT / 'tests').resolve())):
                    await route.fulfill(status=403, body='Forbidden')
                    return
                if not path.exists():
                    await route.fulfill(status=404, body='Not found')
                    return
                await route.fulfill(status=200, body=path.read_bytes(), content_type=content_type(path))
                return
            # External requests are blocked in this environment; abort them explicitly
            await route.abort()

        await page.route('**/*', handler)
        await page.add_init_script("""
            (() => {
              const store = {};
              const fakeStorage = {
                getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
                setItem: (k, v) => { store[k] = String(v); },
                removeItem: (k) => { delete store[k]; },
                clear: () => { for (const k of Object.keys(store)) delete store[k]; },
                key: (i) => Object.keys(store)[i] ?? null,
                get length() { return Object.keys(store).length; }
              };
              Object.defineProperty(window, 'localStorage', { value: fakeStorage, configurable: true });
            })();
        """)
        try:
            await page.set_content(INDEX_HTML, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(10000)
            error_text = (await page.locator('#errorBox').text_content()) or ''
            logs.append({'type': 'errorBox', 'text': error_text})
            if error_text.strip():
                failures.append({'type': 'errorBox', 'text': error_text})
            await page.screenshot(path=str(ROOT / 'tests' / '40-verify-runtime.png'), full_page=True)
        finally:
            await browser.close()

    out = {'ok': not failures, 'failures': failures, 'logs': logs[-50:]}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    if failures:
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
