import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  laptopApi,
  enableLaptopPush,
  disableLaptopPush,
} from "@/lib/laptop-watch";
type Observation = {
  id: number;
  price_cents: number | null;
  stock: string;
  seller: string;
  condition: string;
  checked_at: string;
};
type Preferences = {
  target_cents: number | null;
  drop_percent: number;
  target_alert: boolean;
  drop_alert: boolean;
  low_alert: boolean;
  restock_alert: boolean;
  push_enabled: boolean;
};
type Listing = {
  id: string;
  name: string;
  sku: string;
  specs: string;
  retailer: string;
  url: string;
  note: string;
  latest: Observation | null;
  last_check: { status: string; message: string; checked_at: string } | null;
  follow: Preferences | null;
  observed_low: number | null;
  failure_streak: number;
  manual_observations: {
    id: number;
    price_cents: number;
    stock: string;
    seller: string;
    condition: string;
    observed_at: string;
    recorded_at: string;
  }[];
};
type Snapshot = {
  listings: Listing[];
  runs: {
    id: number;
    status: string;
    started_at: string;
    finished_at: string | null;
    failures: number;
  }[];
  deliveries: {
    id: number;
    status: string;
    attempts: number;
    message: string;
  }[];
};
const money = (c: number | null | undefined) =>
  c == null
    ? "Not verified"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(c / 100);
const when = (s: string | undefined | null) =>
  s ? new Date(s).toLocaleString() : "Never";
const defaults: Preferences = {
  target_cents: null,
  drop_percent: 3,
  target_alert: true,
  drop_alert: true,
  low_alert: true,
  restock_alert: true,
  push_enabled: true,
};
function FollowForm({
  item,
  run,
}: {
  item: Listing;
  run: (action: () => Promise<unknown>) => void;
}) {
  const p = item.follow ?? defaults;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    run(() =>
      laptopApi(`/follows/${item.id}`, "PUT", {
        target_cents: data.get("target")
          ? Math.round(Number(data.get("target")) * 100)
          : null,
        drop_percent: Number(data.get("drop_percent")),
        ...Object.fromEntries(
          [
            "target_alert",
            "drop_alert",
            "low_alert",
            "restock_alert",
            "push_enabled",
          ].map((key) => [key, data.has(key)]),
        ),
      }),
    );
  }
  return (
    <form onSubmit={save} className="border-t pt-4 mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label>
          Target (USD)
          <Input
            name="target"
            type="number"
            min="100"
            max="20000"
            step="0.01"
            placeholder="No target"
            defaultValue={p.target_cents === null ? "" : p.target_cents / 100}
          />
        </label>
        <label>
          Drop threshold (%)
          <Input
            name="drop_percent"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={p.drop_percent}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {(
          [
            ["target_alert", "Target reached"],
            ["drop_alert", "Price drop"],
            ["low_alert", "New tracked low"],
            ["restock_alert", "Back in stock"],
            ["push_enabled", "Phone push"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 min-h-10">
            <input type="checkbox" name={key} defaultChecked={p[key]} />
            {label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button>{item.follow ? "Save preferences" : "Follow laptop"}</Button>
        {item.follow && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              run(() => laptopApi(`/follows/${item.id}`, "DELETE"))
            }
          >
            Unfollow
          </Button>
        )}
      </div>
    </form>
  );
}
function PriceHistory({ id }: { id: string }) {
  const [rows, setRows] = useState<Observation[]>([]),
    [error, setError] = useState(""),
    [more, setMore] = useState(true);
  async function load(offset = 0) {
    try {
      const page = await laptopApi(`/listings/${id}/history?offset=${offset}`);
      setRows((old) => (offset ? [...old, ...page] : page));
      setMore(page.length === 100);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Price history</h2>
      <p className="text-sm text-muted-foreground">
        Verified observations only. Seller and condition are shown separately.
      </p>
      {error && <p role="alert">{error}</p>}
      {!rows.length && !error && <p>No verified history yet.</p>}
      <ol className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="py-3 text-sm">
            <div className="flex justify-between gap-2">
              <strong>{money(row.price_cents)}</strong>
              <span>{when(row.checked_at)}</span>
            </div>
            <p>
              {row.seller} · {row.condition} · {row.stock.replaceAll("_", " ")}
            </p>
          </li>
        ))}
      </ol>
      {more && (
        <Button variant="outline" onClick={() => void load(rows.length)}>
          Load older observations
        </Button>
      )}
    </section>
  );
}
function ManualObservationForm({
  item,
  run,
  onMessage,
}: {
  item: Listing;
  run: (action: () => Promise<unknown>) => void;
  onMessage: (message: string) => void;
}) {
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const seenAt = new Date(String(data.get("observed_at")));
    run(async () => {
      const result = await laptopApi(
        `/listings/${item.id}/manual-observations`,
        "POST",
        {
          price_cents: Math.round(Number(data.get("price")) * 100),
          stock: data.get("stock"),
          seller: data.get("seller"),
          condition: data.get("condition"),
          observed_at: seenAt.toISOString(),
        },
      );
      onMessage(result.message);
      form.reset();
    });
  }
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return (
    <section className="mt-4 border-t pt-4 space-y-3">
      <h3 className="font-semibold">Record what you see</h3>
      <p className="text-xs text-muted-foreground">
        Only you can see this report. It stays separate from verified history
        and never triggers a deal alert.
      </p>
      <form onSubmit={save} className="grid grid-cols-2 gap-3">
        <label>
          Price (USD)
          <Input
            name="price"
            type="number"
            min="100"
            max="20000"
            step="0.01"
            required
          />
        </label>
        <label>
          Seller
          <Input
            name="seller"
            maxLength={160}
            required
            placeholder="Retailer or marketplace seller"
          />
        </label>
        <label>
          Stock
          <select name="stock" className="block w-full rounded-md border p-2">
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Condition
          <select
            name="condition"
            className="block w-full rounded-md border p-2"
          >
            <option value="new">New</option>
            <option value="non_new">Open-box / used / refurbished</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="col-span-2">
          Time you checked
          <Input
            name="observed_at"
            type="datetime-local"
            defaultValue={localNow}
            required
          />
        </label>
        <Button className="col-span-2">Save user-reported price</Button>
      </form>
      {!!item.manual_observations.length && (
        <ul className="divide-y">
          {item.manual_observations.map((row) => (
            <li key={row.id} className="py-2 text-sm">
              <strong>{money(row.price_cents)}</strong> · User-reported ·{" "}
              {row.seller} · {row.condition} · {row.stock.replaceAll("_", " ")}{" "}
              · Seen {when(row.observed_at)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function Invitations({
  run,
}: {
  run: (action: () => Promise<unknown>) => void;
}) {
  const [invites, setInvites] = useState<
      {
        id: number;
        expires_at: string;
        used_at: string | null;
        revoked_at: string | null;
      }[]
    >([]),
    [link, setLink] = useState("");
  async function refresh() {
    setInvites(await laptopApi("/invites"));
  }
  useEffect(() => {
    run(refresh);
  }, []);
  return (
    <section className="border rounded-lg p-4 space-y-3">
      <h2 className="text-lg font-semibold">Invite a friend</h2>
      <p className="text-sm">
        Single use, valid for 48 hours. Copy and share the link yourself.
      </p>
      <Button
        onClick={() =>
          run(async () => {
            const invite = await laptopApi("/invites", "POST");
            setLink(location.origin + invite.path);
            await refresh();
          })
        }
      >
        Create invite link
      </Button>
      {link && (
        <label className="block text-sm">
          Copy this link (shown once)
          <Input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <ul className="space-y-2">
        {invites.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 text-sm">
            <span>
              Invite #{i.id} ·{" "}
              {i.used_at
                ? "Used"
                : i.revoked_at
                  ? "Revoked"
                  : `Expires ${when(i.expires_at)}`}
            </span>
            {!i.used_at &&
              !i.revoked_at &&
              new Date(i.expires_at) > new Date() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(async () => {
                      await laptopApi(`/invites/${i.id}`, "DELETE");
                      await refresh();
                    })
                  }
                >
                  Revoke
                </Button>
              )}
          </li>
        ))}
      </ul>
    </section>
  );
}
export default function LaptopWatchPage() {
  const { user, loading, logout } = useAuth(),
    { id } = useParams(),
    location = useLocation();
  const [data, setData] = useState<Snapshot | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<
    { id: number; message: string; isRead: boolean; projectId: string | null }[]
  >([]);
  async function refresh() {
    setData(await laptopApi());
    const response = await fetch("/api/notifications", {
      credentials: "include",
    });
    if (!response.ok) throw new Error("Inbox could not be loaded.");
    const inbox = await response.json();
    setNotes(
      inbox.notifications.filter(
        (n: { type: string }) => n.type === "laptop_watch",
      ),
    );
  }
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (user && ["admin", "laptop_watch"].includes(user.role))
      void run(async () => {});
  }, [user]);
  if (loading)
    return (
      <p className="p-6" role="status">
        Loading account…
      </p>
    );
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (!["admin", "laptop_watch"].includes(user.role))
    return <Navigate to="/" replace />;
  const items = id ? data?.listings.filter((x) => x.id === id) : data?.listings;
  const latestRun = data?.runs[0],
    staleRun =
      !latestRun?.finished_at ||
      Date.now() - Date.parse(latestRun.finished_at) > 2 * 3600000;
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 pb-12">
      <header className="flex justify-between items-start gap-3">
        <div>
          <Link to="/laptop-watch">
            <h1 className="text-2xl font-bold text-primary">Laptop Watch</h1>
          </Link>
          <p className="text-sm text-muted-foreground">
            Exact offers. Your targets. USD before tax and shipping.
          </p>
        </div>
        <Button variant="outline" onClick={() => void logout()}>
          Log out
        </Button>
      </header>
      {user.role === "admin" && (
        <Link className="underline text-sm" to="/admin">
          Business dashboard
        </Link>
      )}
      <fieldset disabled={busy} className="space-y-6 min-w-0">
        <section className="bg-muted rounded-lg p-4 space-y-2">
          <div className="flex justify-between gap-2">
            <h2 className="font-semibold">Monitoring</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void run(async () => {})}
            >
              Refresh
            </Button>
          </div>
          <p className={staleRun ? "text-amber-800" : "text-muted-foreground"}>
            {staleRun ? "Monitoring overdue or not yet started. " : ""}Last
            completed check:{" "}
            {when(data?.runs.find((x) => x.finished_at)?.finished_at)}
          </p>
          {latestRun && (
            <p className="text-sm">
              Latest run: {latestRun.status.replaceAll("_", " ")} ·{" "}
              {latestRun.failures} failed listings
            </p>
          )}
          <p className="text-xs">
            Hourly cloud checks. A failed check keeps the last verified offer.
          </p>
        </section>
        <section className="border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Phone notifications</h2>
          <p className="text-sm">
            {iphone
              ? "iPhone/iPad: use iOS 16.4 or later. In Safari choose Share → Add to Home Screen, open the installed app, log in and enable notifications."
              : "Android: open in Chrome, install or add to Home Screen, then enable notifications. Allow notifications in Android settings too."}
          </p>
          <p className="text-xs text-muted-foreground">
            Each person must grant permission on each phone. Notifications can
            arrive while the dashboard is closed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run(enableLaptopPush)}>
              Enable notifications
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void run(async () => {
                  const result = await laptopApi("/test-push", "POST");
                  setMessage(result.message);
                })
              }
            >
              Send test notification
            </Button>
            <Button variant="ghost" onClick={() => void run(disableLaptopPush)}>
              Disable on this phone
            </Button>
          </div>
        </section>
        {message && (
          <p role="status" className="border rounded p-3">
            {message}
          </p>
        )}
        {busy && <p role="status">Working…</p>}
        {!data && !busy && (
          <p>Unable to load Laptop Watch. Use Refresh to retry.</p>
        )}
        {id && data && !items?.length && <p>Listing not found.</p>}
        <div className="space-y-4">
          {items?.map((item) => (
            <article key={item.id} className="border rounded-lg p-4 sm:p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    {item.retailer}
                    {item.follow ? " · Following" : ""}
                  </p>
                  <h2 className="text-lg font-semibold">
                    <Link
                      to={`/laptop-watch/${item.id}`}
                      className="hover:underline"
                    >
                      {item.name}
                    </Link>
                  </h2>
                  <p className="font-mono text-sm">{item.sku}</p>
                </div>
                <strong className="text-lg whitespace-nowrap">
                  {money(item.latest?.price_cents)}
                </strong>
              </div>
              <p className="mt-2">{item.specs}</p>
              <p className="text-sm text-muted-foreground">{item.note}</p>
              <p className="mt-3 text-sm">
                Seller: {item.latest?.seller ?? "Not verified"} · Condition:{" "}
                {item.latest?.condition ?? "Not verified"}
              </p>
              <p className="text-sm">
                Stock: {item.latest?.stock.replaceAll("_", " ") ?? "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                Verified: {when(item.latest?.checked_at)} · Last attempted:{" "}
                {when(item.last_check?.checked_at)}
              </p>
              {(!item.latest ||
                Date.now() - Date.parse(item.latest.checked_at) >
                  2 * 3600000) && (
                <p className="text-sm text-amber-800 mt-2">
                  Stale or unverified offer — check the retailer before buying.
                </p>
              )}
              {item.last_check?.status === "error" && (
                <div className="text-sm text-red-700 mt-2 space-y-2">
                  <p>
                    Check failed: {item.last_check.message}{" "}
                    {item.failure_streak > 1 &&
                      `(${item.failure_streak} consecutive failures; last verified offer kept)`}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        const result = await laptopApi(
                          `/listings/${item.id}/check`,
                          "POST",
                        );
                        setMessage(result.message);
                      })
                    }
                  >
                    Retry check
                  </Button>
                </div>
              )}
              <p className="text-sm mt-2">
                Lowest in our tracked seller/condition history:{" "}
                {money(item.observed_low)}
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block underline text-primary py-3"
              >
                Open exact retailer offer ↗
              </a>
              <FollowForm
                key={JSON.stringify(item.follow)}
                item={item}
                run={run}
              />
              {item.follow && (
                <ManualObservationForm
                  key={`manual-${item.id}`}
                  item={item}
                  run={run}
                  onMessage={setMessage}
                />
              )}
              {id && (
                <div className="mt-5">
                  <PriceHistory id={id} />
                </div>
              )}
            </article>
          ))}
        </div>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your alert inbox</h2>
          {!notes.length && (
            <p className="text-sm text-muted-foreground">
              No alerts yet. Follow a laptop to start.
            </p>
          )}
          <ul className="divide-y">
            {notes.map((n) => (
              <li key={n.id} className="py-3 space-y-2">
                <p className="text-sm">{n.message}</p>
                <div className="flex gap-3">
                  {n.projectId && (
                    <Link
                      className="text-sm underline"
                      to={`/laptop-watch/${n.projectId}`}
                    >
                      View laptop
                    </Link>
                  )}
                  {!n.isRead && (
                    <button
                      className="text-sm underline"
                      onClick={() =>
                        void run(async () => {
                          const r = await fetch(
                            `/api/notifications/${n.id}/read`,
                            { method: "PATCH", credentials: "include" },
                          );
                          if (!r.ok) throw new Error("Could not mark read.");
                        })
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        {!!data?.deliveries.length && (
          <details>
            <summary className="cursor-pointer py-2">
              Push delivery status
            </summary>
            <p className="text-xs">
              “Accepted” means the push provider accepted it; confirm delivery
              on your phone.
            </p>
            <ul className="divide-y">
              {data.deliveries.map((d) => (
                <li key={d.id} className="text-sm py-2">
                  {d.status} · {d.attempts} attempt(s) · {d.message}
                </li>
              ))}
            </ul>
          </details>
        )}
        {user.role === "admin" && <Invitations run={run} />}
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Best/lowest prices refer only to our tracked offers and saved history,
        never the whole internet.
      </p>
    </main>
  );
}
