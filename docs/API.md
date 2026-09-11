# Masti Malai OTT — API (Phase 1)

Base URL (dev): `http://localhost:4000`. JSON everywhere. Auth via `Authorization: Bearer <access>`.
Profile-scoped calls also take `X-Profile-Id: <profileId>`.

## Auth
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/send-otp` | `{ mobile }` | Dev mode returns `{ otp }` in the response. |
| POST | `/auth/verify-otp` | `{ mobile, otp }` | Returns `{ accessToken, refreshToken, user }`; creates user + default profile on first login. |
| POST | `/auth/refresh` | `{ refreshToken }` | Rotates tokens. |
| POST | `/auth/logout` | `{ refreshToken }` | Revokes the refresh token. |

## Users & profiles (auth required)
| GET | `/users/me` | — | Current user + profiles + active subscription. |
| PATCH | `/users/me` | `{ email? }` | |
| GET | `/profiles` | | |
| POST | `/profiles` | `{ name, isKids?, avatar?, language? }` | Enforces max-profile limit. |
| PATCH | `/profiles/:id` | | |
| DELETE | `/profiles/:id` | | Cannot delete the last profile. |

## Catalog (public reads; premium gated at playback)
| GET | `/genres` / `/languages` | | Reference lists. |
| GET | `/movies` | `?genre=&language=&year=&access=&q=&page=&limit=` | Published only. |
| GET | `/movies/:slug` | | Detail incl. cast, genres, related. |
| GET | `/series` | filters as movies | |
| GET | `/series/:slug` | | Detail incl. seasons + episodes. |
| GET | `/search` | `?q=` | Movies, series, episodes, cast. |

## Home
| GET | `/home` | `X-Profile-Id?` | Assembled sections (hero + carousels), including a live
Continue-Watching section when a profile is supplied. Fully DB-driven. |

## Watch (auth + profile)
| POST | `/watch/progress` | `{ movieId? , episodeId?, positionSec, durationSec }` | Upsert. |
| GET | `/watch/continue` | | Continue-watching list. |
| GET | `/watch/history` | | History; supports `DELETE /watch/history/:id` and `DELETE /watch/history`. |

## Watchlist (auth + profile)
| GET | `/watchlist` | `?sort=recent|az` | |
| POST | `/watchlist` | `{ movieId? , seriesId? }` | |
| DELETE | `/watchlist/:id` | | |

## Billing
| GET | `/plans` | | Active plans, ordered. |
| GET | `/subscriptions/me` | auth | Current entitlement. |
| POST | `/payments/create-order` | `{ planId, couponCode? }` (auth) | **Local sandbox** order. |
| POST | `/payments/verify` | `{ orderId, sandboxApprove }` (auth) | Verifies server-side, activates subscription. Idempotent. |

## Playback (auth + profile)
| POST | `/playback/token` | `{ movieId? , episodeId? }` | Runs full access-control chain; returns a
short-lived signed token + stream URL. **Premium content requires an active subscription.** |
| GET | `/playback/stream?token=` | | Verifies token, serves/redirects to the HLS/stream URL. |

## Conventions
- Errors: `{ error: { code, message, details? } }` with correct HTTP status.
- Lists: `{ items, page, limit, total }`.
- Validation: zod; 400 on invalid input. Rate limits on `/auth/*`.
