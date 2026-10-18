/**
 * Finding an address, in whichever process is asked.
 *
 * **This package exists because the question has two askers.** The browser
 * holds the bundled index and matches against it; the API holds the same
 * addresses in Postgres and matches against those. Two implementations of one
 * ranking would disagree at the edges, and the edges are where this module
 * earns its keep -- `resolve` tells *we have no record of that address* apart
 * from *that address is real and outside the pilot area*, which AC 1.1.8
 * requires, and a fallback that drew that line differently from the API would
 * tell one resident two stories about one house.
 *
 * Nothing here takes a network or touches a document. It is given an index and
 * a string, and returns what it found.
 */
export * from './search.js';
