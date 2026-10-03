import { limitedRows, renderCounts, searchLimits } from './search.js';

const listing = Array.from(
  { length: searchLimits.concise + 10 },
  (unused, index) => index,
);

const narrowing = ['`status`', '`query`'];

describe('one page of a listing', () => {
  it('starts at the first match where the call names no offset', () => {
    expect(limitedRows(listing, { response_format: 'concise' })).toEqual({
      rows: listing.slice(0, searchLimits.concise),
      counts: {
        matched: listing.length,
        offset: 0,
        returned: searchLimits.concise,
        truncated: true,
        nextOffset: searchLimits.concise,
      },
    });
  });

  it('carries the rest of the listing from the offset a cut page names', () => {
    const first = limitedRows(listing, { response_format: 'concise' });
    const next = limitedRows(listing, {
      response_format: 'concise',
      offset: first.counts.nextOffset,
    });
    expect([...first.rows, ...next.rows]).toEqual(listing);
    expect(next.counts).toEqual({
      matched: listing.length,
      offset: searchLimits.concise,
      returned: 10,
      truncated: false,
    });
  });

  it('names no next page for a listing that fills one page exactly', () => {
    expect(
      limitedRows(listing.slice(0, searchLimits.concise), {
        response_format: 'concise',
      }).counts,
    ).toEqual({
      matched: searchLimits.concise,
      offset: 0,
      returned: searchLimits.concise,
      truncated: false,
    });
  });

  it('names no next page for a page that ends at the last match', () => {
    const offset = listing.length - searchLimits.detailed;
    expect(
      limitedRows(listing, { response_format: 'detailed', offset }).counts,
    ).toEqual({
      matched: listing.length,
      offset,
      returned: searchLimits.detailed,
      truncated: false,
    });
  });

  it('carries nothing from an offset past the last match', () => {
    expect(
      limitedRows(listing, { response_format: 'detailed', offset: 500 }).counts,
    ).toEqual({
      matched: listing.length,
      offset: 500,
      returned: 0,
      truncated: false,
    });
  });
});

const rendered = (offset: number | undefined, format: 'concise' | 'detailed') =>
  renderCounts(
    limitedRows(listing, { response_format: format, offset }).counts,
    format,
    narrowing,
  );

describe('the counts a text result opens with', () => {
  it('names the count alone for a whole listing', () => {
    expect(
      renderCounts(
        limitedRows(listing.slice(0, 3), { response_format: 'concise' }).counts,
        'concise',
        narrowing,
      ),
    ).toEqual(['matches: 3']);
  });

  it('names the next offset and the narrowing arguments for a cut page', () => {
    expect(rendered(undefined, 'concise')).toEqual([
      'matches: 60, of which this result carries 50 from offset 0',
      'The listing stopped at its limit, so it is not the whole answer. Repeat the call with `offset` 50 for the next page. Narrow it with `status`, `query`.',
    ]);
  });

  it('offers the concise form to a detailed page that was cut', () => {
    expect(rendered(20, 'detailed')).toEqual([
      'matches: 60, of which this result carries 20 from offset 20',
      'The listing stopped at its limit, so it is not the whole answer. Repeat the call with `offset` 40 for the next page. Narrow it with `status`, `query`, or ask for the concise form.',
    ]);
  });

  it('says where the last page starts, and names no next page', () => {
    expect(rendered(50, 'concise')).toEqual([
      'matches: 60, of which this result carries 10 from offset 50',
    ]);
  });
});
