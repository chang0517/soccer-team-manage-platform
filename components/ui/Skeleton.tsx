// 데이터가 오기 전에 실제 레이아웃과 비슷한 회색 자리를 먼저 보여줘서,
// 로딩이 끝날 때 화면이 덜컥 바뀌지 않게 한다.

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card space-y-2.5 p-4">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-4 w-20" />
      <div className="card space-y-3 p-5">
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="skeleton h-6 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-11 w-full rounded-2xl" />
      </div>
      <div className="card space-y-3 p-5">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
      </div>
    </div>
  );
}
