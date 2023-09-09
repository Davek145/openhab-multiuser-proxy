# openHAB Multi-User support - NGINX part

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Requirements](#requirements)
  - [SSL certificates](#ssl-certificates)
  - [mTLS Certificate Authority](#mtls-certificate-authority)
- [Setup](#setup)

## Requirements

### SSL certificates

In ``/etc/ssl/``:
File | Description | ``chmod`` | ``chown``
-|-|-|-
``openhab_rsa.crt`` | Server certificate | 644 | root:root
``openhab_rsa.pem`` | Private key for server certificate | 600 | root:root 
``openhab_mtls_CA.crt`` | Certificate of your mTLS CA (client certificate auth) | 644 | root:root
``openhab_mtls_CRL.pem`` | Certificate revocation list of your mTLS CA | 644 | root:root

Make sure that NGINX has access to the certificates but keep your private key secret!

### mTLS Certificate Authority

NGINX parses some information of the client certificates to get the user and orgs for a client.

The user id is parsed from the *Common Name* (abbrev. *CN*).

Orgs are parsed from the *Organizational Unit* (abbrev. *OU*).
Orgs have to be point ``.`` seperated.

Spaces and hyphens in those are replaced with underscores before a request to the openHAB server is made.
It is recommended to **NOT USE spaces and hyphens** to avoid problems.

## Setup

Expecting that openHAB is available on http://localhost:8080 and the NodeJS app is available on http://localhost:8090, copy the following files:
- [proxy-headers.conf](proxy-headers.conf) to ``/etc/nginx/``
- [openhab-admin.conf](openhab-admin.conf) ``/etc/nginx/sites-enabled/``
- [openhab-multiuser.conf](openhab-multiuser.conf) ``/etc/nginx/sites-enabled/``

Setup your server_name in both **.config* files.
Setup additional IP filtering and/or Basic authentication for admin access.
Turn-on ModSecurity for the multiuser access if installed for your nginx.

Start NGINX:
```shell
sudo nginx -t
sudo service nginx reload
```
