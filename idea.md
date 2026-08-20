# Dekka — Product Plan (idea.md)

## 1. What Dekka Is

Dekka (دكة) is a coffee shop that also runs live events — band nights, open mics, small
concerts — inside the cafe. Right now, event discovery happens over Instagram/Facebook/TikTok,
band bookings come through a Google Form, and the door list is probably a notebook.

This product turns that into one bilingual (Arabic/English) website + mobile app where:
- Guests discover and reserve a spot at upcoming events.
- Bands apply to perform, in-app.
- Staff run the door on event night (name, phone, payment method) from a real table, not paper.
- The admin gets one dashboard for events, reservations, band applications, and monthly income.

**Payment model (confirmed):** No online payment processing in v1. A reservation just holds a
spot — the guest pays **cash or InstaPay at the cafe**, on the day.

---

## 2. Brand Identity

**Name:** Dekka (دكة) — "Dekka" is also the word for a bench/seating platform, which fits a
cafe that's also a gathering spot for live music.

**Logo & visual mood (from the assets you shared):**
- Wordmark is the Arabic دكة rendered in a bold, angular calligraphic style, textured with a
  mirrored geometric diamond/chevron pattern (a Levantine/Palestinian tatreez-style motif) —
  this is the strongest, most distinctive brand asset. It should show up as a recurring texture
  across the app (section dividers, loading states, ticket/confirmation cards), not just the logo.
- Small Latin "Dekka" wordmark sits underneath as the secondary lockup — good for the English
  side of the bilingual toggle.
- Color palette: deep coffee brown (near-black) as the primary/ink color, warm tan/gold as the
  accent, cream/off-white as the background. This already reads as "warm, traditional coffeehouse"
  — the app should lean into that rather than a generic tech-startup look.
- Banner styling: cream background, coffee photography (beans, pour-over, iced coffee) framed
  around the centered logo, thin coffee-bean line-art in the corners. This "framed collage" feel
  is a nice pattern to reuse for the events hub header and social/about page.

**Tone:** Warm, communal, a little artsy/indie (it's a live-music cafe, not a chain). Copy should
sound like an invitation ("Join us Thursday night") more than a corporate event listing.

**Bilingual identity:** Arabic is the primary/default language (RTL), English is a toggle — not
an afterthought translation. Both the دكة wordmark and "Dekka" Latin wordmark already support this
dual identity, so the brand doesn't need to compromise in either language.

**Social presence (to surface in-app, not replace):**
- Instagram, Facebook, TikTok — link out from a "Follow us" section (footer + about/contact page).
- Google Maps — embed/link for directions, especially on the event detail page ("how to get there").

---

## 3. Who Uses This

| Role | Who they are | What they need |
|---|---|---|
| **Guest** | Anyone browsing, not logged in | See events, see cafe info, decide whether to sign up |
| **Member** | Logged-in customer | Reserve a spot at events, see their reservation history, apply to perform |
| **Band / Artist** | Someone who wants to play a show | Submit a show pitch, without needing to know anything technical |
| **Staff** | Cafe front-of-house on event night | Fast door check-in: log name + phone + payment, per event |
| **Admin (owner/manager)** | Runs Dekka | Create/manage events, review band applications, see who's coming, close out the month's earnings |

---

## 4. Core User Stories

**Authentication**
- As a first-time visitor, I land on an auth screen and can **log in**, **sign up**, or
  **continue as guest** — I'm not blocked from browsing just because I don't have an account.
- As a visitor, I can sign up/log in fast using **Google or Facebook**, not just email.
- As a guest browsing events, once I try to **reserve a spot**, I'm asked to sign up or log in
  (since we need a name + phone tied to a real account for the door list).

**Discovering & reserving events**
- As a visitor, I see a clean list/feed of **all upcoming events** — soonest first.
- As a visitor, I tap an event and see everything I need to decide: **date (day/month/year),
  time, location, event name, description, price, how to pay (cash or InstaPay — with the
  InstaPay number if applicable), and the terms & conditions.**
- As a member, I can **reserve my spot** with one tap, and see a confirmation ("You're on the
  list for [Event] — pay at the door").
- As a member, I can see my own **upcoming reservations** in one place (e.g. "My Events").

**Bands / artists**
- As a musician, instead of filling out a disconnected Google Form, I use a **"Submit Your Show"**
  form inside the app — band/artist name, genre, links (SoundCloud/Instagram/YouTube), preferred
  dates, short pitch.
- As a musician, I get some kind of acknowledgment that my submission was received (and ideally,
  later, a status: pending / approved / declined).

**Staff (door / event night)**
- As staff, on the night of an event, I open that event's **check-in table** and add each
  attendee's **name and phone number** as they arrive, and mark **how they paid** (cash / InstaPay)
  and how much.
- As staff, I don't need admin powers — just fast entry for this one event, nothing else.

**Admin**
- As the admin, I can **create, edit, publish, and close** events — setting all the details from
  the event detail page (date/time, location, name, description, price, payment terms, T&Cs).
- As the admin, I can see **how many people have reserved** a spot for any upcoming event.
- As the admin, I can see the **door table** for any past event (who came, phone numbers, how
  they paid).
- As the admin, at the **end of the month**, I can see a rolled-up view of **total earnings
  across all events that month** — not just per event.
- As the admin, I can review **band submissions** and see them in one inbox instead of a Google
  Form spreadsheet.

---

## 5. Feature List (maps to your original 4 + what we added)

1. **Auth & Onboarding** — Login / Sign up / Continue as guest, + Google & Facebook sign-in.
2. **Public Events Hub** — browsable list of upcoming events + full event detail page.
3. **Reservations** — members reserve a spot (no online payment; pay at cafe); "My Events" view.
4. **Submit Your Show** *(new, replaces the Google Form)* — in-app band/artist application form.
5. **Admin Dashboard** — event management, reservation counts, band submissions inbox.
6. **Door / Check-in Table** — staff-facing tool per event: name, phone, payment method, amount.
7. **Monthly Earnings Report** — auto-rolled-up totals from all door tables in a given month.
8. **Bilingual toggle** — Arabic (default, RTL) / English.
9. **Social & Location links** — Instagram, Facebook, TikTok, Google Maps, surfaced in-app.

---

## 6. Screens (plain list, no tech detail)

- **Auth** — Login / Sign Up / Continue as Guest (+ social buttons)
- **Events Hub (Home)** — upcoming events feed
- **Event Detail** — day, time, month, year, location, name, description, price, payment terms,
  T&Cs, "Reserve my spot" button
- **My Events** — a member's reserved events (upcoming + past)
- **Submit Your Show** — band/artist application form + confirmation state
- **About / Contact** — cafe story, social links, map
- **[Staff] Door Check-In** — per-event attendee entry (name, phone, payment method/amount)
- **[Admin] Events Manager** — list of all events (draft/published/past), create/edit event
- **[Admin] Event Detail (manage)** — reservation count, attendee list, edit event info
- **[Admin] Band Submissions** — inbox of show applications
- **[Admin] Monthly Report** — earnings rolled up across events for a selected month

---

## 7. Event Lifecycle (how an event moves through the system)

**Draft** → **Published** (visible publicly, open for reservations) → **Reservations Closed /
Full** (still visible, can't reserve) → **Happened** (staff run door check-in) → **Archived**
(shows in past events + feeds the monthly report)

---

## 8. What's Deliberately Out of Scope for v1

To keep this shippable, these are **not** included yet — flag if any of these are actually must-haves:
- Online payment processing (confirmed: cash/InstaPay at the cafe only, for now)
- Loyalty points / punch cards
- Table reservations for normal (non-event) cafe visits
- Push notifications / reminders before an event
- Waitlists once an event is full
- QR-code check-in (staff type name/phone manually for v1)

---

## 9. Open Questions — flagging for your input before we lock this

1. **Capacity:** Should each event have a max number of spots (so it can go "Full"), or is it
   always open and the door just gets busier?
2. **Guest reservation limit:** When a guest tries to reserve and gets asked to sign up — should
   guest browsing still show a "reserve" button, or is it hidden until they're logged in?
3. **Band submission access:** Does submitting a show require being logged in, or can a
   completely new visitor submit without an account?
4. **Staff accounts:** Do staff get their own login (separate from admin), or does the admin log
   staff in on a shared cafe device each event night?
5. **Confirmation proof:** When someone reserves, do they need to show anything at the door (a
   confirmation screen, a code), or is staff just checking the door list against the name they give?

---

## 10. What "Done" Feels Like

A visitor can find out about Thursday's show, reserve a spot in under a minute, and show up
knowing exactly what to pay and how. A band can pitch a show without emailing anyone. Staff can
run the door without a notebook. And at the end of the month, the admin opens one screen and
knows exactly what Dekka made — across every event, without adding it up by hand.
