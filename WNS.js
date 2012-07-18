/**
 * @fileOverview Defines the WNS prototype and its methods.
 */
module.exports = WNS;

var config = require("./config");
var request = require("request");

/**
 * Initialize a new WNS instance. A WNS object sends XML payloads to a WNS server for delivery to a specific device.
 *
 * @class
 */
function WNS() {
    this.log = config.log('WNS');
    this.accessToken = null;
    this.accessTokenTimestamp = null;
    this.connection = null;
}

WNS.prototype = {

    /**
     * Check for a valid access token. If none found, fetch a new one.
     *
     * @param {Function} callback function to call when a valid token is obtained
     */
    validateAccessToken: function (callback) {
        if (this.accessToken === null) {
            this.fetchAccessToken(callback);
        }
        else {
            callback(undefined, this.accessToken);
        }
    },

    /**
     * Fetch a new access token from WNS.
     *
     * @param {Function} callback function to call when WNS returns a response.
     */
    fetchAccessToken: function(callback) {
        var self = this;
        var log = this.log.child('fetchAccessToken');
        log.BEGIN();
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
                if (err === null) {
                    if (resp.statusCode == 200) {
                        body = JSON.parse(body);
                        self.accessToken = body.access_token;
                    }
                }
                callback(undefined, self.accessToken);
                log.END();
            });
    },

    /**
     * Send a notification to a client via WNS.
     *
     * @param {String} token the identifier of the client to notify
     *
     * @param {String} content the notification payload to send
     *
     * @param {Function} callback function to call when WNS returns a response.
     */
    sendNotification: function(token, content, callback) {
        var log = this.log.child('sendNotification');
        log.BEGIN(token);
        content = JSON.parse(content);

        log.debug('content.kind:', content.kind);

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
                        'uri': token,
                        'body': content.text,
                        'headers': headers
                    },
                    function(err, resp, body) {
                        if (err !== null) {
                            log.error("POST error:", err);
                            callback({"retry":true, "invalidToken":false});
                        }
                        else {
                            log.info("POST response:", resp.statusCode);
                            callback({"retry":false, "invalidToken":resp.statusCode == 410});
                        }
                        log.END();
                    }
                );
            });
    }
};
