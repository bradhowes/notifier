var config = require("./config");

module.exports = WNS;

var request = require('request');

/** Constructor for WNS objects.
 *
 * Initially starts out without an access token for application notifications.
 */
function WNS() {
    this.accessToken = null;
    this.accessTokenTimestamp = null;
    this.connection = null;
}

/** Prototype definition for WNS
 *
 * Defines the methods available for WNS instances.
 */
WNS.prototype = {

    validateAccessToken: function (callback) {
        if (this.accessToken === null) {
            this.fetchAccessToken(callback);
        }
        else {
            callback(undefined, this.accessToken);
        }
    },

    fetchAccessToken: function(callback) {
        var self = this;
        var params = {
            'grant_type': 'client_credentials',
            'client_id': config.wns_package_sid,
            'client_secret': config.wns_client_secret,
            'scope': 'notify.windows.com'
        };
        request(
            {
                'method': 'POST',
                'uri': config.wns_access_token_url,
                'form': params
            },
            function(err, resp, body) {
                if (err !== null) {
                    console.log('fetchAccessToken err:', err);
                }
                else {
                    console.log('fetchAccessToken status:', resp.statusCode);
                    if (resp.statusCode == 200) {
                        body = JSON.parse(body);
                        self.accessToken = body.access_token;
                    }
                }
                callback(undefined, self.accessToken);
            });
    },

    sendNotification: function(content, credential, callback) {
        this.validateAccessToken(
            function(err, accessToken) {
                var headers = {
                    'Content-Type': 'text/xml',
                    'X-WNS-Type': content.kind,
                    'X-WNS-RequestForStatus': 'true',
                    'Authorization': 'Bearer ' + accessToken,
                    'Host': 'cloud.notify.windows.com'
                };
                request(
                    {
                        'method': 'POST',
                        'uri': credential,
                        'body': content.text,
                        'headers': headers
                    },
                    function(err, resp, body) {
                        if (err !== null) {
                            console.log('sendNotification err:', err);
                            callback(err, -1);
                        }
                        else {
                            console.log('sendNotification status:', resp.statusCode);
                            if (resp.statusCode != 200) {
                                console.log('resp:', resp);
                                console.log('body:', body);
                            }
                            callback(null, resp.statusCode);
                        }
                    });
            });
    }
};
