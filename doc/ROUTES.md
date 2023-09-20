# HTTP Routes

Routes to the openHAB Server provided by the multiuser filter proxy.

Always limit request methods to what is required.

## MainUI

Dynamic routes for openHAB 3 and 4 MainUI.

path | method | response type / request type | resource / description | required filtering | Approach
-|-|-|-|-|-
/rest/items | GET | application/json | Get all available items. | Remove Item objects not allowed from the returned array. | Use NodeJS application to request all Items from openHAB and remove unallowed from response.
/rest/items/{itemname} | GET | application/json | Get item by name. | Reject request for Item not allowed. | Use NodeJS application for response handling.
/rest/items/{itemname}/state | GET | text/plain | Get item state. | Reject request for Item not allowed. | Use NodeJS application for response handling.
/rest/items/{itemname}/semantic/{semanticClass} | GET | application/json | Gets the item which defines the requested semantics of an Item. | Reject request for Item not allowed. | Use NodeJS application for response handling.
/rest/items/{itemname} | POST | text/plain | Sends a command to an Item. | Reject request for Item not allowed. | Use NodeJS application for response handling.
/rest/ui/components/ui:page | GET | application/json | Get all MainUI page components | Remove Pages not allowed from the returned array. | Use NodeJS application to request all Pages from openHAB and remove unallowed from response. Filter unallowed location items from content of ``home`` page in the response.
/rest/ui/components/ui:page/{componentUID} | GET | application/json | Get page by uid. | Reject request for Page not allowed. | Use NodeJS application for response handling. Filter unallowed location items from content of ``home`` page in the response.
/rest/ui/components/{namespace} | GET | application/json | Get other MainUI components | No filtering. | Proxy request to openHAB application.
/rest/ui/components/{namespace}/{componentUID} | GET | application/json | Get other MainUI component by uid | No filtering. | Proxy request to openHAB application.
/page/{componentUID} | GET | application/json | Get page by uid. | Reject request for Page not allowed. | Use NodeJS application for NGINX ``auth_request``.
/rest/persistence/items/{itemname} | GET | application/json | Gets Item persistence data from the persistence service. | Reject request for Item not allowed. | Use NodeJS application for NGINX ``auth_request``.
/rest/events/states | GET | application/json | Initiates a new Item state tracker connection. | No filtering. | Proxy request to openHAB application.
/rest/events/states/{connectionId} | POST | text/plain | Changes the list of Items a SSE connection will receive state updates to. | Remove Item objects not allowed from the request body. | Use NodeJS application to remove unallowed from the request and send it to openHAB.
/analyzer | GET | application/json | Analyze Item(s) using built-in OH analyzer. | No filtering. | Proxy request to openHAB application. Items for the analyzer are filtered by /rest/items.
/auth | GET | application/json | openHAB application log-in screen for admistrator access. | Access denied. | Request rejected by the proxy.

## Static content

Static content provided by openHAB.

path | method | resource / description
-|-|-
/ | GET | Server healthcheck & MainUI
/icon | GET | Icons
/images | GET | Images
/css | GET | Styles
/js | GET | JavaScript
/res | GET | Icons & images for MainUI
/fonts | GET | Fonts
/static | GET | Static content from the $openhab_conf/html folder
/about | GET | Help and information page
/rest/? | GET | openHAB Server & API information
/service-worker.js | GET | MainUI app service worker
/manifest.json | GET | UI configuration & resource list
/precache-manifest* | GET | UI configuration & resource list
/index.html | GET | openHAB Index page

## openHAB App

**NOT ACTIVELY MAINTAINED:** This is legacy Basic UI Sitemaps functionality and it is not actively maintained in version 2 of openHAB MultiUser Proxy.
Functionality is provided and shall be working, however by default these routes are turned off in [nginx](../nginx/README.md) and [NodeJS](../README.md).

Additional dynamic routes for the openHAB mobile app.

path | method | response type / request type | resource / description | required filtering | Approach
-|-|-|-|-|-
/rest/sitemaps | GET | application/json | Get all available sitemaps. | Remove not allowed Sitemap objects from the returned array. | Use NodeJS application to request all Sitemaps from openHAB and remove unallowed from response.
/rest/sitemaps/{sitemapname} | GET | application/json | Get sitemap by name. | Reject request for Sitemap not allowed. | Use NodeJS application for response handling. Filter widgets with unallowed items from content of Sitemap in the response.
/rest/sitemaps/{sitemapname}/{pageid} | GET | application/json | Polls the data for a sitemap. | Reject request for Sitemap not allowed. | Use NodeJS application for response handling. Filter widgets with unallowed items from content of Sitemap in the response.
/rest/sitemaps/events/{subscriptionid} | GET | text/plain | Get Sitemap events. | No filtering. | Proxy request to openHAB application. **POTENTIAL DATA LEAK:** Events are sent to all Sitemap items regardless of access filter for MainUI.
/rest/sitemaps/events/subscribe | POST | text/plain | Creates a Sitemap event subscrition. | No filtering. | Proxy request to openHAB application.
/chart | GET | object | Get Basic UI Chart for defined Items | Remove not allowed Items from the request | Use NodeJS application to remove unallowed Items from request and obtain the chart from openHAB.
/basicui/app?sitemap={sitemapname} | GET | application/json | Get sitemap by name using BasicUI. | Reject request for Sitemap not allowed. | Use NodeJS application for response handling. **POTENTIAL DATA LEAK:** Sitemaps in BASIC UI displays items and their state regardless of items access filter for MainUI.
/basicui/ | GET | application/json | Get other BasicUI components | No filtering. | Proxy request to openHAB application.
