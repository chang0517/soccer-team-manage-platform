// 안드로이드 크롬 등 Vibration API를 지원하는 기기에서만 짧게 진동한다(iOS
// 사파리는 미지원이라 조용히 무시된다).
export function haptic(ms = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // 일부 브라우저는 사용자 제스처 밖에서 호출하면 예외를 던진다
    }
  }
}
