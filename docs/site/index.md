---
layout: page
title: Agent Harness SDK
# Root path redirects to the Getting Started page. Meta-refresh handles static
# hosting / no-JS; the script handles SPA navigation without a full reload.
head:
  - - meta
    - http-equiv: refresh
      content: "0; url=./getting-started"
---

<script setup>
import { onMounted } from "vue";
import { withBase, useRouter } from "vitepress";

onMounted(() => {
  useRouter().go(withBase("/getting-started"));
});
</script>

Redirecting to [Getting Started](./getting-started)…
