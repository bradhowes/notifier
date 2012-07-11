/**
 * @fileOverview Defines the Notifier prototype and its methods.
 */
module.exports = Notifier;

/**
 * Initialize a new Notifier instance. A Notifier matches notification templates to user registrations and emits those
 * that match.
 *
 * @class
 *
 * @param {TemplateStore} templateStore the repository of notification templates to rely on
 * @param {RegistrationStore} registrationStore the repository of user registrations to rely on
 * @param {PayloadGenerator} generator the notification generator to use for template processing
 * @param {Hash} senders a mapping of notification service tags to objects that provide a sendNotification method
 */
function Notifier(templateStore, registrationStore, generator, senders) {
    this.templateStore = templateStore;
    this.registrationStore = registrationStore;
    this.generator = generator;
    this.senders = senders;
}

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
        var userId = req.params.userId;
        this.registrationStore.getRegistrations(userId, function(err, registrations)
        {
            if (err !== null) {
                res.send(null, null, 500);
                return;
            }

            if (registrations.length === 0) {
                res.send(null, null, 202);
                return;
            }

            var body = req.body;
            var eventId = body.eventId;
            var substitutions = body.substitutions;
            var token = null;

            self.templateStore.findTemplates(eventId, registrations, function(err, matches)
            {
                if (err !== null) {
                    console.log(err);
                    res.send(null, null, 500);
                    return;
                }

                if (matches.length === 0) {
                    res.send(null, null, 202);
                    return;
                }

                var callback = function (result) {
                    console.log("postNotification.callback:", userId, token, result);
                    if (result.invalidToken) {
                        self.registrationStore.deleteRegistrationEntity(userId, token,
                                                                        function (err) {
                                                                            console.log(
                                                                                "notifier.deliverCallback:", err);
                                                                        });
                    }
                };

                for (var index in matches) {
                    var match = matches[index];
                    var template = match.template;
                    var content = self.generator.transform(template, substitutions);
                    token = match.token;
                    self.deliver(match.service, match.token, content, callback);
                }

                res.send(null, null, 202);
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
