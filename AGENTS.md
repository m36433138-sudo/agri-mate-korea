# Architecture rules
- Error-code records retain independent photo paths in a private bucket; batch creation uploads before one atomic insert and cleans up on failure so records can be deleted independently.
- Machine lists fetch stable range-based pages before filtering so records beyond the Data API row cap remain discoverable.
- Global search uses a paginated SECURITY INVOKER RPC with normalized indexed fields and abortable query-keyed requests so RLS remains authoritative and stale responses cannot replace current results.