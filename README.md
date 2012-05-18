# Notifier

This is a collection of classes that provide three services:

* Template Management -- add, get, delete notification templates
* Registrar -- add, get, delete registrations for notifications
* Notification Generation -- generate notifications from templates and send them to the correct service
  (WNS, APNs, etc.)

Currently there is only support for WNS.

# Configuration

See the config.js file. Note that some sensitive settings must be added to a private/config.js file before things will
work, in particular WNS notifications and Azure Table Store access.

# Template Manager API

Notification templates contain the body of the template payload that will be sent out to a specific notification
service, such as WNS or APNs. Each individual template is stored under a unique key generated from the following
values:

* notificationId – identifier for the notification
* routeName – the routing applied to the notification during final delivery
* templateVersion – the version of the template
* templateLanguage – the language of the template contents
* service – the notification service used for final delivery

Each template is associated with an notifiable event (see Notification Generation below).

## Add Template

### HTTP POST http://SERVER/templates

### Json Attributes:
* eventId – identifier of the notifiable event to associate with
* notificationId – unique identifier for this notification template
* routeName – which notification service route this template is for
* templateVersion – the version of the template
* templateLanguage – the language of the template contents
* service – the notification service to use for delivery (e.g. 'wns')
  * wns – deliver notifications using Microsoft's WNS
  * apns – deliver notifications using Apple's APNs
* content – the definition of the template. For WNS notifications, this should be Json object with two attributes:
  * kind – the type of notification this template will generate
    * wns/badge – WNS badge setting XML
    * wns/toast – WNS toast notification XML
    * wns/tile – WNS tile update XML
    * wns/raw – WNS raw notification XML
  * body – the XML contents for the template

### Example: 
```
{
  'eventId': 100, 
  'notificationId': 1,
  'routeName': 'main',
  'templateVersion': '1.0',
  'templateLanguage': 'en-US',
  'service': 'wns', 
  'content': {'kind': 'wns/badge', 'body': '<xml>...</xml>'}
}
```

## Get Templates

### HTTP GET http://SERVER/templates?

### Query Attributes:
* eventId – identifier of the notifiable event to fetch
* routeName – which notification service route to fetch
* templateVersion – the version of the template to fetch
* templateLanguage – the language of the template to fetch
* service – restrict templates to only those associated with the given service
  * wns – deliver notifications using Microsoft's WNS
  * apns – deliver notifications using Apple's APNs

### Example: 
```
http://SERVER/templates?eventId=100&notification=1&routeName=main&templateVersion=1.0&templateLanguage=en-US&service=wns
```

## Delete Template

### HTTP DEL http://SERVER/templates?

### Query Attributes:
* eventId – identifier of the notifiable event to fetch
* routeName – which notification service route to fetch
* templateVersion – the version of the template to fetch
* templateLanguage – the language of the template to fetch
* service – restrict templates to only those associated with the given service
  * wns – deliver notifications using Microsoft's WNS
  * apns – deliver notifications using Apple's APNs

### Example: 
```
http://SERVER/templates?eventId=100&notification=1&routeName=main&templateVersion=1.0&templateLanguage=en-US&service=wns
```

# Registrar API

In order for Notifier to reach a notifiable application, the application must first register with Notifier, giving it
enough information so that Notifier will be able to reach it with a suitable notification payload.

## Add Registration

### HTTP POST http://SERVER/registrations/USER

The USER is the identifier for a given user.

### Json Attributes

* registrationId – unique identifier for the application _instance_ being registered for the USER. Ideally this value
  will not change. A hardware–based GUUID is a good candidate for this value.
* templateVersion – the version of the templates that the registering application supports.
* templateLanguage – the language that the registering application is using to display text to the user.
* service – the notification service that the host operating system uses for notification delivery to the application. 
  For instance, if a client application is running on an iOS device, this would be 'apns'
* routes – a Json array that contains one or more Json objects that define the notification service attributes to use
  when delivering the notification payloads to the client. APNs only supports one delivery route per client 
  application, but WNS supports more than one. Each entry contains the following attributes:
  * name – the name associated with the delivery route to use for notifications.
  * token – the URI (WNS) or device identifier (APNs) to use for notification delivery
  * secondsToLive – the number of seconds into the future that this registration is valid for

### Example:

```
{
  'registrationId': 'abc-123-456',
  'templateVersion': '1.0', 
  'templateLanguage': 'en-US',
  'service': 'wns',
  'routes': [ {'name': 'main', 'token': 'https://example.com/...'} ]
}
```

## Get Registrations

### HTTP GET http://SERVER/registrations/USER

Returns all of the valid registrations for a given USER.

# Notification Generation API

### HTTP POST http://SERVER/postnotification/USER

### Json Attributes
* eventId – the ident of the event to notify about.
* substitutions – Json object to use for substitution values during notification generation from templates.

### Example:

```
{
  'eventId': 100, 
  'substitutions': {'NAME':, 'John Doe', 'PHONE': '+1 800 555-1212'}
}
```
