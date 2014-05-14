'use strict';

/**
 * Collection of values to encrypt. The attribute names will be used to satisfy substitutions in the contents of the
 * config_template.js file.
 *
 * *NOTE*: do not commit to source code control with the raw, unencrypted values
 *
 * To use, rename this file as raw_config.js and add the proper unencrypted values for all of the attributes listed
 * below. When done, run the command
 *
 * `node gen_config.js PASSWORD`
 *
 * where PASSWORD is the password to use when encrypting the private values below. This will generate the file
 * `config.js` with the encrypted values.
 */

module.exports = {

    /* Passphrase to use to decrypt the cert used for APNs connectivity */
    apns_passphrase: '',

    /* The access key for the Azure storage account being used */
    azure_storage_access_key: '',

    /* The access key for the Azure ServiceBus being used */
    azure_servicebus_access_key: '',

    /* The client secret associated with the Windows application that receives WNS notifications */
    wns_client_secret: '',

    /* The package SID associated with the Windows application that receives WNS notifications */
    wns_package_sid: '',

    /* The authorization key from Google for sending messages over GCM to Android devices */
    gcm_authorization_key: ''
};
