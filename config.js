"use strict";

/**
 * @fileOverview Defines the configuration parameters for the service.
 */
module.exports = undefined;

// Load in sensitive parameters
var fs = require('fs');
var priv = require('./private/config');
var LoggerUtils = require('./loggerUtils');

/**
 * Configuration module.
 *
 * @class config
 *
 * Configuration parameters for the notifier service.
 */
function Config () {

    var log4js = require('log4js');

    /**
     * Logging configuration for the server.
     */
    log4js.configure(
        {
            // Define the log appenders to use. These apply to all loggers.
            "appenders": [
                {
                    "type": "file",
                    "filename": "notifier.log",
                    "layout": { "type": "basic" }
                },
                {
                    "type": "console",
                    "layout": { "type": "basic" }
                }
            ]
        }
    );

    /**
     * Determines if SSL authentication is enabled.
     */
    this.ssl_authentication_enabled = false;

    /**
     * Determines if unauthenticated traffic will be accepted.
     */
    this.ssl_reject_unauthorized = false;

    /**
     * The contents of the server key for SSL authentication.
     */
    this.ssl_server_key = fs.readFileSync('certs/server.key');

    /**
     * The passphrase for the above server key.
     */
    this.ssl_server_key_passphrase = '';

    /**
     * The contents of the server certificate file for SSL authentication.
     */
    this.ssl_server_certificate = fs.readFileSync('certs/server.cert');

    /**
     * The contents of the certificate authority certificate file for SSL authentication.
     */
    this.ssl_ca_certificate = fs.readFileSync('certs/ca.cert');

    /**
     * Shortcut to log4js.getLogger procedure. Allows other modules to do ```config.log('moduleName')```
     * @type {Function}
     */
    this.log = log4js.getLogger;

    /**
     * Path to local file that hold's the last fetched access_token. This will be read at startup if it exists.
     * @type {String}
     */
    this.wns_access_token_cache = 'wns_access_token_cache.js',

    /**
     * FQDN of the host to use to deliver WNS notification payloads.
     * @type {String}
     */
    this.wns_host = 'cloud.notify.windows.com';

    /**
     * The client secret associated with the Windows application
     * @type {String}
     */
    this.wns_client_secret = priv.wns_client_secret;

    /**
     * The package SID associated with the Windows application
     * @type {String}
     */
    this.wns_package_sid = priv.wns_package_sid;

    /**
     * The URL to use to fetch new WNS access tokens for the above application credentials.
     * @type {String}
     */
    this.wns_access_token_url = 'https://login.live.com/accesstoken.srf';

    /**
     * The FQDN of the host to use to deliver APNs notifcation payloads.
     * @type {String}
     */
    this.apns_service_host = 'gateway.sandbox.push.apple.com'; // or 'gateway.push.apple.com'

    /**
     * The port of the host to connect to for APNs notifications.
     * @type {Number}
     */
    this.apns_service_port = 2195;

    /**
     * The FQDN of the host to connect to for APNs feedback.
     * @type {String}
     */
    this.apns_feedback_host = 'feedback.sandbox.push.apple.com'; // or 'feedback.push.apple.com'

    /**
     * The port of the host to connect to for APNs feedback.
     * @type {Number}
     */
    this.apns_feedback_port = 2196;

    /**
     * The number of seconds between checks for APNs feedback (zero to disable).
     * @type {Number}
     */
    this.apns_feedback_interval = 3600;

    /**
     * The max number of entries in the APNs device cache used to locate a user when Apple's feedback service says the
     * device token is no longer valid.
     */
    this.apns_device_cache_size = 10000;

    /**
     * The file holding the root certificate used to authenticate the remote server.
     * @type {String}
     */
    this.apns_root_certificate_file = 'private/EntrustRootCertificationAuthority.pem';

    /**
     * The file holding the private key certificate used to authenticate to the remote server.
     * @type {String}
     */
    this.apns_client_private_key_file = 'private/apn-nhtest-dev.pem';

    /**
     * The file holding the credentials used to authenticate to the remote server for application notifications.
     * @type {String}
     */
    this.apns_client_certificate_file = 'private/apn-nhtest-dev.pem';

    /**
     * The Azure storage account to use for table stores.
     * @type {String}
     */
    this.azure_storage_account = priv.azure_storage_account;

    /**
     * The access key for the above Azure storage account
     * @type {String}
     */
    this.azure_storage_access_key = priv.azure_storage_access_key;

    /**
     * The Azure ServiceBus namespace to use.
     * @type {String}
     */
    this.azure_servicebus_namespace = priv.azure_servicebus_namespace;

    /**
     * The access key for the above Azure ServiceBus namespace.
     * @type {String}
     */
    this.azure_servicebus_access_key = priv.azure_servicebus_access_key;

    // Make sure our environment reflects these Azure settings.
    process.env.AZURE_STORAGE_ACCOUNT = this.azure_storage_account;
    process.env.AZURE_STORAGE_ACCESS_KEY = this.azure_storage_access_key;
    process.env.AZURE_SERVICEBUS_NAMESPACE = this.azure_servicebus_namespace;
    process.env.AZURE_SERVICEBUS_ACCESS_KEY = this.azure_servicebus_access_key;

    /**
     * The authorization key from Google for sending GCM messages
     * @type {String}
     */
    this.gcm_authorization_key = priv.gcm_authorization_key;

    /**
     * The URI for the GCM server
     * @type {String}
     */
    this.gcm_uri = 'https://android.googleapis.com/gcm/send';

    /**
     * Name of the Azure table to create and use for user registrations.
     * @type {String}
     */
    this.registrations_table_name = 'notifierRegistrations';

    /**
     * Name of the Azure table to create and use for notification templates.
     * @type {String}
     */
    this.templates_table_name = 'notifierTemplates';

    /**
     * The regular-expression (RE) that matches placeholders in a template.
     *
     * Placeholders are signaled by two '@' characters, followed by a name of alphanumeric characters and underscores.
     * There may also be an optional default value, signaled by a '=' character after the name. The stock one below
     * matches fields such as: @@ABC@@, @@FooBar=default value@@
     *
     * NOTE: if you change this, odds are you have to change the RE processing code in payloadGenerator.js
     *
     * @type {String}
     */
    this.templates_placeholder_re = '@@([A-Za-z0-9_]+)(=([^@]*))?@@';

    /**
     * The name of the ServiceBus topic to create and use for monitoring.
     * @type {String}
     */
    this.monitor_topic_name = 'monitor';

    /**
     * The number of minutes that a monitoring request will be valid.
     * @type {Number}
     */
    this.monitor_duration_minutes = 30;

    /**
     * The interval in minutes between invocation of MonitorManager.cleanup function, which culls stale topic
     * subscriptions in Azure ServiceBus.
     * @type {Number}
     */
    this.monitor_cleanup_interval_minutes = 10;

    /**
     * The name of the command channel to use to advertise and listen for monitor changes. This should *not* match a
     * valid user ID.
     */
    this.monitor_command_channel_name = '*';
}

module.exports = new Config();
