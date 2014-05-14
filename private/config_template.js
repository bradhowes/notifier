'use strict';

var crypto = require('crypto');

var D = function(value) {
    var password = process.env.CONFIG_PASSWORD;
    var cipher = crypto.createDecipher('aes256', password);
    if (typeof password == 'undefined' || password.length == 0) {
        throw new Error('No password found in CONFIG_PASSWORD environment variable');
    }
    return Buffer.concat([cipher.update(new Buffer(value, 'base64')), cipher.final()]).toString('utf8');
};

module.exports = {

    // Azure Table Store settings
    azure_storage_account: 'brhnotif',
    azure_storage_access_key: D('@@azure_storage_access_key@@'),

    // Azure ServiceBus settings
    azure_servicebus_namespace: 'brhnotif',
    azure_servicebus_access_key: D('@@azure_servicebus_access_key@@'),

    // Windows Notification Service (WNS)
    wns_client_secret: D('@@wns_client_secret@@'),
    wns_package_sid: D('@@wns_package_sid@@'),

    // Apple Push Notification Service (APNs)
    'apns_root_certificate_file': 'EntrustRootCertificationAuthority.pem',
    'apns_client_private_key_file': 'apn-nhtest-dev.pem',
    'apns_client_certificate_file': 'apn-nhtest-dev.pem',
    'apns_passphrase': D('@@apns_passphrase@@'),

    // Google Cloud Messaging (GCM)
    gcm_authorization_key: D('@@gcm_authorization_key@@')
};
