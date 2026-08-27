# Revenue Integrity certification fixtures

These fixtures contain synthetic data only and are safe for local and automated testing. They are the first entries in the production certification library.

- `professional-claim-ready.json` must pass Codical structural validation and can be mapped to the clearinghouse test payer after account setup.
- `professional-claim-hold.json` must remain inside Codical and create work items for its invalid diagnosis pointer and charge-total mismatch.
- `stedi-277ca-rejected.json` is a synthetic rejected acknowledgement used to verify claim and line correlation plus rejection work-item creation.
- `stedi-835-partial.json` is a synthetic partial remittance used to verify claim payment, line payment, allowed amount and adjustment normalization.

Real payer certification cases must be stored separately, stripped of PHI when possible, and linked to the applicable payer, provider enrollment, transaction guide, expected `277CA`, and expected `835` result.
