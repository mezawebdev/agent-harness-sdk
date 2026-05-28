---
layout: page
title: Agent Harness SDK
# Root path redirects to the Introduction page. Meta-refresh handles static
# hosting / no-JS; the script handles SPA navigation without a full reload.
head:
  - - meta
    - http-equiv: refresh
      content: "0; url=./introduction"
---

<script setup>
import { onMounted } from "vue";
import { withBase, useRouter } from "vitepress";

onMounted(() => {
  useRouter().go(withBase("/introduction"));
});
</script>

Redirecting to the [Introduction](./introduction)…
