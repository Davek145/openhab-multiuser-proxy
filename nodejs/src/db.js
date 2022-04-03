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
export const sitemapListDb = db.addCollection('sitemapsList', {
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
