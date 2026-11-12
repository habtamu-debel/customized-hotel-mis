const MAP = 'https://www.google.com/maps/search/?api=1&query=Cameroon+Street+Bole+Addis+Ababa';

export default function Location() {
  return (
    <div className="px-5 py-8 md:px-12 md:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Location</p>
      <h1 className="display mt-2 max-w-3xl text-5xl">Cameroon Street, on the quiet side of Bole.</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <img
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80"
          alt="Hotel arrival"
          className="h-[380px] w-full rounded-[28px] object-cover"
        />
        <div className="rounded-[28px] bg-paper p-6 md:p-8">
          <h2 className="display text-3xl">Arrive without a speech.</h2>
          <dl className="mt-6 space-y-4 text-sm leading-6">
            <div><dt className="text-mist">Address</dt><dd className="font-semibold">Cameroon Street, Bole, Addis Ababa</dd></div>
            <div><dt className="text-mist">Check-in / out</dt><dd className="font-semibold">14:00 arrival · 12:00 departure</dd></div>
            <div><dt className="text-mist">Desk</dt><dd className="font-semibold">+251 11 667 2400<br />stay@fidelpalace.com</dd></div>
            <div><dt className="text-mist">From the airport</dt><dd>About twenty minutes from Bole Airport when the road is kind. Ask for a car when you book and we will have a name-board in arrivals.</dd></div>
          </dl>
          <a href={MAP} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">Open in maps</a>
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['Breakfast', 'From 6:30 in Kaffa. It is included only when your rate says so — most public rates are room only, so the price you see is the price of the room.'],
          ['The spa', 'Book a treatment at the desk. The rooms are not a walk-through; the door stays shut.'],
          ['Late arrival', 'The desk is staffed through the night. If your flight lands after ten, tell us on the request and the room stays held.'],
        ].map(([title, copy]) => (
          <article key={title} className="rounded-3xl border border-line p-5">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-mist">{copy}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
