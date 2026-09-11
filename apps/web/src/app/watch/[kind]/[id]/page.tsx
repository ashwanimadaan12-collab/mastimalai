import { notFound } from "next/navigation";
import { Player } from "@/components/Player";

export const metadata = { title: "Watch" };

export default function WatchPage({
  params,
}: {
  params: { kind: string; id: string };
}) {
  if (params.kind !== "movie" && params.kind !== "episode") notFound();
  return <Player kind={params.kind as "movie" | "episode"} id={params.id} />;
}
