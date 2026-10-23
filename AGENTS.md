<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Key capacity is enforced by database triggers under a key-row lock; allocation capacity preserves the unique single-use index outside the explicitly identified multi-asset product, so concurrent clients cannot exceed capacity.
- Share product identification and active-key usage counting through `src/lib/chave-capacidade.ts` so allocation choices and the key inventory use the same narrow exception.
- Load each allocation's key through its explicit foreign-key relationship in the allocation query so the main list and filters do not depend on a separate capped key lookup.
- Keep asset purchase-value parsing shared between forms and imports; reuse the purchase-value dialog for single and selected-asset updates to preserve consistent validation and cache refresh.
- Reuse the buyer dialog for inline and selected-asset updates, applying changes only to explicit asset IDs and invalidating asset/detail/dashboard caches to keep buyer totals consistent.
- Never share a React Query key between queries with different filters/selects (e.g. Nova alocação lists all keys, lote lists only free ones); a shared key lets one overwrite the other's cache.
