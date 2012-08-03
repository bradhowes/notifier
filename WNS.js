/**
 * @fileOverview Defines the WNS prototype and its methods.
 */
module.exports = WNS;

var config = require('./config');
var fs = require('fs');
var HTTPRequest = require('./httpRequest');
var Q = require('q');

/**
 * WNS constructor.
 *
 * @class
 *
 * A WNS object sends XML payloads to a WNS server for delivery to a specific Windows 8 device.
 */
function WNS() {
    this.log = config.log('WNS');
    this.accessToken = null;
    this.accessTokenLifetime = null;
    this.pending = null;
    fs.readFile(config.wns_access_token_cache, function (err, data) {
        if (data) {
            this.log.info('loading access token from', config.wns_access_token_cache);
            try {
                data = JSON.parse(data);
                this.accessToken = data.accessToken;
                this.accessTokenLifetime = data.accessTokenLifetime;
                this.log.info('accessToken:', this.accessToken);
                this.log.info('accessTokenLifetime:', this.accessTokenLifetime);
            } catch (x) {
                this.log.error('failed loading from', config.wns_access_token_cache);
            }
        }
    }.bind(this));
}

/**
 * WNS prototype.
 *
 * Defines the methods available to a WNS instance.
 */
WNS.prototype = {

    fetchAccessToken: function(params) {
        return HTTPRequest(params,
                           function(err, resp, body) {
                               body = JSON.parse(body);
                               return body.access_token;
                           });
    },

    /**
     * Send a notification to a client via WNS.
     *
     * @param {NotificationRequest} req the identifier of the client to notify
     */
    sendNotification: function(req) {
        var log = this.log.child('sendNotification');
        var self = this;
        log.BEGIN(req);

        if (this.pending !== null) {
            // *** We should have a pending accessToken refresh in-progress. If not, then we are sunk.
            this.pending.push(req);
            return;
        }

        if (this.accessToken === null || this.accessTokenLifetime < Date.now()) {
            log.info('renewing access token:', this.accessToken);
            this.pending = [];  // *** This keeps others from entering this branch until the renewal is done
            this.pending.push(req);
            this.fetchAccessToken({
                                      'secondsToLive': 0,
                                      'retryTimeout': 500,
                                      'retryStatusCheck': function (statusCode) { return statusCode !== 200; },
                                      'uri': config.wns_access_token_url,
                                      'method': 'POST',
                                      'form': {
                                          'grant_type': 'client_credentials',
                                          'scope': 'notify.windows.com',
                                          'client_id': config.wns_package_sid,
                                          'client_secret': config.wns_client_secret
                                      }
                                  })
                .then(function (accessToken) {
                          log.info('new accessToken:', accessToken);
                          self.accessToken = accessToken;
                          self.accessTokenLifetime = Date.now() + 24 * 60 * 60 * 1000;

                          // Save to local cache in case we restart
                          fs.writeFile(config.wns_access_token_cache,
                                       JSON.stringify(
                                       {
                                           'accessToken': self.accessToken,
                                           'accessTokenLifetime': self.accessTokenLifetime
                                       }),
                                      function (err) {
                                          log.info('wrote accessToken to', config.wns_access_token_cache, err);
                                      });

                          // If we have pending notifications waiting on a valid access token, resubmit them now.
                          var pending = self.pending;
                          self.pending = null;
                          pending.forEach(function (item) {
                                              self.sendNotification(item);
                                          });
                          return accessToken;
                      })
                .end();
            return;
        }

        // Post the notification now that we have a valid access token
        HTTPRequest({
                        'secondsToLive': 30,
                        'retryTimeout': 500,
                        'uri': req.token,
                        'method': 'POST',
                        'body': req.content.content,
                        'forever': true, // enable long-lived connections
                        'headers': {
                            'Content-Type': 'text/xml',
                            'X-WNS-Type': req.content.kind,
                            'X-WNS-RequestForStatus': 'true',
                            'Authorization': 'Bearer ' + this.accessToken,
                            'Host': 'cloud.notify.windows.com'
                        }
                    },
                    function(err, resp, body) {
                        log.debug(err, resp, body);
                        if (err !== null) {
                            log.error('failed to deliver notification:', err);
                            return err;
                        }
                        else {
                            log.debug('response code:', resp.statusCode);
                            switch (resp.statusCode) {
                            case 200:
                                log.info('delivered notification');
                                break;
                            case 401: // Unauthorized
                            case 403: // Forbidden
                                // This *really* should not happen here.
                                log.error('access token has strangely expired');
                                self.accessToken = null;
                                return self.sendNotification(req);

                            case 410: // Gone
                                log.warn('user registration is no longer valid');
                                req.removeRegistrationProc();
                                break;

                            default:
                                log.warn('failed to deliver notification:', resp.statusCode);
                            }
                            return resp;
                        }
                    }).end();
    }
};
