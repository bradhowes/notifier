module.exports = Notifier;

function Barrier(res, callback) {
    this.res = res;
    this.callback = callback;
}

Barrier.prototype = {
    gotRegistrations: function(err, registrations) {
        this.registrations = registrations;
        if (this.templates != undefined) {
            this.callback(this.res, this.registrations, this.templates);
        }
    },

    gotTemplates: function(err, templates) {
        this.templates = templates;
        if (this.registrations != undefined) {
            this.callback(this.res, this.registrations, this.templates);
        }
    }
};

/**
 * Notifier constructor.
 *
 * A notifier sends out notifications to a give user using templates that match the settings found in the user's
 * registrations.
 */
function Notifier(templateStore, registrationStore, generator, senders) {
    this.templateStore = templateStore;
    this.registrationStore = registrationStore;
    this.generator = generator;
    this.senders = senders;
}

Notifier.prototype = {

    postNotification: function(req, res) {
        var self = this;
        var userId = req.params.userId;
        this.registrationStore.getRegistrations(userId, function(err, registrations)
        {
            if (err !== null) {
                res.send(null, null, 500);
                return;
            }

            if (registrations.length == 0) {
                res.send(null, null, 202);
                return;
            }

            var body = req.body;
            var eventId = body.eventId;
            var substitutions = body.substitutions;

            self.templateStore.findTemplates(eventId, registrations, function(err, matches)
            {
                if (err !== null) {
                    console.log(err);
                    res.send(null, null, 500);
                    return;
                }

                if (matches.length == 0) {
                    res.send(null, null, 202);
                    return;
                }

                for (var index in matches) {
                    var match = matches[index];
                    var template = match.template;
                    var content = self.generator.transform(template, substitutions);
                    self.deliver(match.contract, match.path, content);
                }
                res.send(null, null, 202);
            });
        });
    },

    deliver: function(contract, path, content) {
        this.senders[contract].sendNotification(path, content);
    }
};
