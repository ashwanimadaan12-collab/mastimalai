import { BrowseGrid } from "@/components/BrowseGrid";

export const metadata = { title: "Movies" };

export default function MoviesPage() {
  return <BrowseGrid kind="movies" title="Movies" />;
}
