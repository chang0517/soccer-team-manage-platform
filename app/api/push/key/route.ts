// 웹 푸시 공개키. NEXT_PUBLIC_ 값은 빌드할 때 화면 코드에 박혀서, 환경변수를
// 나중에 추가하거나 바꾸면 다시 배포하기 전까지 화면이 모른다. 서버가 실행
// 중에 읽어서 내려주면 서버용 키(VAPID_PUBLIC_KEY)만 있어도 알림을 켤 수 있다.
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  return Response.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}
