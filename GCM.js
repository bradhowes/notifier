'use strict';

/**
 * @fileOverview Defines the Google Cloud Messaging (GCM) interface prototype and its methods.
 */
module.exports = GCM;

var config = require("./config");
var request = require("request");

/**
 * GCM constructor.
 *
 * @class
 *
 * A GCM object sends JSON payloads to a GCM server for delivery to a specific Android device.
 */
function GCM(monitorManager) {
    this.log = config.log('GCM');
    this.monitorManager = monitorManager;
    this.connection = null;
    this.authorizationKey = 'key=' + config.gcm_authorization_key;
}

/**
 * GCM prototype.
 *
 * Defines the methods available to a GCM instance.
 */
GCM.prototype = {

    /**
     * Send a notification to a client via GCM. See http://developer.android.com/guide/google/gcm/gcm.html
     *
     * @param {NotificationRequest} request the request to send out
     */
    sendNotification: function(req) {
        var self = this;
        var log = this.log.child('sendNotification');
        log.BEGIN(req);

        var content = null;
        try {
            // Convert the notification payload into a Javascript object.
            content = JSON.parse(req.payload);
        }
        catch (err) {
            log.error('failed to parse GCM payload:', req.payload);
            self.monitorManager.post(req.userId, 'invalid payload: ' + req.payload);
            log.END();
            return;
        }

        // Add the device-specific address to the payload before sending.
        content.registration_ids = [req.token];
        log.debug(content);

        var headers = {
            'Content-Type': 'application/json',
            'Authorization': self.authorizationKey
        };

        log.debug(headers);

        self.monitorManager.post(req.userId, 'sending payload via GCM');

        content = JSON.stringify(content);
        self.monitorManager.post(req.userId, content);

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
                    self.monitorManager.post(req.userId, 'failed to send to GCM: ' + err);
                }
                else {
                    self.monitorManager.post(req.userId, 'sent to GCM: ' + resp.statusCode);
                    log.info('POST response:', resp.statusCode);
                    log.info('BODY:', body);
                }
                log.END();
            }
        );
    }
};
