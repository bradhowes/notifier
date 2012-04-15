var priv = require('./private/config.js');

module.exports = {
    'wns_host': 'cloud.notify.windows.com',
    'wns_client_id': priv.wns_client_id,
    'wns_client_secret': priv.wns_client_secret,
    'wns_package_name': priv.wns_package_name,
    'wns_package_sid': priv.wns_package_sid,
    'wns_access_token_url': 'https://login.live.com/accesstoken.srf',

    'apns_service_host': 'gateway.sandbox.push.apple.com',
    'apns_service_port': 2195,
    'apns_root_certificate_file': 'EntrustRootCertificationAuthority.pem',
    'apns_client_private_key_file': 'NotificationHubTestDevPush_pkey.pem',
    'apns_client_certificate_file': 'NotificationHubTestDevPush_cred.pem'
};

