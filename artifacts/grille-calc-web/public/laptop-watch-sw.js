// Deliberately no fetch handler or cache: private API data always goes to the server.
self.addEventListener("push", (event) => {
  let data = {
    title: "Laptop Watch",
    body: "Open Laptop Watch to see your alert.",
    url: "/laptop-watch",
  };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/5g-ivg-logo.png",
      data: { url: data.url },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url ?? "/laptop-watch",
    self.location.origin,
  );
  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/laptop-watch")
  )
    return;
  event.waitUntil(clients.openWindow(url.href));
});
