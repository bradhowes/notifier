/**
 * @fileOverview Defines the Google Cloud Messaging (GCM) interface prototype and its methods.
 */
module.exports = GCM;

var config = require("./config");
var request = require("request");

/**
 * Initialize a new GCM instance. A GCM object sends JSON payloads to a GCM server for delivery to a specific Android
 * device.
 *
 * @class
 */
function GCM() {
    this.log = config.log('GCM');
    this.connection = null;
    this.authorizationKey = 'key=' + config.gcm_authorization_key;
}

GCM.prototype = {

    /**
     * Send a notification to a client via GCM.
     *
     * @param {String} token the identifier of the client to notify
     *
     * @param {String} content the notification payload to send
     *
     * @param {Function} callback function to call when GCM returns a response.
     */
    sendNotification: function(token, content, callback) {
        var log = this.log.child('sendNotification');
        log.BEGIN(token);

        var headers = {
            'Content-Type': 'application/json',
            'Authorization': self.authorizationKey
        };

        request(
            {
                'method': 'POST',
                'uri': config.gcm_uri,
                'body': content,
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
    }
};
