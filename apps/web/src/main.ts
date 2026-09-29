// SPDX-License-Identifier: AGPL-3.0-or-later
import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("missing #app");
mount(App, { target });

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    /* offline support is best-effort */
  });
}
