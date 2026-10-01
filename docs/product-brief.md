# Afilados Club: the season headquarters

Afilados Club gives a small, known group of friends a private headquarters for an annual season of deliberately over-important fun. Marco's family being away is the premise for turning ordinary activities into a comically serious mission. This is not a corporate dashboard or a multitenant SaaS product.

## The experience

Imagine a sports season, a festival, and a fantasy competition treating every plan as a high-importance event. The stakes are playful; the presentation takes them very seriously. A trivial activity can become a major fixture, and an everyday prediction can receive the gravitas of a championship forecast.

Conceptual examples, not implemented UI:

- **PRETEMPORADA** and **TEMPORADA ABIERTA** frame the buildup and active season.
- **DÍA 7 DE 24** presents the season as a campaign in progress.
- **AFILÓMETRO** and **Nivel de afilado** give exaggerated sporting weight to participation and readiness.
- An ordinary gathering can be presented as a decisive festival event; a prediction about it can become a solemn competitive forecast.

Season 2026 is scheduled for **November 28–December 22**. The day-count phrase above is a conceptual example, not a calculation or a settled calendar rule.

## Product boundaries

WhatsApp remains the main chat. Afilados Club is the season HQ, not another social network. Favor depth, clarity, and a memorable identity over feature volume. Reuse the foundation yearly while keeping seasons distinct and archivable.

Privacy and security are mandatory, not optional polish. Future member data, activity, votes, photos, and scores must be private by default and protected by authorization and Supabase RLS. This bootstrap does not implement those controls or expose such data.

## Future modules — not bootstrap deliverables

| Area             | Future context                                           |
| ---------------- | -------------------------------------------------------- |
| Season entry     | Home, countdown, and season status                       |
| People and plans | Members; **El Afiladero** proposals/voting; calendar     |
| Play             | Trivia, predictions, and bingo                           |
| Progress         | **Afilómetro**, achievements, and in-season statistics   |
| Memories         | Photos/highlights, **Season Recap**, and seasons archive |

The current deliverable is only a verified technical foundation and a minimal smoke screen. Authentication, schema, countdowns, games, and definitive visual design require later explicit scope.
