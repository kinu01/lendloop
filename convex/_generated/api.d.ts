/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as automation from "../automation.js";
import type * as http from "../http.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_names from "../lib/names.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_schemas from "../lib/schemas.js";
import type * as lib_validators from "../lib/validators.js";
import type * as loans from "../loans.js";
import type * as model_automation from "../model/automation.js";
import type * as model_loans from "../model/loans.js";
import type * as model_notifications from "../model/notifications.js";
import type * as model_reminders from "../model/reminders.js";
import type * as model_tools from "../model/tools.js";
import type * as model_users from "../model/users.js";
import type * as notify from "../notify.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  automation: typeof automation;
  http: typeof http;
  "lib/dates": typeof lib_dates;
  "lib/errors": typeof lib_errors;
  "lib/functions": typeof lib_functions;
  "lib/hmac": typeof lib_hmac;
  "lib/log": typeof lib_log;
  "lib/names": typeof lib_names;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/schemas": typeof lib_schemas;
  "lib/validators": typeof lib_validators;
  loans: typeof loans;
  "model/automation": typeof model_automation;
  "model/loans": typeof model_loans;
  "model/notifications": typeof model_notifications;
  "model/reminders": typeof model_reminders;
  "model/tools": typeof model_tools;
  "model/users": typeof model_users;
  notify: typeof notify;
  reminders: typeof reminders;
  seed: typeof seed;
  tools: typeof tools;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
