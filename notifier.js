/**
 * @fileOverview Defines the Notifier prototype and its methods.
 */
module.exports = Notifier;

/**
 * Notifier constructor
 *
 * @class
 *
 * A Notifier pairs notification templates to user registrations and emits those that match.
 *
 * @param {TemplateStore} templateStore the repository of notification templates to rely on
 * @param {RegistrationStore} registrationStore the repository of user registrations to rely on
 * @param {PayloadGenerator} generator the notification generator to use for template processing
 * @param {Hash} senders a mapping of notification service tags to objects that provide a sendNotification method
 */
function Notifier(templateStore, registrationStore, generator, senders) {
    this.log = require('./config').log('notifier');
    this.templateStore = templateStore;
    this.registrationStore = registrationStore;
    this.generator = generator;
    this.senders = senders;
}

/**
 * APNs prototype.
 *
 * Defines the methods available to an APNs instance.
 */
Notifier.prototype = {

    /**
     * Post a notification to a user.
     *
     * @param {Request} req incoming HTTP request settings and values
     *
     * @param {Response} res outgoing HTTP response values
     */
    postNotification: function(req, res) {
        var self = this;
        var log = self.log.child('postNotification');

        log.BEGIN();

        var userId = req.params.userId;
        log.debug('userId:', userId);
        if (userId === "undefined" || userId === "") {
            log.error('missing userId');
            res.send(null, null, 400);
            return;
        }

        var body = req.body;
        var eventId = body.eventId;
        log.debug('eventId:', eventId);
        if (eventId === "undefined" || eventId === "") {
            log.error('missing eventId');
            res.send(null, null, 400);
            return;
        }

        var substitutions = body.substitutions;
        log.debug('substitutions:', substitutions);

        var start = new Date();

        // Fetch the registrations for the given user
        this.registrationStore.getRegistrations(userId, function(err, registrations)
        {
            if (err !== null) {
                log.error('RegistrationStore.getRegistrations error:', err);
                res.send(null, null, 500);
                return;
            }

            if (registrations.length === 0) {
                log.info('no registrations exist for user', userId);
                res.send(null, null, 202);
                return;
            }

            // Find the templates that apply for the given registrations
            self.templateStore.findTemplates(eventId, registrations, function(err, matches)
            {
                var token = null;

                if (err !== null) {
                    log.error('TemplateStore.findTemplates error:', err);
                    res.send(null, null, 500);
                    return;
                }

                if (matches.length === 0) {
                    log.info('TemplateStore.findTemplates returned no matches');
                    res.send(null, null, 202);
                    return;
                }

                var callback = function (result) {
                    log.debug("callback:", userId, token, result);
                    if (result.invalidToken) {
                        self.registrationStore.deleteRegistrationEntity(
                            userId, token,
                            function (err) {
                                log.error("deliverCallback:", err);
                            });
                    }
                };

                // For each template, generate a notification payload and send it on its way.
                for (var index in matches) {
                    var match = matches[index];
                    var template = match.template;
                    var content = self.generator.transform(template, substitutions);
                    token = match.token;
                    self.deliver(match.service, match.token, content, callback);
                }

                var end = new Date();
                var duration = end.getTime() - start.getTime();

                res.send(null, null, 202);
                log.END(duration, 'msecs');
            });
        });
    },

    /**
     * Deliver a generated notification to a specific service.
     *
     * @param {string} service the notification service tag
     *
     * @param {string} token the client token used for notification delivery
     *
     * @param {string} content what to send as a notification payload
     *
     * @param {Function} callback function to call with the results of the notification delivery. Takes one argument,
     * an object with two attributes: retry and invalidToken.
     */
    deliver: function(service, token, content, callback) {
        this.senders[service].sendNotification(token, content, callback);
    }
};
