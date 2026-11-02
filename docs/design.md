# Design system

LendLoop is a tool people use to finish a task, so the design stays quiet and familiar. This page records the rules, so that each new screen follows them instead of inventing its own. The tokens live in `src/app/globals.css`, and the components live in `src/components/ui`.

## Colors

Components use named tokens and never raw colors. Each token has a light and a dark value, and the app follows the visitor's system setting, so there is no theme switch to maintain.

The base is slate with one blue accent. Slate keeps a long list calm, and one accent makes the main action easy to find. Green, amber, blue and red are kept for status, and a status always has a word beside its color.

Token names follow shadcn (`primary`, `muted-foreground`, `destructive`), so its components work without changes. The tokens LendLoop adds are `link`, `scrim`, and the soft and strong status pairs.

Every text and control color pair meets WCAG AA in both themes. Text needs 4.5:1 and controls need 3:1. The closest pair is 15% above its minimum.

## Type

The only typeface is Public Sans. The font file ships with the app, so no page load asks a third party for it.

| Token        | Size | Use                             |
| ------------ | ---- | ------------------------------- |
| `text-3xl`   | 32px | The home page headline          |
| `text-2xl`   | 28px | Page titles                     |
| `text-xl`    | 20px | Section and dialog titles       |
| `text-lg`    | 18px | The brand name                  |
| `text-title` | 17px | Card and row titles             |
| `text-base`  | 16px | Body text, inputs and buttons   |
| `text-sm`    | 14px | Hints and labels                |
| `text-xs`    | 13px | Badges and table column headers |

The `PageTitle`, `SectionTitle` and `Hint` components in `common/text.tsx` hold these choices, so screens use them and do not repeat the classes.

## Spacing

Spacing outside `ui` uses these Tailwind steps: 1, 2, 3, 4, 6, 8 and 12, which are 4px to 48px. Small steps separate items inside a group, and large steps separate groups. Vertical space around page content is step 4 by default.

## Controls

Buttons, inputs and selects are at least 44px tall, so they are easy to press on a phone. Every control has a visible label. A solid focus ring marks the keyboard position, because a faded ring can fall below 3:1.

Selects and date fields are native. Phones already give people good pickers for these, and native fields need less JavaScript.

## Components

`ui` holds shadcn components only, with no app knowledge. They are our code to change, and we changed them for the 44px height, the solid focus ring and a default of `type="button"`. A lint rule stops `ui` from importing app code.

A new need becomes a variant of an existing component, as the status badges are, and not a one-off style.

| Need                        | Pattern                                                        |
| --------------------------- | -------------------------------------------------------------- |
| Browsing tools              | Cards in a grid                                                |
| The public list             | Rows, because two short values would leave a card mostly empty |
| Loans for one person        | Rows in a list                                                 |
| Admin data                  | Tables, which scroll sideways on a phone                       |
| Parts of one page           | Tabs, with the chosen tab in the URL                           |
| An on or off setting        | A switch, which needs no confirmation                          |
| Entering details            | A dialog with a form                                           |
| Confirming a lasting action | An alert dialog, with focus on the safe choice                 |
| Reporting a finished action | A short message in the live status area                        |

Only the main action on a screen uses the primary button. An action that removes or declines something uses the destructive button.

The main nav holds what a neighbor does. The Admin link sits apart beside the account menu, and every admin action lives on the admin page, so neighbor pages show neighbor actions only.

## Motion

Motion only explains a change, such as a dialog opening. It is short, and it is effectively turned off for people who ask their system to reduce motion.
