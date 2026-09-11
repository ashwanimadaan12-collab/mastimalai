// Masti Malai OTT — seed. DEMO DATA (clearly marked). Safe to re-run: it wipes
// and re-creates catalog/home rows. Users/subscriptions are left untouched.
import { PrismaClient, Access } from "@prisma/client";

const prisma = new PrismaClient();

// Public HLS test streams so the player works locally without a transcoder.
const STREAMS = {
  bunny: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  bipbop:
    "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
  tears: "https://test-streams.mux.dev/pts_shift/master.m3u8",
};
const poster = (seed: string) => `https://picsum.photos/seed/${seed}/400/600`;
const backdrop = (seed: string) => `https://picsum.photos/seed/${seed}-bd/1280/720`;

async function main() {
  console.log("Seeding Masti Malai OTT demo data…");

  // Wipe catalog + home (order matters for FKs).
  await prisma.homeSectionItem.deleteMany();
  await prisma.heroItem.deleteMany();
  await prisma.homeSection.deleteMany();
  await prisma.castMember.deleteMany();
  await prisma.episode.deleteMany();
  await prisma.season.deleteMany();
  await prisma.series.deleteMany();
  await prisma.movie.deleteMany();
  await prisma.videoAsset.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.language.deleteMany();
  await prisma.subscriptionPlan.deleteMany();

  // Languages
  const langData = [
    ["Hindi", "hi"],
    ["Punjabi", "pa"],
    ["Tamil", "ta"],
    ["Telugu", "te"],
    ["Bengali", "bn"],
    ["English", "en"],
  ];
  const languages = Object.fromEntries(
    await Promise.all(
      langData.map(async ([name, code]) => [
        code,
        await prisma.language.create({ data: { name, code } }),
      ]),
    ),
  );

  // Genres
  const genreNames = [
    "Comedy",
    "Romance",
    "Action",
    "Thriller",
    "Family",
    "Drama",
    "Kids",
  ];
  const genres = Object.fromEntries(
    await Promise.all(
      genreNames.map(async (name) => [
        name,
        await prisma.genre.create({
          data: { name, slug: name.toLowerCase() },
        }),
      ]),
    ),
  );

  // ---- Movies ----
  const movieSpecs = [
    { slug: "masti-original-2026", title: "Masti Original", g: ["Comedy", "Family"], lang: "hi", access: "PREMIUM", year: 2026, dur: 596, feat: true, trend: true, top: true, stream: STREAMS.bunny, rating: 8.4, age: "U/A 13+" },
    { slug: "dil-ki-baat", title: "Dil Ki Baat", g: ["Romance", "Drama"], lang: "hi", access: "PREMIUM", year: 2025, dur: 888, trend: true, top: true, stream: STREAMS.bipbop, rating: 7.9, age: "U/A 13+" },
    { slug: "shera-punjabi", title: "Shera", g: ["Action", "Thriller"], lang: "pa", access: "PREMIUM", year: 2025, dur: 634, trend: true, top: true, stream: STREAMS.tears, rating: 8.1, age: "A" },
    { slug: "hasi-mazaak", title: "Hasi Mazaak", g: ["Comedy"], lang: "hi", access: "FREE", year: 2024, dur: 596, feat: false, trend: true, stream: STREAMS.bunny, rating: 7.2, age: "U" },
    { slug: "chennai-express-nights", title: "Chennai Nights", g: ["Action", "Drama"], lang: "ta", access: "PREMIUM", year: 2025, dur: 888, top: true, stream: STREAMS.bipbop, rating: 7.6, age: "U/A 13+" },
    { slug: "hyderabad-heat", title: "Hyderabad Heat", g: ["Thriller"], lang: "te", access: "PREMIUM", year: 2024, dur: 634, stream: STREAMS.tears, rating: 7.0, age: "U/A 16+" },
    { slug: "ghar-ki-masti", title: "Ghar Ki Masti", g: ["Family", "Comedy"], lang: "hi", access: "FREE", year: 2023, dur: 596, stream: STREAMS.bunny, rating: 6.8, age: "U" },
    { slug: "kolkata-kahani", title: "Kolkata Kahani", g: ["Drama", "Romance"], lang: "bn", access: "PREMIUM", year: 2025, dur: 888, stream: STREAMS.bipbop, rating: 8.0, age: "U/A 13+" },
    { slug: "little-heroes", title: "Little Heroes", g: ["Kids", "Family"], lang: "hi", access: "FREE", year: 2024, dur: 596, stream: STREAMS.bunny, rating: 7.5, age: "U" },
    { slug: "midnight-chase", title: "Midnight Chase", g: ["Action", "Thriller"], lang: "en", access: "PREMIUM", year: 2026, dur: 634, feat: true, trend: true, stream: STREAMS.tears, rating: 8.3, age: "A" },
  ] as const;

  const movies: Record<string, any> = {};
  for (const s of movieSpecs) {
    const asset = await prisma.videoAsset.create({
      data: { status: "READY", streamUrl: s.stream, durationSec: s.dur },
    });
    movies[s.slug] = await prisma.movie.create({
      data: {
        slug: s.slug,
        title: s.title,
        description: `${s.title} — ek zabardast ${s.g[0].toLowerCase()} kahani, sirf Masti Malai par. Entertainment ka full tadka!`,
        poster: poster(s.slug),
        backdrop: backdrop(s.slug),
        trailerUrl: s.stream,
        year: s.year,
        durationSec: s.dur,
        ageRating: s.age,
        rating: s.rating,
        access: s.access as Access,
        status: "PUBLISHED",
        isFeatured: (s as any).feat ?? false,
        isTrending: (s as any).trend ?? false,
        isTop10: (s as any).top ?? false,
        languageId: languages[s.lang].id,
        genres: { connect: s.g.map((g) => ({ id: genres[g].id })) },
        videoAssetId: asset.id,
        seoTitle: `${s.title} (${s.year}) — Watch on Masti Malai OTT`,
        seoDescription: `Stream ${s.title} in ${langData.find((l) => l[1] === s.lang)?.[0]} on Masti Malai OTT.`,
        cast: {
          create: [
            { name: "Aarav Khanna", character: "Lead", role: "ACTOR", order: 0 },
            { name: "Isha Verma", character: "Lead", role: "ACTOR", order: 1 },
            { name: "R. Menon", role: "DIRECTOR", order: 0 },
          ],
        },
      },
    });
  }

  // ---- Series ----
  const seriesSpecs = [
    { slug: "masti-house", title: "Masti House", g: ["Comedy", "Family"], lang: "hi", access: "PREMIUM", year: 2026, seasons: 2, epsPerSeason: 4, feat: true, trend: true, top: true },
    { slug: "mumbai-diaries-masti", title: "Mumbai Diaries", g: ["Drama", "Thriller"], lang: "hi", access: "PREMIUM", year: 2025, seasons: 1, epsPerSeason: 5, trend: true, top: true },
    { slug: "punjab-express", title: "Punjab Express", g: ["Action", "Drama"], lang: "pa", access: "PREMIUM", year: 2025, seasons: 1, epsPerSeason: 3, top: true },
    { slug: "tamil-tales", title: "Tamil Tales", g: ["Drama"], lang: "ta", access: "FREE", year: 2024, seasons: 1, epsPerSeason: 3 },
    { slug: "kids-adventure-club", title: "Kids Adventure Club", g: ["Kids", "Family"], lang: "hi", access: "FREE", year: 2024, seasons: 1, epsPerSeason: 4 },
  ] as const;

  const streamList = [STREAMS.bunny, STREAMS.bipbop, STREAMS.tears];
  const seriesRows: Record<string, any> = {};
  for (const s of seriesSpecs) {
    const series = await prisma.series.create({
      data: {
        slug: s.slug,
        title: s.title,
        description: `${s.title} — binge kariye poori series sirf Masti Malai par.`,
        poster: poster(s.slug),
        backdrop: backdrop(s.slug),
        year: s.year,
        ageRating: "U/A 13+",
        access: s.access as Access,
        status: "PUBLISHED",
        isFeatured: (s as any).feat ?? false,
        isTrending: (s as any).trend ?? false,
        isTop10: (s as any).top ?? false,
        languageId: languages[s.lang].id,
        genres: { connect: s.g.map((g) => ({ id: genres[g].id })) },
        cast: {
          create: [
            { name: "Kabir Rao", character: "Lead", role: "ACTOR", order: 0 },
            { name: "Meera Nair", character: "Lead", role: "ACTOR", order: 1 },
          ],
        },
      },
    });
    seriesRows[s.slug] = series;
    for (let sn = 1; sn <= s.seasons; sn++) {
      const season = await prisma.season.create({
        data: { seriesId: series.id, number: sn, title: `Season ${sn}` },
      });
      for (let ep = 1; ep <= s.epsPerSeason; ep++) {
        const stream = streamList[(ep - 1) % streamList.length];
        const asset = await prisma.videoAsset.create({
          data: { status: "READY", streamUrl: stream, durationSec: 596 },
        });
        // First episode of first season is free as a taster.
        const access: Access = sn === 1 && ep === 1 ? "FREE" : (s.access as Access);
        await prisma.episode.create({
          data: {
            seasonId: season.id,
            number: ep,
            title: `Episode ${ep}`,
            description: `${s.title} S${sn}E${ep} — masti jaari hai!`,
            thumbnail: backdrop(`${s.slug}-s${sn}e${ep}`),
            durationSec: 596,
            introEndSec: 30,
            access,
            status: "PUBLISHED",
            videoAssetId: asset.id,
          },
        });
      }
    }
  }

  // ---- Subscription plans ----
  await prisma.subscriptionPlan.createMany({
    data: [
      { name: "Daily", priceInPaise: 9900, currency: "INR", durationDays: 1, description: "1 din ka full access", features: ["All movies & series", "HD streaming", "1 device"], displayOrder: 1 },
      { name: "Monthly", priceInPaise: 19900, currency: "INR", durationDays: 30, description: "30 din, best for regulars", features: ["All movies & series", "Full HD", "2 devices", "No ads on premium"], displayOrder: 2 },
      { name: "6 Months", priceInPaise: 39900, compareAtPriceInPaise: 119400, currency: "INR", durationDays: 180, description: "Save more — sabse popular", features: ["Everything in Monthly", "3 devices", "Kids profiles", "Priority support"], isRecommended: true, displayOrder: 3 },
    ],
  });

  // ---- Homepage sections (dynamic, DB-driven) ----
  const heroSection = await prisma.homeSection.create({
    data: { title: "Featured", type: "HERO", displayOrder: 0, isActive: true },
  });
  await prisma.heroItem.createMany({
    data: [
      { sectionId: heroSection.id, title: "Masti Original", subtitle: "Masti Original • 2026", description: "Entertainment ka full tadka. Dekho abhi, sirf Masti Malai par.", backdrop: backdrop("masti-original-2026"), poster: poster("masti-original-2026"), trailerUrl: STREAMS.bunny, ctaLabel: "Watch Now", targetKind: "movie", targetSlug: "masti-original-2026", order: 0, isActive: true },
      { sectionId: heroSection.id, title: "Midnight Chase", subtitle: "New Action Thriller", description: "Ek raat, ek chase, poora suspense.", backdrop: backdrop("midnight-chase"), poster: poster("midnight-chase"), trailerUrl: STREAMS.tears, ctaLabel: "Watch Now", targetKind: "movie", targetSlug: "midnight-chase", order: 1, isActive: true },
      { sectionId: heroSection.id, title: "Masti House", subtitle: "Original Series", description: "Season 2 out now. Binge the masti!", backdrop: backdrop("masti-house"), poster: poster("masti-house"), ctaLabel: "Watch Now", targetKind: "series", targetSlug: "masti-house", order: 2, isActive: true },
    ],
  });

  async function carousel(title: string, order: number, type: "CAROUSEL" | "TOP10", refs: { movie?: string; series?: string }[]) {
    const section = await prisma.homeSection.create({
      data: { title, type, displayOrder: order, isActive: true },
    });
    await prisma.homeSectionItem.createMany({
      data: refs.map((r, i) => ({
        sectionId: section.id,
        movieId: r.movie ? movies[r.movie].id : null,
        seriesId: r.series ? seriesRows[r.series].id : null,
        order: i,
      })),
    });
  }

  // Continue Watching placeholder section (populated live per profile).
  await prisma.homeSection.create({
    data: { title: "Continue Watching", type: "CONTINUE_WATCHING", displayOrder: 1, isActive: true },
  });

  await carousel("Trending Now", 2, "CAROUSEL", [
    { movie: "masti-original-2026" }, { series: "masti-house" }, { movie: "dil-ki-baat" }, { movie: "shera-punjabi" }, { movie: "midnight-chase" }, { series: "mumbai-diaries-masti" }, { movie: "hasi-mazaak" },
  ]);
  await carousel("Top 10 in India", 3, "TOP10", [
    { movie: "masti-original-2026" }, { movie: "dil-ki-baat" }, { series: "masti-house" }, { movie: "shera-punjabi" }, { movie: "chennai-express-nights" }, { series: "mumbai-diaries-masti" }, { movie: "midnight-chase" }, { series: "punjab-express" }, { movie: "hyderabad-heat" }, { movie: "kolkata-kahani" },
  ]);
  await carousel("Masti Originals", 4, "CAROUSEL", [
    { movie: "masti-original-2026" }, { series: "masti-house" }, { series: "mumbai-diaries-masti" },
  ]);
  await carousel("Comedy Tadka", 5, "CAROUSEL", [
    { movie: "hasi-mazaak" }, { movie: "ghar-ki-masti" }, { series: "masti-house" }, { movie: "masti-original-2026" },
  ]);
  await carousel("Hindi Movies", 6, "CAROUSEL", [
    { movie: "masti-original-2026" }, { movie: "dil-ki-baat" }, { movie: "hasi-mazaak" }, { movie: "ghar-ki-masti" },
  ]);
  await carousel("Regional Spotlight", 7, "CAROUSEL", [
    { movie: "shera-punjabi" }, { movie: "chennai-express-nights" }, { movie: "hyderabad-heat" }, { movie: "kolkata-kahani" }, { series: "punjab-express" }, { series: "tamil-tales" },
  ]);
  await carousel("Kids Zone", 8, "CAROUSEL", [
    { movie: "little-heroes" }, { series: "kids-adventure-club" }, { movie: "ghar-ki-masti" },
  ]);

  console.log(
    `Seed complete: ${movieSpecs.length} movies, ${seriesSpecs.length} series, 3 plans, home sections + hero.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
