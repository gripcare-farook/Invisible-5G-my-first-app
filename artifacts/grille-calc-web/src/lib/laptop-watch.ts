export async function laptopApi(path = "", method = "GET", body?: unknown) {
  const response = await fetch(`/api/laptop-watch${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? "Request failed. Please try again.");
  return data;
}
export async function enableLaptopPush() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw new Error(
      "Push is unavailable. On iPhone, add this app to your Home Screen and open it there.",
    );
  // Request permission directly from the button gesture, before any network awaits.
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Notification permission was not granted. Check your browser and phone settings.",
    );
  const { publicKey } = await laptopApi("/push-key");
  if (!publicKey) throw new Error("Push is not configured by the owner yet.");
  await navigator.serviceWorker.register("/laptop-watch-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  await laptopApi("/subscriptions", "POST", subscription.toJSON());
}
export async function disableLaptopPush() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await laptopApi("/subscriptions", "DELETE", {
      endpoint: subscription.endpoint,
    });
    await subscription.unsubscribe();
  }
}
export async function testLaptopPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error("Push is unavailable on this device.");
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription || Notification.permission !== "granted")
    throw new Error("Enable notifications on this phone first.");
  return laptopApi("/test-push", "POST", { endpoint: subscription.endpoint });
}
