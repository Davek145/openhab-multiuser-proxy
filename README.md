# openHAB Multi-User support for the REST API v 2.0.1

**NOTE:** This is fork of the archived [openhab-multiuser-proxy project](https://github.com/florian-h05/openhab-multiuser-proxy) and it is utilizing great work done by [Florian Hotze](https://github.com/florian-h05). Version 2 of openHAB MultiUser Proxy is expanded and adjusted to fully support MainUI of openHAB 3+ including filtering of Items and Pages.

This project aims to provide a secure multiuser support for the [openHAB REST API](https://www.openhab.org/docs/configuration/restdocs.html#openhab-rest-api).
It is utilising a NodeJS application and the popular [NGINX](https://www.nginx.com/) webserver to proxy and filter requests to the REST API.

Opposite to the ``visibleTo`` property available in openHAB, filtering provided by the openHAB MultiUser Proxy is enabling true authorized access to Items/Pages/Sitemaps including access via REST API.

[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg)](https://github.com/standard/semistandard)
[![npm version](https://badge.fury.io/js/openhab-multiuser-proxy.svg)](https://badge.fury.io/js/openhab-multiuser-proxy)

**DISCLAIMER:** I DO NOT GUARANTEE that this project has no vulnerabilities a attacker could use.
As GPL-3.0 says, this project comes without any liability or warranty.

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Introduction](#introduction)
- [ACL tags](#acl-tags)
- [Access to MainUI pages](#access-to-mainui-pages)
- [Access to Items](#access-to-items)
- [Access to Sitemaps](#access-to-sitemaps)
- [Admin user](#admin-user)
- [NodeJS package](#nodejs-package)
  - [Installation](#installation)
  - [Configuration options](#configuration-options)
  - [Documentation](#documentation)
- [NGINX setup](#nginx-setup)
- [Firewall setup](#firewall-setup)

## Introduction

This project allows to set granular access control to Items, Pages and Sitemaps provided by openHAB 3+. It allows to distinguish between individual users and provide them access only to approved Items/Pages/Sitemaps.

Authentication of users is not utilizing internal authentication in openHAB.
It relies on mTLS (client certificate auth) to get user id and org memberships used for the access authorization. For openHAB application all users are utilizing the implicit user role (need to be turned ON in [API security setting](https://www.openhab.org/docs/configuration/restdocs.html) of openHAB). OpenHAB authentication to access openHAB setting is possible only via the dedicated [admin server instance](#admin-user).

Each client has its own username (as *Common Name*) and can be in multiple organizations (as dot seperated list in *Organizational Unit*), for certificate config refer to [mTLS Certificate Authority](nginx/README.md#mtls-certificate-authority).

## ACL Tags

Version 2 of openHAB MultiUser Proxy is utilizing openHAB [tagging]( https://www.openhab.org/docs/configuration/items.html#tags) to set access of a client to Pages and Items. 

ACL Tag added to a Page or Item always consists of ``ACL_PREFIX`` (default ``acl:``) followed user id or org that this ACL Tag grants access to. Example: ``acl:john``, ``acl:guests``.

If no ACL Tag is added to a Page or an Item, than only clients that are members of ADMIN_OU do have access to it.

There are two special orgs defined with pre-defined meaning:
-	``ADMIN_OU`` (default ``admin``) – Org for full admin access. Client that is member of this Org is having unrestricted access to openHAB.
-	``EVERYONE_OU`` (default ``everyone``) – Org that automatically include any authenticated client. If tag with EVERYONE_OU is added to Page or Item, all authenticated clients do have access to it.

ADMIN_OU and EVERYONE_OU is defined in [configuration options](#configuration-options).

Tags can be added to Items by several means, e.g. in Items file, using MainUI, via rules and via Rest API.
Tags to Pages can be currently added only via Rest API.

## Access to MainUI pages

A client can access MainUI page if at least one of the following conditions is fulfilled:
 - Page is having ACL tag that exactly matches client’s user id;
 - Page is having ACL tag that exactly matches one of client’s orgs;
 - Page is having ACL tag with EVERYONE_OU;
 - Client is member of ADMIN_OU org;
 - Page requested is ``home`` or ``overview`` that is necessary for load of MainUI.

Page ``home``, that is displaying generated model tabs with Locations, Equipment and Properties, is filtered so that the client is provided only with authorized Items (including Location Items). It can also filter separators of empty sections in Locations tab.

Access to MainUI pages is filtered both when accessed directly via ``/page/{componentUID}`` as well as when requested via REST API. If the Page is displayed at MainUI Sidebar, it is filtered out of the menu if access to the Page is not authorized.

Items displayed on pages are filtered only in case list of displayed Items is generated via REST API. Hardcoded Items on authorized Page are always displayed, however, their state as well access to command is filtered.

## Access to Items

A client can access Item if at least one of the following conditions is fulfilled:
 - Item is having ACL tag that exactly matches client’s user id;
 - Item is having ACL tag that exactly matches one of client’s orgs;
 - Item is having ACL tag with EVERYONE_OU;
 - Client is member of ADMIN_OU org.

Only the following Item operations are allowed:
 - Get all available Items;
 - Get a single Item;
 - Get the state of an Item;
 - Get the item which defines the requested semantics of an Item;
 - Send a command to an Item;
 - Initiate and change Item state tracker connection.

## Access to Sitemaps

A client can access a Sitemap if at least one of the following conditions is fulfilled:
- Sitemap name exactly matches with the client's user id;
- Sitemap name exactly matches with one of the client's orgs;
- Sitemap name includes one of the client's organizations at the beginning and before the ``ORG_SEPARATOR`` (default ``_org_``).

Example:
A client with username *Florian* & organizations *family*, *administration* has access to:
 - a Sitemap named *Florian*,
 - a Sitemap named *family* or *administration*,
 - every Sitemap whose name starts with *familiy_org_* or *administration_org_*.


## Admin user

The admin user, identified by ``$ADMIN_OU`` in his OU, can access all Items/Pages/Sitemaps.

Furthermore, administrators have unfiltered access to the openHAB server at ``https://admin.$servername``.

## NodeJS package

The npm package *openhab-multiuser-proxy* provides filters and access control mechanisms.
**It depends on NGINX (or Apache) as reverse proxy.** 

### Installation
- Install via npm: ``npm install -g openhab-multiuser-proxy``
- Copy the [openhab-multiuser.service](nodejs/openhab-multiuser.service) file to */etc/systemd/system/openhab-multiuser-proxy.service* or paste into ``sudo systemctl edit --force --full openhab-multiuser.service``
- ``sudo systemctl daemon-reload``
- ``sudo systemctl enable --now openhab-multiuser.service``
  - The service by default tries to connect to localhost as openHAB server and exposes itself on port 8090.
  - Logging is performed on level info to ``/var/log/openhab/multiuser-proxy.log``.
- To change the configuration, edit the systemd file with ``sudo systemctl edit --full openhab-multiuser.service``

### Configuration options

Option | Description | Command line argument | Environment variable | Example | Default
-|-|-|-|-|-
`PORT` | Port to server the application. | -p, --port | PORT | --port=8090 | ``8090``
`HOST` | URL for backend openHAB server. | -h, --host | HOST | --host=http://127.0.0.1:8080 | ``http://127.0.0.1:8080``
`PINO_LOG_LEVEL` | Log level, available: fatal, error, warn, info, debug, trace. | none | PINO_LOG_LEVEL | PINO_LOG_LEVEL=info | ``info``
`PINO_LOG_FILE` | Log file path. | none | PINO_LOG_FILE | PINO_LOG_FILE=./pino.log | ``/var/log/openhab/multiuser-proxy.log``
`ADMIN_OU` | Administrator organizational unit. | none | ADMIN_OU | ADMIN_OU=administrator | ``admin``
`EVERYONE_OU` | Everyone organizational unit. | none | EVERYONE_OU | EVERYONE_OU=everyone | `` everyone ``
`CACHE_TIME` | Time (in milliseconds) for caching of Items/Pages/Sitemaps. | none | CACHE_TIME | CACHE_TIME=300000 | ``300000`` = 5 min
`CACHE_TIME_ACL` | Time (in milliseconds) for caching of ACL for Items/Pages/Sitemaps. | none | CACHE_TIME=3600000 | CACHE_TIME | ``3600000`` = 60 min
`ACL_PREFIX` | Prefix of the access control tag for Items/Pages. | none | ACL_PREFIX | ACL_PREFIX=acl: | ``acl:``
`ORG_SEPARATOR` | Separates organization name at beginning of Sitemap name from the rest. | none | ORG_SEPARATOR | ORG_SEPARATOR=_org_ | ``_org_``
`HOME_SEPARATOR` | Remove separators of empty section in filtered home page. | none | HOME_SEPARATOR | HOME_SEPARATOR=true | ``true``

These options can be set in the systemd file, either as param in ``ExecStart`` or as ``Environment`` variable.

### Documentation

JSDoc documentation is available at [https://davek145.github.io/openhab-multiuser-proxy/nodejs/jsdoc/](https://davek145.github.io/openhab-multiuser-proxy/nodejs/jsdoc/).

For HTTP Routes documentation refer to [doc/ROUTES](doc/ROUTES.md).

REST API documentation is local available at the ``/swagger/`` path.

## NGINX setup

Refer to [nginx/README](nginx/README.md).

## Firewall setup

Use ufw to block direct access to openHAB & the NodeJS app:
```shell
sudo ufw deny from any to any port 8080 comment "openHAB HTTP"
sudo ufw deny from any to any port 8443 comment "openHAB HTTPS"
sudo ufw deny from any to any port 8090 comment "openHAB Multi-User"
```


