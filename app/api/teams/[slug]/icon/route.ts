import sharp from "sharp";
import { getTeamBySlug } from "@/lib/db";

// 홈 화면 앱 아이콘용 팀 로고. 안드로이드는 192·512 정사각형 PNG가 필요한데 팀이
// 올린 로고는 크기·비율이 제각각이라 여기서 맞춰서 내려준다. maskable=1이면
// 휴대폰이 아이콘을 둥글게·모서리 둥글게 잘라도 안 잘리도록 여백을 두고 흰 바탕에 올린다.
const SIZES = new Set([192, 512]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size"));
  const maskable = url.searchParams.get("maskable") === "1";
  if (!SIZES.has(size)) return new Response("bad size", { status: 400 });

  const team = await getTeamBySlug(slug);
  const logo = team?.logoUrl;
  if (!logo) return new Response("not found", { status: 404 });

  try {
    let source: Buffer;
    if (logo.startsWith("/")) {
      // 앱에 같이 넣어둔 로고(/team-logos/…)는 자기 사이트에서 가져온다.
      const res = await fetch(new URL(logo, request.url));
      if (!res.ok) return new Response("not found", { status: 404 });
      source = Buffer.from(await res.arrayBuffer());
    } else {
      const m = logo.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return new Response("not found", { status: 404 });
      source = Buffer.from(m[1], "base64");
    }

    const transparent = { r: 255, g: 255, b: 255, alpha: 0 };
    let png: Buffer;
    if (maskable) {
      const inner = Math.round(size * 0.7);
      const logoPng = await sharp(source)
        .resize(inner, inner, { fit: "contain", background: transparent })
        .png()
        .toBuffer();
      png = await sharp({
        create: { width: size, height: size, channels: 4, background: "#ffffff" },
      })
        .composite([{ input: logoPng, gravity: "center" }])
        .png()
        .toBuffer();
    } else {
      png = await sharp(source)
        .resize(size, size, { fit: "contain", background: transparent })
        .png()
        .toBuffer();
    }
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // 주소의 v가 로고가 바뀌면 달라지므로 오래 캐시해도 된다.
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("[team icon] failed:", e);
    return new Response("failed", { status: 500 });
  }
}
