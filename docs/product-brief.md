# Afilados Club: the season headquarters

Afilados Club gives a small, known group of friends a private headquarters for an annual season of deliberately over-important fun. Marco's family being away is the premise for turning ordinary activities into a comically serious mission. This is not a corporate dashboard or a multitenant SaaS product.

## The experience

Imagine a sports season, a festival, and a fantasy competition treating every plan as a high-importance event. The stakes are playful; the presentation takes them very seriously. A trivial activity can become a major fixture, and an everyday prediction can receive the gravitas of a championship forecast.

Season vocabulary:

- **PRETEMPORADA** and **TEMPORADA ABIERTA** frame the buildup and active season.
- **DÍA 7 DE 23** presents the season as a campaign in progress.
- **AFILÓMETRO** and **Nivel de afilado** give exaggerated sporting weight to participation and readiness.
- An ordinary gathering can be presented as a decisive festival event; a prediction about it can become a solemn competitive forecast.

Season 2026 opens **November 28 at 07:25** and closes **December 21 at 07:25 (exclusive)**, in `America/La_Paz`: exactly **23 days**. Planning dates are November 28–December 20 inclusive. Day numbers follow La Paz calendar dates, not elapsed 24-hour intervals. December 21 is departure-only: Home remains live before 07:25 but shows departure copy, never Day 24. Activities may finish that morning only with an explicit end time no later than 07:25; all-day departure coverage is forbidden. Home derives its countdown, phase, dates and day numbers from one temporal source. The preseason **Nivel de afilado** is elapsed preparation time from October 1 midnight, reaching 100% only at opening, not member activity or a social metric.

## Product boundaries

WhatsApp remains the main chat. Afilados Club is the season HQ, not another social network. Favor depth, clarity, and a memorable identity over feature volume. Reuse the foundation yearly while keeping seasons distinct and archivable.

Privacy and security are mandatory, not optional polish. Home, El Afiladero and the calendar use Google-only entry, verified server identity, active membership checks and Supabase RLS. The approved-access roster uses hashes rather than product email columns. Photos, scores and future private data still require explicit authorization and RLS before exposure.

## Future modules — not bootstrap deliverables

| Area             | Future context                                             |
| ---------------- | ---------------------------------------------------------- |
| People and plans | Future member tools beyond the existing plans and calendar |
| Play             | Trivia, predictions, and bingo                             |
| Progress         | **Afilómetro**, achievements, and in-season statistics     |
| Memories         | Photos/highlights, **Season Recap**, and seasons archive   |

Block 1 adds editorial Home and temporal warmup; Block 2 adds private access; Block 3 adds El Afiladero proposals and votes. Block 4 adds the 23-date calendar and corrects the temporal window without redesigning Home. Any active member can schedule an idea without a vote threshold. An activity is an independent, editable content snapshot with one fixed source link; editing either side never synchronizes the other. Creator/admin cancellation is reversible and keeps the source and votes. Deleting an activity frees its idea for scheduling; deleting an idea keeps the activity and clears only its source. Home links Afiladero and Calendar; Games and Season Recap remain announcements. RSVP, chat, notifications, logistics, games and member administration remain outside this deliverable.
