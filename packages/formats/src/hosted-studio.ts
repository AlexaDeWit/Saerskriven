/**
 * The hosted studio's canonical address: the base the CLI and the MCP server
 * write every share link on, and the site URL a studio build takes when
 * `PAGES_SITE_URL` is unset. The scheme is `https` and nothing else: a link
 * opened over plain HTTP would run unauthenticated script with the whole
 * model in its fragment.
 *
 * This module imports nothing. The studio's Vite configuration loads it in
 * plain Node, where a source module's `./name.js` import finds no file.
 */
export const hostedStudioUrl = 'https://saerskriven.com/';
