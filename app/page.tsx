import { ToiletFinder } from "@/components/toilet-finder";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          가까운 공공화장실
        </h1>
        <p className="text-sm text-muted-foreground">
          내 위치에서 가까운 공공화장실을 가까운 순으로 보여드립니다.
        </p>
      </header>
      <ToiletFinder />
    </main>
  );
}
