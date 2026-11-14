import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { laptopApi } from "@/lib/laptop-watch";
export default function LaptopInvitePage() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await laptopApi("/accept-invite", "POST", { ...values, token });
      setDone(true);
      history.replaceState(null, "", "/laptop-watch/invite");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-md mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold text-primary">Join Laptop Watch</h1>
      <p>
        Follow laptops and receive your own price alerts. Your account has
        access to Laptop Watch only.
      </p>
      {done ? (
        <p>
          Account created.{" "}
          <Link className="underline" to="/login">
            Log in to Laptop Watch
          </Link>
        </p>
      ) : (
        <form className="space-y-4" onSubmit={accept}>
          <label className="block">
            Name
            <Input name="name" required maxLength={100} autoComplete="name" />
          </label>
          <label className="block">
            Email
            <Input
              name="email"
              required
              type="email"
              maxLength={200}
              autoComplete="email"
            />
          </label>
          <label className="block">
            Password (at least 12 characters)
            <Input
              name="password"
              required
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
            />
          </label>
          <Button disabled={busy || !token}>
            {busy ? "Creating account…" : "Accept invitation"}
          </Button>
        </form>
      )}
      <p role="status">{message}</p>
    </main>
  );
}
