
module.exports = {

    // Azure Table Store settings
    'azure_storage_account': 'brhnotif',
    'azure_storage_access_key': process.env.AZURE_STORAGE_ACCESS_KEY,

    // Azure ServiceBus settings
    'azure_servicebus_namespace': 'brhnotif',
    'azure_servicebus_access_key': process.env.AZURE_SERVICEBUS_ACCESS_KEY,

    // Windows Notification Service (WNS)
    'wns_client_secret': process.env.WNS_CLIENT_SECRET,
    'wns_package_sid': process.env.WNS_PACKAGE_SID,

    // Apple Push Notification Service (APNs)
    'apns_root_certificate_file': 'EntrustRootCertificationAuthority.pem',
    'apns_client_private_key_file': 'apn-nhtest-dev.pem',
    'apns_client_certificate_file': 'apn-nhtest-dev.pem',

    // Google Cloud Messaging (GCM)
    'gcm_authorization_key': process.env.GCM_AUTHORIZATION_KEY
};
