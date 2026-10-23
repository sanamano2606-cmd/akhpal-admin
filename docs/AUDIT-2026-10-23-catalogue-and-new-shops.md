# Audit, 23 October 2026: the catalogue and new shops

Sana: "New vendors are registering their shops and I am facing difficulties in
managing them. The catalogue system is also not good enough. A lot of categories
are missing. When a store type is chosen and a product is added, there are not
enough shelves to select for many products. The sub-category does not show
because of the department name before it."

## A. Catalogue: what was wrong and what changed in this panel

| # | Problem (seen on "Premium Medical Scrub", Asif Online Medicine) | Cause in the code | Fixed here |
|---|---|---|---|
| A1 | The Sub-category box read "Health & Pharmacy › U…", so the shelf itself was hidden | The closed box showed the whole path, department first, in a box 40% wide | The shelf name now comes first ("Uniforms · Health & Pharmacy › …"). The full path is in the tooltip, and the box is now half the row |
| A2 | "Not enough shelves to select" | The list showed only the **first 60** shelves when nobody typed. With every department in it (about 300 shelves), scrolling showed the shop's own department and stopped | Every shelf is shown. Each other department now has its own heading instead of one long "OTHER DEPARTMENTS" run |
| A3 | Every line repeated the long department name | Labels were "Department › Group › Shelf" | Each line shows the shelf name in bold, with where it sits small underneath. Typing a department name still finds its shelves |
| A4 | "Lots of categories are missing", and adding one meant leaving the product | No way to add a shelf from the product box | The picker offers **+ Add "…" as a new shelf**. You choose where it goes (this shop's department first), it is added, and it is chosen for the product. The server still checks the Categories permission |
| A5 | "Takal suggests" said **Sure** for *Beauty › Bleach & Facials* on a medical scrub | The server's suggester matches words ("scrub"). The panel trusted its "sure" | A suggestion from another department is never shown as Sure. It is labelled "Other department" with a warning to check it |

## B. Catalogue: what needs the backend (not in this repository)

1. **Missing shelves (data).** The shelf tree lives in the server's database.
   Add the shelves vendors actually need, either from Stores › Categories or
   with the new "+ Add as a new shelf". Suggested first additions for Health &
   Pharmacy, the department in the report: *Medical Uniforms & Scrubs,
   Medical Devices (BP, glucometer, thermometer), Surgical & Dressing,
   Orthopaedic Supports, Mobility Aids, Home Nursing Supplies*. Use
   Stores › Shelf check to see which shelves are overloaded (over 100
   products), because those shelves are where new ones are missing.
2. **The suggester** (`/shelf/suggest`). It should weigh the shop's own
   department and whole phrases ("medical scrub" ≠ "face scrub"), and should
   never return `sure: true` for a shelf outside the shop's own department.
3. **Store type → shelves.** If the server is older and ignores
   `all_departments=true`, a shop only ever sees its own department's shelves.
   Check that the live server sends `own_slugs`.

## C. New shops: what was wrong and what changed in this panel

| # | Problem | Fixed here |
|---|---|---|
| C1 | Nothing on the menu said shops were waiting. The only count was a Dashboard tile | A red count of waiting shops on **Stores** in the sidebar, refreshed every minute, for admins who can approve |
| C2 | The Waiting list opened A–Z, so the shop that had waited longest could be anywhere | Waiting now opens with **ready shops first, then the longest waiting**. Choosing a sort still overrides it |
| C3 | No way to see only the shops that are ready | "All waiting / Ready to approve / Still missing something" switch inside Waiting |
| C4 | The only way to tell a vendor what to fix was to **reject** the shop | **"WhatsApp what is left"** on each waiting shop opens WhatsApp with the checklist's missing items already written (it shows only when the shop has a mobile number on the list) |

## D. New shops: still to do

- **Needs backend:** a real "changes requested" status instead of reject, shop
  documents (CNIC, licence; there is a "Shop photo unclear" reject reason but
  no way to see shop documents), and who sent the shop and when on
  `/admin/vendor-intake/waiting`.
- **Frontend, next:** bulk "Approve all ready" (one `approveRestaurant` per
  shop; the server checks each), and Call / WhatsApp buttons in the shop
  page header (the owner's phone is currently only inside the ⋯ menu).
