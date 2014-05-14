# Notifier

This is a collection of classes that provide three services:

* Template Management -- add, get, delete notification templates
* Registrar -- add, get, delete registrations for notifications
* Notification Generation -- generate notifications from templates and send them to the correct service
  (WNS, APNs, etc.)

Currently there is only support for Microsoft WNS, Apple's APNs, and Google's GCM.

# Configuration

See the `config.js` file. Note that some sensitive settings must be added to a `private/config.js` file before things
will work, in particular the notification services and Azure Table Store access. To do this in a secure way, you must
do the following:

* Choose a password that you will use to encrypt sensitive data
* Copy `private/raw_config_template.js` to `private/raw_config.js`
* Edit `private/raw_config.js` so that it contains values that pertain to your Azure environment, APNs credentials,
  etc.
* Run `node gen_config.js PASSWORD` where PASSWORD is what you chose above
* You can delete `private/raw_config.js` now and safely commit everything else
* In Azure portal, add an environment variable for the Web Service with the name `CONFIG_PASSWORD` and the value of the
  password you chose. If running localy, just set an environment variable before running node:

    ```
    % CONFIG_PASSWORD="PASSWORD" node app.js
    ```

# Running
```
% node server.js
```

# Code Documentation

Online documentation can be found at [here](http://bradhowes.github.com/notifier/index.html).

Local documentation may be generated via

```
% make doc
```

The resulting documentation will be found in the ```doc``` directory.

NOTE: the above relies on ```noc``` so you will need to install it using ```npm```:

```
% sudo npm -g install noc
```

# Unit Tests
```
% vows test/*.js
```

# Scripts

The ```scripts``` directory contains some Bash shell scripts to help get things going:

* addreg.sh -- add or update a registration for a user
* getreg.sh -- get current registrations for a user
* delreg.sh -- remove one registration or all registrations for a user
* addtemp.sh -- add or replace a template
* gettemp.sh -- retrieve a template
* deltemp.sh -- remove a template
* post.sh -- post notifications associated with an eventId to the devices registered for a user

# Template Manager API

Notification templates contain the body of the template payload that will be sent out to a specific notification
service, such as WNS or APNs. Each individual template is stored under a unique key generated from the following
values:

* notificationId -- identifier for the notification
* routeName -- routing applied to the notification during final delivery
* templateVersion -- the version of the template
* templateLanguage -- the language of the template contents
* service -- the notification service used for final delivery

Each template is associated with an notifiable event (see Notification Generation below).

## Add Template

### HTTP POST http://SERVER/templates

### JSON Attributes:
* eventId -- identifier of the notifiable event to associate with
* notificationId -- unique identifier for this notification template
* routeName - which notification service route this template is for
* templateVersion -- the version of the template
* templateLanguage -- the language of the template contents
* service -- the notification service to use for delivery (e.g. 'wns')
  * wns -- deliver notifications using Microsoft's WNS
  * apns -- deliver notifications using Apple's APNs
  * gcm -- deliver notifications using Google's GCM service
* template -- the definition of the template. This must refer to a JSON object with at least one attribute:
  * content -- the contents for the template

#### WNS Templates

For WNS notifications, the ```template``` JSON object must have defined:
  * kind -- the type of notification this template will generate
    * "wns/badge" -- WNS badge setting XML
    * "wns/toast" -- WNS toast notification XML
    * "wns/tile" -- WNS tile update XML
    * "wns/raw" -- WNS raw notification XML

The body of the template (```content``` above) must be valid XML.

#### APNs Templates

For APNs notifications, the ```content`` attribute must hold a string that contains a valid JSON definition for APNs.
For example:

```
content: "{\"aps\":{\"alert\":\"Hello, @@PLANET@@\",\"badge\":@@COUNT@@,\"sound\":\"default\"}}"
```

Note the escaping of the quotes since the JSON payload itself is held within a string.

#### GCM Templates

Currently, only JSON payloads are supported by the GCM module. Same rules apply as per APNs above.

### Example: 
```
{
  "eventId": 100,
  "notificationId": 1,
  "route": "main",
  "templateVersion": "1.0",
  "templateLanguage": "en-US",
  "service": "wns", 
  "template": {"kind": "wns/badge", "content": "<xml>...</xml>"}
}
```

## Get Templates

### HTTP GET http://SERVER/templates?

### Query Attributes:
* eventId -- identifier of the notifiable event to fetch
* route -- which notification service route to fetch
* templateVersion -- the version of the template to fetch
* templateLanguage -- the language of the template to fetch
* service -- restrict templates to only those associated with the given service
  * wns -- deliver notifications using Microsoft's WNS
  * apns -- deliver notifications using Apple's APNs

### Example: 
```
http://SERVER/templates?eventId=100&notification=1&route=main&templateVersion=1.0&templateLanguage=en-US&service=wns
```

## Delete Template

### HTTP DEL http://SERVER/templates?

### Query Attributes:
* eventId -- identifier of the notifiable event to fetch
* route -- which notification service route to fetch
* templateVersion -- the version of the template to fetch
* templateLanguage -- the language of the template to fetch
* service -- restrict templates to only those associated with the given service
  * wns -- deliver notifications using Microsoft's WNS
  * apns -- deliver notifications using Apple's APNs

### Example: 
```
http://SERVER/templates?eventId=100&notification=1&route=main&templateVersion=1.0&templateLanguage=en-US&service=wns
```

# Registrar API

In order for Notifier to reach a notifiable application, the application must first register with Notifier, giving it
enough information so that Notifier will be able to reach it with a suitable notification payload.

## Add Registration

### HTTP POST http://SERVER/registrations/USER

The USER is the identifier for a given user.

### JSON Attributes

* registrationId -- unique identifier for the application _instance_ being registered for the USER. Ideally this value
  will not change. A hardware–based GUUID is a good candidate for this value.
* templateVersion -- the version of the templates that the registering application supports.
* templateLanguage -- the language that the registering application is using to display text to the user.
* service -- the notification service that the host operating system uses for notification delivery to the application. 
  For instance, if a client application is running on an iOS device, this would be 'apns'
* routes -- a JSON  that contains one or more JSON objects that define the notification service attributes to use
  when delivering the notification payloads to the client. APNs only supports one delivery route per client 
  application, but WNS supports more than one. Each entry contains the following attributes:
  * name -- the name associated with the delivery route to use for notifications.
  * token -- the URI (WNS) or device identifier (APNs) to use for notification delivery
  * secondsToLive - the number of seconds into the future that this registration is valid for

### Example:

```
{
  "registrationId": "abc-123-456",
  "templateVersion": "1.0", 
  "templateLanguage": "en-US",
  "service": "wns",
  "routes": [ {"name": "main", "token": "https://example.com/...", secondsToLive: 86400} ]
}
```

## Get Registrations

### HTTP GET http://SERVER/registrations/USER

Returns all of the valid registrations for a given USER.

# Notification Generation API

### HTTP POST http://SERVER/postnotification/USER

### JSON Attributes
* eventId -- the ident of the event to notify about.
* substitutions -- JSON object to use for substitution values during notification generation from templates.

### Example:

```
{
  "eventId": 100, 
  "substitutions": {"NAME":, "John Doe", "PHONE": "+1 800 555-1212"}
}
```
