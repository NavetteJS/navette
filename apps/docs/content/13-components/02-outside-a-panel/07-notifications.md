---
title: Rendering notifications outside a panel
---

## Introduction

[Notifications](/notifications/overview) sent by a component outside a panel are shown by the notifications container. `livewire.page()` includes it. In a page of your own, render it once, in your layout:

```ts
app.get('/shop', async (req, res) => {
    res.send(`<!DOCTYPE html>
<html class="fi">
<head>${livewire.styles(req, res)}</head>
<body class="fi-body">
    ${await livewire.mount('list-products', {}, req, res)}
    ${await livewire.notifications(req, res)}
    ${livewire.scripts(req, res)}
</body>
</html>`);
});
```

Now, when a component sends a notification during a request, it appears in the browser:

```ts
Notification.make().success().title('Saved').send();
```

A notification sent while a component is mounted, such as one sent in `mount()`, is shown when the page loads.
