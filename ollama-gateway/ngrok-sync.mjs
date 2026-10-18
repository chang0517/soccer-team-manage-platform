import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, ".."); // raven-fc/
const CACHE_FILE = path.join(__dirname, ".last-ngrok-url");
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";
const GATEWAY_PORT = process.env.GATEWAY_PORT || "11435";
const VERCEL_BIN = process.env.VERCEL_BIN || "vercel";
// 바뀐 ngrok 주소를 직접 알려줄 플랫폼(멀티팀 앱) 주소들 — 쉼표로 여러 개.
// 플랫폼은 받은 주소를 DB에 저장해서 재배포 없이 바로 쓴다.
const REGISTER_URLS = (
  process.env.GATEWAY_REGISTER_URLS ||
  "https://soccer-team-manage-platform-jade.vercel.app/api/gateway/register"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// 예전 단독 앱(raven-fc) Vercel 프로젝트의 환경변수 갱신·재배포는 그 앱을
// 아직 쓰는 동안만 필요하다. 다 옮겼으면 SKIP_VERCEL_SYNC=1로 끈다.
const SKIP_VERCEL_SYNC = process.env.SKIP_VERCEL_SYNC === "1";
const REREGISTER_MS = 30 * 60 * 1000;
const registered = new Map(); // 대상 주소 → { url, at }

function gatewaySecret() {
  if (process.env.OLLAMA_GATEWAY_SECRET) return process.env.OLLAMA_GATEWAY_SECRET;
  // 게이트웨이 launchd plist에 넣어둔 시크릿을 그대로 읽어 쓴다(같은 값이어야 함).
  try {
    const plist = fs.readFileSync(
      path.join(process.env.HOME || "", "Library/LaunchAgents/com.ravenfc.ollamagateway.plist"),
      "utf8"
    );
    const m = plist.match(/<key>GATEWAY_SECRET<\/key>\s*<string>([^<]+)<\/string>/);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

async function registerWithPlatforms(url) {
  const secret = gatewaySecret();
  if (!secret) {
    log("시크릿을 찾지 못해 플랫폼 등록을 건너뜀 (OLLAMA_GATEWAY_SECRET 환경변수를 넣어주세요)");
    return;
  }
  for (const target of REGISTER_URLS) {
    const prev = registered.get(target);
    if (prev && prev.url === url && Date.now() - prev.at < REREGISTER_MS) continue;
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => "")}`);
      registered.set(target, { url, at: Date.now() });
      if (!prev || prev.url !== url) log(`플랫폼에 게이트웨이 주소 등록: ${target}`);
    } catch (e) {
      log(`플랫폼 등록 실패(${target}): ${e}`);
    }
  }
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function readCachedUrl() {
  try {
    return fs.readFileSync(CACHE_FILE, "utf8").trim();
  } catch {
    return null;
  }
}

function writeCachedUrl(url) {
  fs.writeFileSync(CACHE_FILE, url);
}

async function getNgrokPublicUrl() {
  const res = await fetch(NGROK_API);
  const data = await res.json();
  const tunnel = (data.tunnels || []).find((t) => t.proto === "https");
  return tunnel?.public_url ?? null;
}

async function syncVercelEnv(url) {
  log(`URL 변경 감지 → Vercel 환경변수 갱신: ${url}`);
  try {
    await execFileP(VERCEL_BIN, ["env", "rm", "OLLAMA_GATEWAY_URL", "production", "--yes"], {
      cwd: PROJECT_DIR,
    });
  } catch {
    // 기존 값이 없으면 실패하는 게 정상이라 무시한다.
  }
  await new Promise((resolve, reject) => {
    const child = spawn(VERCEL_BIN, ["env", "add", "OLLAMA_GATEWAY_URL", "production"], {
      cwd: PROJECT_DIR,
    });
    child.stdin.write(url);
    child.stdin.end();
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`env add exit ${code}`))));
  });
  log("Vercel 재배포 시작…");
  await execFileP(VERCEL_BIN, ["deploy", "--prod", "--yes"], { cwd: PROJECT_DIR });
  log("Vercel 재배포 완료");
  writeCachedUrl(url);
}

async function pollAndSync() {
  try {
    const url = await getNgrokPublicUrl();
    if (!url) return;
    await registerWithPlatforms(url);
    const cached = readCachedUrl();
    if (url !== cached) {
      if (SKIP_VERCEL_SYNC) writeCachedUrl(url);
      else await syncVercelEnv(url);
    }
  } catch (e) {
    log(`동기화 확인 중 오류: ${e}`);
  }
}

log("ngrok 실행…");
const ngrok = spawn(
  "ngrok",
  ["http", GATEWAY_PORT, "--log=stdout"],
  { stdio: ["ignore", "pipe", "pipe"] }
);
ngrok.stdout.on("data", (d) => process.stdout.write(`[ngrok] ${d}`));
ngrok.stderr.on("data", (d) => process.stderr.write(`[ngrok] ${d}`));
ngrok.on("exit", (code) => {
  log(`ngrok 종료됨 (code ${code}) — launchd가 전체 프로세스를 재시작할 거예요.`);
  process.exit(1);
});

// ngrok이 뜨는 데 시간이 걸리니 초반엔 짧은 간격으로, 이후엔 여유 있게 확인한다.
setTimeout(pollAndSync, 5000);
setInterval(pollAndSync, 60000);
