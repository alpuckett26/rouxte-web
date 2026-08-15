-- Owner-photo handoff — rep-onboarding checklist step (rouxte-web#16, item 2).
--
-- Ratified in the war room: a lead with NO WEBSITE (the Cove case) has no site
-- for the build lane to pull food photos from. The rep standing in the
-- restaurant is the only person in the whole stack who can get them, and the
-- window is the signing visit — nobody makes a second trip for photos. So the
-- duty is codified here, on the rep's readiness checklist, rather than left as
-- tribal knowledge that dies with whoever worked the account.
--
-- Adds the 'handoff' category. NOTE: the readiness UIs (RepOnboardingStatus,
-- RepReadinessPanel) filter by a hard-coded CATEGORY_ORDER — a category that
-- isn't in that list renders nowhere. Both are updated in the same commit.
--
-- Idempotent: readiness_items has no unique constraint on label, so each
-- insert is guarded on (org_id is null, label).

insert into readiness_items (org_id, label, description, category, order_index)
select null, v.label, v.description, 'handoff', v.order_index
from (values
  (
    'Owner-photo handoff briefed',
    'Knows that a no-website account has zero food photos anywhere in the stack, and that the signing visit is the only chance to collect them.',
    40
  ),
  (
    'Photo capture ready in the field',
    'Device has camera access and free storage; knows to shoot PLATED DISHES the restaurant actually sells — not prep pans, not the kitchen, not the signage.',
    41
  ),
  (
    'Knows where the photos go',
    'Photos are handed off against the account record so the build lane can find them. Never left on a personal device or in a text thread.',
    42
  ),
  (
    'Knows photos are audited, not auto-published',
    'Every submitted photo is hash-gated against an audited allowlist before it can front a customer-facing surface. A photo handed off is not a photo shipped — never promise an owner a specific shot will appear.',
    43
  )
) as v(label, description, order_index)
where not exists (
  select 1 from readiness_items ri
  where ri.org_id is null and ri.label = v.label
);
