"use strict";

/**
 * @fileOverview Defines the configuration parameters for the service.
 */
module.exports = undefined;

// Load in sensitive parameters
var priv = require('./private/config.js');
var slice = Array.prototype.slice;

module.exports = {

    'log': (function () {
                var log4js = require('log4js');
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
                        ],

                        // Define the levels to accept for messages from a logger.
                        "levels": {
                            "server":  "INFO"
                        }
                    }
                );

                // Add a method to the Logger prototype to allow definition of a child logger from its parent.
                var root = log4js.getDefaultLogger();
                root.__proto__.child = function(name) {
                    return log4js.getLogger(this.category + '.' + name);
                };

                // Add a method to signal the start of a method
                root.__proto__.BEGIN = function() {
                    this.info.apply(this, ['BEG'].concat(slice.call(arguments)));
                };

                // Add a method to signal the end of a method
                root.__proto__.END = function() {
                    this.info.apply(this, ['END'].concat(slice.call(arguments)));
                };

                return log4js.getLogger;
            })(),

    /**
     * FQDN of the host to use to deliver WNS notification payloads.
     * @type {String}
     */
    'wns_host': 'cloud.notify.windows.com',

    /**
     * The client secret associated with the Windows application
     * @type {String}
     */
    'wns_client_secret': priv.wns_client_secret,

    /**
     * The package name associated with the Windows application
     * @type {String}
     */
    'wns_package_name': priv.wns_package_name,

    /**
     * The package SID associated with the Windows application
     * @type {String}
     */
    'wns_package_sid': priv.wns_package_sid,

    /**
     * The URL to use to fetch new WNS access tokens for the above application credentials.
     * @type {String}
     */
    'wns_access_token_url': 'https://login.live.com/accesstoken.srf',

    /**
     * The FQDN of the host to use to deliver APNs notifcation payloads.
     * @type {String}
     */
    'apns_service_host': 'gateway.sandbox.push.apple.com',

    /**
     * The port of the host to connect to for APNs notifications.
     * @type {Number}
     */
    'apns_service_port': 2195,

    /**
     * The file holding the root certificate used to authenticate the remote server.
     * @type {String}
     */
    'apns_root_certificate_file': 'private/EntrustRootCertificationAuthority.pem',

    /**
     * The file holding the private key certificate used to authenticate to the remote server.
     * @type {String}
     */
    'apns_client_private_key_file': 'private/NotificationHubTestDevPush_pkey.pem',

    /**
     * The file holding the credentials used to authenticate to the remote server for application notifications.
     * @type {String}
     */
    'apns_client_certificate_file': 'private/NotificationHubTestDevPush_cred.pem',

    /**
     * The Azure storage account to use for table stores.
     * @type
     */
    'azure_storage_account': priv.azure_storage_account,

    /**
     * The access key for the above Azure storage account
     * @type {String}
     */
    'azure_storage_access_key': priv.azure_storage_access_key,

    'registrations_table_name': 'notifierRegistrations',
    'templates_table_name': 'notifierTemplates',

    /**
     * The authorization key from Google for sending GCM messages
     */
    'gcm_authorization_key': priv.gcm_authorization_key,

    /**
     * The URI for the GCM server
     */
    'gcm_uri': 'https://android.googleapis.com/gcm/send'
};
