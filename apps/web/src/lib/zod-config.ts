// SPDX-License-Identifier: AGPL-3.0-or-later
// Import first. The CSP forbids eval, so tell zod not to probe for / use its JIT (`new Function`).
import { z } from "zod";

z.config({ jitless: true });
