import Loki from 'lokijs';

/**
 * LokiJS databases.
 *
 * @namespace lokijs
 */

const db = new Loki('lokijs.db');
/**
 * LokiJS database that holds the Items of a Sitemap.
 *
 * @memberof lokijs
 */
export const itemsOfSitemapDb = db.addCollection('sitemaps', {
  exact: ['name', 'lastupdate', 'items'],
  indices: ['name'],
  autoload: false,
  autosave: false,
  autosaveInterval: 10000
});
/**
 * LokiJS database that holds the list of Sitemaps.
 * Fetched from: /rest/sitemaps
 *
 * @memberof lokijs
 */
export const sitemapsListDb = db.addCollection('sitemapsList', {
  exact: ['name', 'lastupdate', 'json'],
  indices: ['name'],
  autoload: false,
  autosave: false,
  autosaveInterval: 10000
});
/**
 * LokiJS database that holds the list of Pages.
 * Fetched from: /rest/ui/components/ui:page
 *
 * @memberof lokijs
 */
export const pagesListDb = db.addCollection('pagesList', {
  exact: ['name', 'lastupdate', 'json'],
  indices: ['name'],
  autoload: false,
  autosave: false,
  autosaveInterval: 10000
});
/**
 * LokiJS database that holds all Items.
 * Fetched from: /rest/items
 *
 * @memberof lokijs
 */
export const itemsListDb = db.addCollection('itemsList', {
  exact: ['name', 'lastupdate', 'json'],
  indices: ['name'],
  autoload: false,
  autosave: false,
  autosaveInterval: 10000
});
/**
 * LokiJS database that holds the Pages allowed for a user.
 *
 * @memberof lokijs
 */
export const pagesForUserDb = db.addCollection('pagesForUser', {
  exact: ['name', 'lastupdate', 'pages'],
  indices: ['name'],
  autoload: false,
  autosave: false,
  autosaveInterval: 10000
});
/**
 * LokiJS database that holds the Items allowed for a user.
 *
 * @memberof lokijs
 */
export const itemsForUserDb = db.addCollection('itemsForUser', {
  exact: ['name', 'lastupdate', 'items'],
  indices: ['name'],
  autoload: false,
  autosave: false,
  autosaveInterval: 10000
});
