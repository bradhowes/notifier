'use strict';

/**
 * @fileOverview Defines the WNS prototype and its methods.
 */
module.exports = WNS;

var config = require('./config');
var wns = require('wns');

/**
 * WNS constructor.
 *
 * @class
 *
 * A WNS object sends XML payloads to a WNS server for delivery to a specific Windows 8 device.
 */
function WNS(monitorManager) {
    this.log = config.log('WNS');
    this.monitorManager = monitorManager;
}

/**
 * WNS prototype.
 *
 * Defines the methods available to a WNS instance.
 */
WNS.prototype = {

    /**
     * Send a notification to a client via WNS.
     *
     * @param {NotificationRequest} req the identifier of the client to notify
     */
    sendNotification: function(req) {
        try {

            var log = this.log.child('sendNotification');
            var self = this;
            log.BEGIN();

            log.info('req.token:', req.token);
            log.info('req.content:', req.payload);
            log.info('req.template.kind:', req.template.kind);

            var options = {
                client_id: config.wns_package_sid,
                client_secret: config.wns_client_secret,
                headers: {'X-WNS-RequestForStatus': 'true'}
            };

            if (req.template.kind == 'wns/raw') {
                options.headers['Content-Type'] = 'application/octet-stream';
            }
            else {
                options.headers['Content-Type'] = 'text/xml';
            }

            log.info('options:', options);

            wns.send(req.token, req.payload, req.template.kind, options, function(error, result) {
                try {
                    log.info('error:', error);
                    log.info('result:', result);
                }
                catch (x) {
                    log.error(x);
                }
            });
        }
        catch (x) {
            log.error(x);
        }
    }
};
